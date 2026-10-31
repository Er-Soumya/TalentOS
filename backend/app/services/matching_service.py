"""Candidate <-> opportunity matching: deterministic scoring + one Gemini call for relevance and the narrative."""
from . import llm
from .matching_logic import (apply_skill_evidence, combine, education_score, experience_score, fallback_report,
                             location_score, match_skills, required_education_level, semantic_fallback, skills_score,
                             title_score, years_range_from_label, years_range_from_text)
from .resume_logic import education_level
from .skills import dedupe, find_skills_in_text

SYSTEM = ("You are a senior technical recruiter. Judge the candidate only on evidence in the resume data. "
          "Return ONLY valid JSON. Never invent facts.")

PROMPT = """ROLE: {role}
MUST-HAVE SKILLS: {must}
NICE-TO-HAVE SKILLS: {nice}
JOB DESCRIPTION:
{jd}

CANDIDATE
Name: {name} | Current title: {title} | Total experience: {years} years
Skills: {skills}
Experience: {experience}
Education: {education}
Resume excerpt:
{excerpt}

SKILLS NOT FOUND BY KEYWORD SEARCH (check whether the resume shows clear hands-on evidence of each): {unmatched}

Return JSON exactly like:
{{"relevance": 0-100 integer (overall fit of the candidate's real work to this role, ignoring years of experience),
  "summary": "two sentences for the recruiter",
  "strengths": ["up to 4 short items"],
  "concerns": ["up to 4 short items"],
  "skill_evidence": {{"<skill from the unmatched list>": true or false}}}}
"""


def _clamp_int(v, default=None):
    try:
        return int(max(0, min(100, round(float(v)))))
    except (TypeError, ValueError):
        return default


def _strs(v, n=4):
    return [str(x).strip() for x in (v or []) if str(x).strip()][:n] if isinstance(v, list) else []


def match_resume(resume, opp, jd_text=""):
    """resume: parsed dict (+ 'text'); opp: dict(role, must_skills, nice_skills, experience, location, mode) or None."""
    opp = opp or {}
    jd_text = jd_text or opp.get("jd_text") or ""
    role = opp.get("role") or ""
    nice = dedupe(opp.get("nice_skills") or [])
    must = dedupe(opp.get("must_skills") or []) or [s for s in find_skills_in_text(jd_text) if s not in nice]
    if opp.get("experience"):
        min_y, max_y = years_range_from_label(opp["experience"])
    else:
        min_y, max_y = years_range_from_text(jd_text)

    text = resume.get("text") or ""
    years = resume.get("total_years")
    res = match_skills(resume.get("skills"), text, must, nice)

    ai = None
    if llm.is_enabled():
        unmatched = res["must_missing"] + res["nice_missing"]
        exp = "; ".join(f"{e.get('title', '')} at {e.get('company', '')} ({e.get('start', '')}-{e.get('end', '')}): {e.get('description', '')}"
                        for e in (resume.get("experience") or [])[:6])
        edu = "; ".join(e.get("degree", "") for e in (resume.get("education") or [])[:3])
        data = llm.ai_json(PROMPT.format(
            role=role or "(not specified)", must=", ".join(must) or "-", nice=", ".join(nice) or "-", jd=jd_text[:4000] or "-",
            name=resume.get("name") or "-", title=resume.get("current_title") or resume.get("title") or "-",
            years=years if years is not None else "unknown", skills=", ".join((resume.get("skills") or [])[:40]) or "-",
            experience=exp or "-", education=edu or "-", excerpt=text[:5000], unmatched=", ".join(unmatched) or "none"),
            system=SYSTEM)
        if isinstance(data, dict):
            ai = data
            if unmatched and isinstance(data.get("skill_evidence"), dict):
                res = apply_skill_evidence(res, {k: v for k, v in data["skill_evidence"].items() if k in unmatched or k.lower() in {u.lower() for u in unmatched}})

    titles = [resume.get("current_title") or resume.get("title")] + [e.get("title") for e in (resume.get("experience") or [])]
    relevance = _clamp_int(ai.get("relevance")) if ai else None
    parts = {
        "skills": skills_score(res),
        "semantic": float(relevance) if relevance is not None else semantic_fallback(jd_text, role, text),
        "experience": experience_score(years, min_y, max_y),
        "education": education_score(education_level(resume.get("education")), required_education_level(jd_text)),
        "location": location_score(resume.get("location"), opp.get("location"), opp.get("mode")),
        "title": title_score(titles, role),
    }
    score = combine(parts)
    rep = fallback_report(resume.get("name"), res, parts, years, min_y)
    if ai:
        rep = {"summary": str(ai.get("summary") or rep["summary"]).strip(), "strengths": _strs(ai.get("strengths")) or rep["strengths"],
               "concerns": _strs(ai.get("concerns")) or rep["concerns"]}
    return {
        "score": score, "breakdown": {k: int(round(v)) for k, v in parts.items()},
        "skill_pct": int(round(parts["skills"])), "exp_fit": int(round(parts["experience"])),
        "must_matched": res["must_matched"], "must_missing": res["must_missing"],
        "nice_matched": res["nice_matched"], "nice_missing": res["nice_missing"], "matched_via": res["via"],
        "years": years, "required_years": {"min": min_y, "max": max_y},
        "summary": rep["summary"], "strengths": rep["strengths"], "concerns": rep["concerns"], "ai_used": ai is not None,
    }
