"""Pure matching maths (no third-party imports). Ported from the old backend's scoring model:
skills (must 80% / nice 20%), experience, education, location, title and semantic relevance."""
import math
import re
from collections import Counter

from . import skills as sk

WEIGHTS = {"skills": 0.40, "semantic": 0.25, "experience": 0.20, "education": 0.05, "location": 0.05, "title": 0.05}
STOP = set("""a an and are as at be by for from has have in into is it its of on or that the their this to was were will with
you your we our us they them he she i not but if then than also can may must should would about across over under using use
used work working experience experienced required requirements responsibilities responsibility ability strong good
knowledge skills skill team role candidate looking years year plus etc including include such per""".split())
LEVEL_WORDS = {"senior", "junior", "sr", "jr", "lead", "associate", "principal", "staff", "intern", "trainee"}


def tokenize(text):
    return [t for t in re.findall(r"[a-z][a-z0-9+#.]{1,}", (text or "").lower()) if t not in STOP and len(t) >= 3]


def lexical_similarity(a, b):
    """Cosine similarity of term-frequency vectors, 0..1 (fallback for AI relevance)."""
    ca, cb = Counter(tokenize(a)), Counter(tokenize(b))
    if not ca or not cb:
        return 0.0
    dot = sum(ca[t] * cb.get(t, 0) for t in ca)
    return dot / (math.sqrt(sum(v * v for v in ca.values())) * math.sqrt(sum(v * v for v in cb.values())))


def lexical_relevance(jd_text, resume_text):
    return int(max(0, min(100, round(lexical_similarity(jd_text, resume_text) * 220))))


def semantic_fallback(jd_text, role, resume_text):
    """Relevance 0-100 without AI: term-overlap between (role + JD) and the resume."""
    return float(lexical_relevance(f"{role}\n{jd_text}", resume_text))


def years_range_from_label(label):
    s = str(label or "")
    m = re.match(r"\s*(\d+)\s*\+", s)
    if m:
        return float(m.group(1)), None
    m = re.match(r"\s*(\d+)\s*(?:-|–|to)\s*(\d+)", s)
    if m:
        return float(m.group(1)), float(m.group(2))
    return 0.0, None


def years_range_from_text(jd_text):
    """Experience range mentioned in a JD, e.g. 'Minimum 5+ years', '3-5 years', 'at least 2 years'."""
    low = (jd_text or "").lower()
    m = re.search(r"(\d+)\s*(?:-|–|to)\s*(\d+)\s*\+?\s*years?", low)
    if m:
        return float(m.group(1)), float(m.group(2))
    m = re.search(r"(\d+)\s*\+?\s*years?", low)
    if m:
        return float(m.group(1)), None
    return 0.0, None


def required_education_level(jd_text):
    low = (jd_text or "").lower()
    if re.search(r"ph\.?\s?d|doctorate", low):
        return 4
    if re.search(r"master|m\.?\s?tech|\bmca\b|\bmba\b|m\.?\s?sc", low):
        return 3
    if re.search(r"bachelor|b\.?\s?tech|\bb\.?e\b|b\.?\s?sc|\bbca\b|degree", low):
        return 2
    return 0


# ------------------------------------------------------------------- skills
def match_skills(resume_skills, resume_text, must, nice):
    """Deterministic skill matching: exact/alias in the skills list, then alias mention anywhere in the text."""
    have = {sk.canon(s).lower() for s in resume_skills or []}
    low = (resume_text or "").lower()

    def check(lst):
        matched, missing, via = [], [], {}
        for s in sk.dedupe(lst):
            if s.lower() in have:
                matched.append(s); via[s] = "skills_list"
            elif sk.skill_in_text(s, low):
                matched.append(s); via[s] = "resume_text"
            else:
                missing.append(s)
        return matched, missing, via

    mm, mx, v1 = check(must)
    nm, nx, v2 = check(nice)
    return {"must_matched": mm, "must_missing": mx, "nice_matched": nm, "nice_missing": nx, "via": {**v1, **v2}}


def apply_skill_evidence(res, evidence):
    """Move skills the AI found evidence for from 'missing' to 'matched'. evidence: {skill: bool}."""
    ev = {sk.canon(k).lower(): bool(v) for k, v in (evidence or {}).items()}
    for m, x in (("must_matched", "must_missing"), ("nice_matched", "nice_missing")):
        keep = []
        for s in res[x]:
            if ev.get(s.lower()):
                res[m].append(s); res["via"][s] = "ai"
            else:
                keep.append(s)
        res[x] = keep
    return res


def skills_score(res):
    nm, nx = len(res["must_matched"]), len(res["must_missing"])
    im, ix = len(res["nice_matched"]), len(res["nice_missing"])
    must_pct = nm / (nm + nx) if nm + nx else None
    nice_pct = im / (im + ix) if im + ix else None
    if must_pct is None and nice_pct is None:
        return 50.0
    if must_pct is None:
        return nice_pct * 100
    if nice_pct is None:
        return must_pct * 100
    return (must_pct * 0.8 + nice_pct * 0.2) * 100


# --------------------------------------------------------- other components
def experience_score(years, min_y, max_y):
    """0-100. Unknown experience is neutral-low (40) instead of 0, over-qualification is only a small penalty."""
    if years is None:
        return 40.0
    lo = min_y or 0
    if years < lo:
        return max(0.0, years / lo * 100) if lo > 0 else 100.0
    if max_y is not None and years > max_y + 3:
        return max(70.0, 100 - (years - max_y - 3) * 5)
    return 100.0


def education_score(level, required):
    if not required:
        return 100.0
    if not level:
        return 40.0
    return 100.0 if level >= required else max(30.0, level / required * 90)


def location_score(cand, opp, mode):
    if str(mode or "").lower() == "remote" or not opp:
        return 100.0
    if not cand:
        return 60.0
    c, o = cand.lower(), opp.lower()
    if o in c or c in o or any(t in c for t in re.findall(r"[a-z]{3,}", o)):
        return 100.0
    return 40.0 if str(mode or "").lower() == "onsite" else 55.0


def title_score(titles, role):
    rt = {t for t in re.findall(r"[a-z]{2,}", (role or "").lower()) if t not in LEVEL_WORDS}
    titles = [t for t in titles if t]
    if not rt:
        return 60.0
    if not titles:
        return 50.0
    best = 0.0
    for t in titles:
        tt = set(re.findall(r"[a-z]{2,}", t.lower()))
        best = max(best, len(rt & tt) / len(rt))
    return best * 100


def combine(components):
    total = sum(components[k] * w for k, w in WEIGHTS.items())
    return int(round(max(0, min(100, total))))


def verdict(score):
    return "Strong match" if score >= 75 else "Good match" if score >= 60 else "Weak match"


def fallback_report(name, res, parts, years, min_y):
    """Deterministic strengths / concerns / summary used when Gemini is unavailable."""
    strengths, concerns = [], []
    total_must = len(res["must_matched"]) + len(res["must_missing"])
    if res["must_matched"]:
        strengths.append(f"Covers {len(res['must_matched'])} of {total_must} must-have skills: {', '.join(res['must_matched'][:6])}.")
    if res["nice_matched"]:
        strengths.append(f"Also brings nice-to-have skills: {', '.join(res['nice_matched'][:4])}.")
    if years is not None and parts.get("experience", 0) >= 90:
        strengths.append(f"{years} years of experience fits the required range.")
    if res["must_missing"]:
        concerns.append(f"Missing must-have skills: {', '.join(res['must_missing'][:6])}.")
    if years is None:
        concerns.append("Total experience could not be determined from the resume.")
    elif min_y and years < min_y:
        concerns.append(f"{years} years of experience is below the required {min_y:g}+ years.")
    if parts.get("location", 100) < 60:
        concerns.append("Candidate location may not match the opportunity location.")
    summary = (f"{name or 'The candidate'} covers {len(res['must_matched'])} of {total_must} must-have skills"
               f"{' and ' + str(len(res['nice_matched'])) + ' nice-to-have skill(s)' if res['nice_matched'] else ''}. "
               f"{'Gaps: ' + ', '.join(res['must_missing'][:5]) + '.' if res['must_missing'] else 'No critical skill gaps were found.'}")
    return {"summary": summary, "strengths": strengths, "concerns": concerns}
