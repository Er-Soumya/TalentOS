"""Pure resume-parsing helpers (no third-party imports): sections, dates, experience years,
education, contact details and a heuristic parser used when Gemini is unavailable."""
import calendar
import re
from datetime import date

from . import skills as sk

EMAIL_RE = re.compile(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}")
PHONE_CAND_RE = re.compile(r"\+?\d[\d\s().-]{8,16}\d")
URL_RE = re.compile(r"(?:https?://|www\.)\S+|(?:linkedin\.com|github\.com)/\S+", re.I)
CITIES = ["Bhubaneswar", "Bengaluru", "Bangalore", "Hyderabad", "Pune", "Chennai", "Kolkata", "Mumbai", "Delhi",
          "New Delhi", "Gurgaon", "Gurugram", "Noida", "Ahmedabad", "Cuttack", "Jaipur", "Kochi", "Remote"]

# ----------------------------------------------------------------- sections
SECTION_KEYS = [
    ("projects", ("project",)),
    ("certifications", ("certificat", "licens", "courses")),
    ("summary", ("summary", "objective", "profile", "about me")),
    ("skills", ("skill", "competenc", "expertise", "technologies", "tech stack", "tools")),
    ("experience", ("experience", "employment", "work history", "professional background", "internship", "career history")),
    ("education", ("education", "academic", "qualification")),
    ("other", ("achievement", "award", "honor", "language", "interest", "hobb", "reference", "declaration",
               "publication", "extracurricular", "volunteer", "contact", "personal")),
]


def heading_of(line):
    s = line.strip().strip(":-–—|•*#\t ")
    if not s or len(s) > 40 or len(s.split()) > 5 or re.search(r"\d{3,}", s):
        return None
    low = s.lower()
    if not (s.isupper() or s.istitle() or line.strip().endswith(":") or low == s):
        return None
    for name, keys in SECTION_KEYS:
        if any(k in low for k in keys):
            return name
    return None


def split_sections(text):
    sections, current, buf = {}, "header", []
    for line in (text or "").splitlines():
        h = heading_of(line)
        if h:
            sections[current] = (sections.get(current, "") + "\n" + "\n".join(buf)).strip()
            current, buf = h, []
        else:
            buf.append(line)
    sections[current] = (sections.get(current, "") + "\n" + "\n".join(buf)).strip()
    return {k: v for k, v in sections.items() if v}


# -------------------------------------------------------------------- dates
_MON = r"(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.?,?\s+\d{4}"
DATE_TOKEN = rf"(?:{_MON}|\d{{1,2}}[/\-.]\d{{4}}|\d{{4}})"
PRESENT = r"present|current|now|ongoing|till date|to date|today"
RANGE_RE = re.compile(rf"({DATE_TOKEN})\s*(?:-|–|—|to|until|till)\s*({DATE_TOKEN}|{PRESENT})", re.I)
_MONTHS = {m: i + 1 for i, m in enumerate(["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"])}


def parse_date_token(tok, end=False, today=None):
    today = today or date.today()
    t = str(tok or "").strip().lower().rstrip(".,")
    if not t:
        return None
    if re.fullmatch(PRESENT, t):
        return today
    y = m = None
    mm = re.match(r"([a-z]{3})[a-z]*\.?,?\s+(\d{4})$", t)
    if mm and mm.group(1) in _MONTHS:
        m, y = _MONTHS[mm.group(1)], int(mm.group(2))
    else:
        mm = re.match(r"(\d{1,2})[/\-.](\d{4})$", t) or re.match(r"(\d{4})[/\-.](\d{1,2})$", t)
        if mm:
            a, b = int(mm.group(1)), int(mm.group(2))
            m, y = (a, b) if b > 1900 else (b, a)
        elif re.fullmatch(r"\d{4}", t):
            y = int(t)
    if y is None or not (1970 <= y <= today.year + 1) or (m is not None and not 1 <= m <= 12):
        return None
    if m is None:
        d = date(y, 12, 31) if end else date(y, 1, 1)
    else:
        d = date(y, m, calendar.monthrange(y, m)[1]) if end else date(y, m, 1)
    return min(d, today) if end else d


def merge_ranges(ranges, today=None):
    """Total years covered by (start, end) date pairs, merging overlaps."""
    today = today or date.today()
    spans = sorted((s, min(e, today)) for s, e in ranges if s and e and s <= e and s <= today)
    merged = []
    for s, e in spans:
        if merged and s <= merged[-1][1]:
            merged[-1][1] = max(merged[-1][1], e)
        else:
            merged.append([s, e])
    days = sum((e - s).days + 1 for s, e in merged)
    return round(days / 365.25, 1)


def entries_years(entries, today=None):
    """Years of experience from structured entries [{start, end, ...}]. None if no usable dates."""
    ranges = []
    for e in entries or []:
        s = parse_date_token(e.get("start"), end=False, today=today)
        en = parse_date_token(e.get("end") or "present", end=True, today=today)
        if s and en:
            ranges.append((s, en))
    return merge_ranges(ranges, today) if ranges else None


# ---------------------------------------------------------------- education
DEG_I = {
    4: r"\b(?:ph\.?\s?d|doctorate)\b",
    3: r"\b(?:m\.?\s?tech|master(?:'s|s)?(?: of [a-z ]+)?|m\.?\s?sc|mca|mba|m\.?\s?com)\b",
    2: r"\b(?:b\.?\s?tech|bachelor(?:'s|s)?(?: of [a-z ]+)?|b\.?\s?sc|bca|bba|b\.?\s?com)\b",
    1: r"\b(?:diploma|polytechnic)\b",
}
# short forms that are only accepted in capitals / with dots (so "me" or "be" in normal text never match)
DEG_C = {
    3: r"\b(?:M\.E\.?|M\.S\.?|M\.A\.?)(?![A-Za-z])|\b(?:ME|MS)(?=\s+(?:in|-|–|\(|,))",
    2: r"\b(?:B\.E\.?|B\.S\.?|B\.A\.?)(?![A-Za-z])|\b(?:BE|BS)(?=\s+(?:in|-|–|\(|,))",
}
INST_RE = re.compile(r"universit|institute|college|school|academy|polytechnic|\biit\b|\bnit\b|\biiit\b", re.I)
YEAR_RE = re.compile(r"\b(19[89]\d|20[0-3]\d)\b")


def highest_degree(text):
    """(level, matched text) of the highest degree in the text. Levels: 0 none, 1 diploma, 2 bachelor, 3 master, 4 phd."""
    text = text or ""
    for lvl in (4, 3, 2, 1):
        m = re.search(DEG_I[lvl], text, re.I) or (re.search(DEG_C[lvl], text) if lvl in DEG_C else None)
        if m:
            return lvl, m.group(0).strip()
    return 0, ""


def degree_level(text):
    return highest_degree(text)[0]


def education_level(education):
    """Highest level among stored education entries (each has a 'level')."""
    return max([int(e.get("level") or 0) for e in (education or []) if isinstance(e, dict)] or [0])


def parse_education(text):
    sec = split_sections(text).get("education") or text or ""
    lines = [l.strip() for l in sec.splitlines() if l.strip()]
    out = []
    for i, line in enumerate(lines):
        lvl = degree_level(line)
        if not lvl:
            continue
        near = " ".join(lines[max(0, i - 1): i + 2])
        inst = next((l for l in (lines[i], *(lines[i - 1:i] if i else []), *lines[i + 1:i + 2]) if INST_RE.search(l)), "")
        if inst == line and "," in line:  # degree and institution on one line: "B.Tech in CS, XYZ University 2018 - 2022"
            inst = YEAR_RE.sub("", line.split(",", 1)[1]).strip(" -–—|,")
        years = YEAR_RE.findall(near)
        out.append({
            "degree": line[:140], "level": lvl, "institution": inst[:140],
            "start_year": int(years[0]) if len(years) > 1 else None,
            "end_year": int(years[-1]) if years else None,
        })
    return out[:6]


# ------------------------------------------------------------------ contact
def extract_email(text):
    m = EMAIL_RE.search(text or "")
    return m.group(0) if m else ""


def extract_phone(text):
    for m in PHONE_CAND_RE.finditer(text or ""):
        raw = m.group(0)
        digits = re.sub(r"\D", "", raw)
        if len(YEAR_RE.findall(raw)) >= 2:
            continue
        if len(digits) == 10 and digits[0] in "6789" or (11 <= len(digits) <= 13 and (raw.strip().startswith("+") or digits.startswith(("91", "0")))):
            return raw.strip()
    return ""


def guess_name(text):
    for line in (text or "").splitlines()[:8]:
        s = line.strip()
        if not s or "@" in s or re.search(r"\d", s) or URL_RE.search(s):
            continue
        words = s.replace(",", " ").split()
        if not 2 <= len(words) <= 4 or not all(re.fullmatch(r"[A-Za-z.'-]+", w) for w in words):
            continue
        if re.search(r"resume|curriculum|vitae|profile|summary|objective|contact|engineer|developer", s, re.I):
            continue
        return " ".join(w.capitalize() if w.isupper() else w for w in words)
    return ""


def guess_location(text):
    head = "\n".join((text or "").splitlines()[:15])
    m = re.search(r"(?i)location\s*[:\-]\s*([A-Za-z ,]+)", head)
    if m:
        return m.group(1).strip()[:60]
    for c in CITIES:
        if re.search(rf"\b{re.escape(c)}\b", head, re.I):
            return c
    return ""


# ----------------------------------------------------- heuristic experience
def experience_entries_from_text(text, today=None):
    secs = split_sections(text)
    body = secs.get("experience")
    if not body:
        body = "\n".join(v for k, v in secs.items() if k not in ("education", "projects", "certifications", "skills"))
    lines = body.splitlines()
    entries = []
    for i, line in enumerate(lines):
        m = RANGE_RE.search(line)
        if not m:
            continue
        label = RANGE_RE.sub("", line).strip(" -–—|,:()")
        if not label and i:
            label = next((l.strip() for l in reversed(lines[:i]) if l.strip()), "")
        title, company = label, ""
        if " at " in label:
            title, company = [p.strip() for p in label.split(" at ", 1)]
        entries.append({"title": title[:120], "company": company[:120], "start": m.group(1), "end": m.group(2), "description": ""})
    return entries[:12]


def heuristic_parse(text, today=None):
    secs = split_sections(text)
    skills_found = sk.find_skills_in_text(text)
    if secs.get("skills"):
        listed = [t.strip() for t in re.split(r"[,\n;|•·▪]", secs["skills"]) if 1 < len(t.strip()) <= 30]
        skills_found = sk.dedupe([*skills_found, *listed])[:60]
    entries = experience_entries_from_text(text, today)
    certs = [l.strip(" -•▪") for l in secs.get("certifications", "").splitlines() if l.strip()][:8]
    return {
        "name": guess_name(text), "email": extract_email(text), "phone": extract_phone(text),
        "location": guess_location(text), "title": entries[0]["title"] if entries else "",
        "summary": " ".join(secs.get("summary", "").split())[:500],
        "skills": skills_found, "education": parse_education(text), "experience": entries,
        "certifications": certs, "total_years": entries_years(entries, today),
    }


# --------------------------------------------------- normalise any parse result
def _s(v, n=200):
    return str(v).strip()[:n] if v is not None else ""


def normalize_parsed(raw, text, today=None):
    """Clean a (LLM or heuristic) parse result into the shape stored in the database."""
    raw = raw if isinstance(raw, dict) else {}
    experience = []
    for e in raw.get("experience") or []:
        if not isinstance(e, dict):
            continue
        if _s(e.get("type")).lower() in ("project", "education", "course"):
            continue
        experience.append({
            "title": _s(e.get("title"), 120), "company": _s(e.get("company"), 120),
            "start": _s(e.get("start"), 30), "end": _s(e.get("end"), 30),
            "description": _s(e.get("description"), 600),
        })
    education = []
    for e in raw.get("education") or []:
        if not isinstance(e, dict):
            continue
        deg = _s(e.get("degree"), 140)
        field = _s(e.get("field"), 100)
        lvl = degree_level(f"{deg} {field}")
        ys = lambda k: int(e[k]) if str(e.get(k) or "").isdigit() else None  # noqa: E731
        education.append({"degree": f"{deg} {field}".strip(), "level": lvl, "institution": _s(e.get("institution"), 140),
                          "start_year": ys("start_year"), "end_year": ys("end_year")})
    years = entries_years(experience, today)
    if years is None:
        hint = raw.get("total_years_estimate", raw.get("total_years"))
        try:
            hint = float(hint) if hint not in (None, "") else None
        except (TypeError, ValueError):
            hint = None
        years = hint if hint is not None and 0 <= hint <= 50 else entries_years(experience_entries_from_text(text, today), today)
    all_skills = sk.dedupe([x for x in (raw.get("skills") or []) if isinstance(x, str)])[:80]
    return {
        "name": _s(raw.get("name"), 120) or guess_name(text),
        "email": extract_email(text) or _s(raw.get("email"), 120),
        "phone": extract_phone(text) or _s(raw.get("phone"), 40),
        "location": _s(raw.get("location"), 80) or guess_location(text),
        "current_title": _s(raw.get("title") or raw.get("current_title"), 120) or (experience[0]["title"] if experience else ""),
        "summary": _s(raw.get("summary"), 600),
        "skills": all_skills, "education": education[:6] or parse_education(text),
        "experience": experience[:15], "certifications": [_s(c, 120) for c in (raw.get("certifications") or [])][:10],
        "total_years": years,
    }


merge_years = merge_ranges
find_email = extract_email
find_phone = extract_phone
