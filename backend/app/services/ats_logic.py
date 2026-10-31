"""Deterministic ATS scoring (no third-party imports). Produces the 10 section scores the frontend shows.
Gemini (see ats_service.py) only adds keyword alignment and the written limitations / improvements."""
import re
from collections import Counter

from .matching_logic import tokenize
from .resume_logic import RANGE_RE, URL_RE, YEAR_RE, find_email, find_phone, split_sections

WEIGHTS = {
    "Contact Info": 0.08, "Summary": 0.08, "Experience": 0.18, "Skills": 0.14, "Education": 0.08,
    "Keywords": 0.16, "Formatting": 0.08, "Achievements": 0.08, "Readability": 0.06, "Action Verbs": 0.06,
}
SECTION_INFO = {
    "Contact Info": ("Contact details are incomplete or hard to parse.", "Add a professional email, phone, LinkedIn and city in the header."),
    "Summary": ("The profile summary is missing, generic or poorly sized.", "Write a 2-3 line summary with your target role, years of experience and top skills."),
    "Experience": ("Experience entries lack clear scope, dates or impact.", "Use reverse-chronological order with company, title, dates and 3-4 outcome-led bullets."),
    "Skills": ("Skills are not grouped or are missing core tools.", "Create a dedicated skills section grouped by category (languages, frameworks, cloud)."),
    "Education": ("Education details are missing institution, years or grades.", "List degree, institution, year and CGPA in a consistent format."),
    "Keywords": ("Few role-specific keywords were found compared with typical job descriptions.", "Mirror key skills and tools from the target job description using exact terms."),
    "Formatting": ("Missing standard headings or unusual characters may break ATS parsing.", "Use a single-column layout, standard headings and a common font."),
    "Achievements": ("Few quantified achievements were detected.", "Add metrics (%, amounts, time saved, users) to at least half of your bullet points."),
    "Readability": ("Long paragraphs or very short fragments reduce scan-ability.", "Keep bullets to one or two lines and limit the resume to one page where possible."),
    "Action Verbs": ("Many bullets start with weak or passive phrasing.", "Start bullets with strong verbs such as Built, Led, Optimised, Reduced, Delivered."),
}
STRONG_VERBS = set("""built developed designed led managed implemented created optimized optimised reduced increased improved delivered
launched automated architected engineered deployed analyzed analysed collaborated coordinated mentored streamlined trained
achieved drove spearheaded established integrated migrated resolved enhanced generated executed initiated owned planned produced
researched scaled secured simplified supervised tested transformed wrote authored configured debugged maintained modernized
negotiated presented published refactored standardized validated conducted contributed evaluated formulated identified
organized organised prepared proposed redesigned replaced restructured shipped strengthened unified upgraded visualized
accelerated applied assembled benchmarked carried compiled constructed customized defined demonstrated detected documented
drafted extracted fine-tuned fixed handled investigated leveraged modeled modelled monitored operated oversaw partnered
performed programmed provided reviewed trained tuned utilized""".split())
WEAK_STARTS = ("responsible for", "worked on", "helped", "assisted", "involved in", "duties included", "tasked with", "participated in")
BULLET_RE = re.compile(r"^\s*[•▪◦‣●○■□\-–—*·]\s*(.+)")
NUM_RE = re.compile(r"\d+(?:[.,]\d+)?\s?(?:%|x\b|k\b|m\b|\+|percent|lakh|crore|users|clients|customers|projects|requests|ms\b)|[$₹€£]\s?\d|\b\d{2,}\b")
CGPA_RE = re.compile(r"(?i)cgpa|gpa|percentage|\d\.\d{1,2}\s*/\s*10|\d{2}(?:\.\d+)?\s?%")


def get_bullets(text):
    secs = split_sections(text)
    body = "\n".join(secs.get(k, "") for k in ("experience", "projects"))
    out = []
    for line in (text or "").splitlines():
        m = BULLET_RE.match(line)
        if m and len(m.group(1).split()) >= 3:
            out.append(m.group(1).strip())
    if len(out) < 3:  # bullets without glyphs: sentence-like lines inside experience/projects
        for line in body.splitlines():
            s = line.strip()
            if len(s.split()) >= 6 and not RANGE_RE.search(s):
                out.append(s)
    seen, uniq = set(), []
    for b in out:
        if b.lower() not in seen:
            seen.add(b.lower()); uniq.append(b)
    return uniq


def _first_word(b):
    return re.sub(r"[^a-z\-]", "", (b.split() or [""])[0].lower())


def analyze_sections(text, parsed, target_role="", jd_text=""):
    parsed = parsed or {}
    text = text or ""
    secs = split_sections(text)
    bullets = get_bullets(text)
    words = len(text.split())
    skills = parsed.get("skills") or []
    exp = parsed.get("experience") or []
    edu = parsed.get("education") or []

    contact = (30 * bool(parsed.get("email") or find_email(text)) + 25 * bool(parsed.get("phone") or find_phone(text))
               + 15 * bool(parsed.get("name")) + 15 * bool(parsed.get("location")) + 15 * bool(URL_RE.search(text)))

    sw = len((secs.get("summary") or parsed.get("summary") or "").split())
    if secs.get("summary"):
        summary = 100 if 20 <= sw <= 90 else 75 if 8 <= sw <= 140 else 55
    else:
        summary = 55 if parsed.get("summary") else 30

    if exp:
        dated = sum(1 for e in exp if e.get("start"))
        exp_bul = len(get_bullets(secs.get("experience", ""))) if secs.get("experience") else len(bullets)
        experience = 35 + 15 * (len(exp) >= 2) + 25 * dated / len(exp) + (25 if exp_bul >= 4 else 12 if exp_bul else 0)
    else:
        experience = 35 if (secs.get("projects") or re.search(r"(?i)intern", text)) else 20

    n = len(skills)
    skills_sc = (15 if n == 0 else 40 if n <= 3 else 65 if n <= 6 else 82 if n <= 9 else 92) + (8 if secs.get("skills") else 0)

    if edu:
        education = 55 + 15 * any(e.get("institution") for e in edu) + 15 * any(e.get("end_year") for e in edu) + 15 * bool(CGPA_RE.search(secs.get("education", text)))
    else:
        education = 15

    src = f"{target_role} {jd_text}".strip()
    terms = [t for t, _ in Counter(tokenize(src)).most_common(25)] if src else []
    if terms:
        have = set(tokenize(text))
        keywords = 25 + 75 * sum(1 for t in terms if t in have) / len(terms)
    else:
        keywords = min(100, 35 + 5 * n)

    std = sum(1 for k in ("experience", "education", "skills", "summary", "projects") if k in secs)
    odd = len(re.findall(r"[^\x00-\x7F]", text)) / max(1, len(text))
    head_email = bool(find_email("\n".join(text.splitlines()[:12])))
    formatting = 15 * std + 15 * head_email + (10 if 200 <= words <= 1000 else 5 if 120 <= words <= 1300 else 0) - (20 if odd > 0.03 else 0)

    if bullets:
        with_num = sum(1 for b in bullets if NUM_RE.search(b))
        achievements = 25 + 175 * with_num / len(bullets)
        strong = sum(1 for b in bullets if _first_word(b) in STRONG_VERBS)
        weak = sum(1 for b in bullets if b.lower().startswith(WEAK_STARTS))
        verbs = 25 + 90 * strong / len(bullets) - 30 * weak / len(bullets)
        avg = sum(len(b.split()) for b in bullets) / len(bullets)
        readability = 60 + (20 if len(bullets) >= 5 else 0) + (20 if 8 <= avg <= 28 else 8)
    else:
        achievements, verbs, readability = 30, 40, 55
    long_lines = sum(1 for l in text.splitlines() if len(l.split()) > 55)
    readability -= min(30, 15 * long_lines)

    clamp = lambda v: int(round(max(0, min(100, v))))  # noqa: E731
    return {"Contact Info": clamp(contact), "Summary": clamp(summary), "Experience": clamp(experience),
            "Skills": clamp(skills_sc), "Education": clamp(education), "Keywords": clamp(keywords),
            "Formatting": clamp(formatting), "Achievements": clamp(achievements), "Readability": clamp(readability),
            "Action Verbs": clamp(verbs)}


def overall(sections):
    return int(round(sum(sections[k] * w for k, w in WEIGHTS.items())))


def grade(score):
    return "Excellent" if score >= 85 else "Good" if score >= 70 else "Average" if score >= 55 else "Needs work"


def distortion(text):
    odd = len(re.findall(r"[^\x00-\x7F]", text or "")) / max(1, len(text or ""))
    return "High distortion risk" if odd > 0.05 else "Minor distortion risk" if odd > 0.02 else "No distortion (Excellent)"


def fallback_feedback(sections, target_role=""):
    worst = sorted(sections.items(), key=lambda kv: kv[1])[:3]
    limitations = [f"{k}: {SECTION_INFO[k][0]}" for k, _ in worst]
    improvements = [SECTION_INFO[k][1] for k, _ in worst]
    if target_role:
        improvements.append(f'Tailor the headline and skills to "{target_role}" and include its must-have keywords.')
    return limitations, improvements


SECTION_WEIGHTS = WEIGHTS
score_sections = analyze_sections
