"""ATS report: deterministic section scores + (optional) Gemini keyword alignment and written feedback."""
from . import llm
from .ats_logic import WEIGHTS, analyze_sections, fallback_feedback, grade, overall

SYSTEM = "You are an ATS (applicant tracking system) and resume expert. Return ONLY valid JSON. Never invent facts."
PROMPT = """Review this resume for ATS-readiness{role_part}.
Return JSON exactly like:
{{"keyword_alignment": 0-100 integer (how well the resume's wording matches what an ATS/recruiter would look for{role_hint}),
  "strengths": ["2-3 short items"],
  "limitations": ["3-5 specific problems actually visible in this resume"],
  "improvements": ["3-5 concrete, actionable fixes"]}}

RESUME:
{resume}
"""


def _lines(v, n=5):
    return [str(x).strip() for x in v if str(x).strip()][:n] if isinstance(v, list) else []


def run_ats(text, parsed, target_role="", jd_text=""):
    sections = analyze_sections(text, parsed, target_role, jd_text)
    ai = None
    if llm.is_enabled():
        role_part = f' for the target role "{target_role}"' if target_role else ""
        data = llm.ai_json(PROMPT.format(role_part=role_part, role_hint=" for that role" if target_role else "", resume=text[:12000]), system=SYSTEM)
        if isinstance(data, dict):
            ai = data
    if ai:
        try:
            kw = max(0, min(100, int(round(float(ai.get("keyword_alignment"))))))
            sections["Keywords"] = int(round(0.5 * sections["Keywords"] + 0.5 * kw))
        except (TypeError, ValueError):
            pass
    score = overall(sections)
    lim, imp = fallback_feedback(sections, target_role)
    strengths = []
    if ai:
        lim, imp, strengths = _lines(ai.get("limitations")) or lim, _lines(ai.get("improvements")) or imp, _lines(ai.get("strengths"), 3)
    return {
        "score": score, "grade": grade(score),
        "sections": [{"label": k, "score": sections[k]} for k in WEIGHTS],
        "limitations": lim, "improvements": imp, "strengths": strengths,
        "distortion": "No distortion (Excellent)" if score >= 60 else "Minor distortion risk",
        "target_role": target_role, "ai_used": ai is not None,
    }
