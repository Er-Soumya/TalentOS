"""Resume text -> structured profile. Gemini reads the resume; our code validates it and computes the years."""
from datetime import date

from . import llm
from .resume_logic import heuristic_parse, normalize_parsed
from .skills import dedupe, find_skills_in_text

SYSTEM = ("You are a precise resume parser. Return ONLY valid JSON. Never invent facts: if something is not in the "
          "resume use an empty string or empty list.")

PROMPT = """Extract this resume into JSON with exactly this shape:
{{
  "name": "", "email": "", "phone": "", "location": "", "current_title": "", "summary": "",
  "skills": ["tools, technologies and technical competencies only"],
  "education": [{{"degree": "e.g. B.Tech", "field": "e.g. Computer Science", "institution": "", "start_year": "YYYY", "end_year": "YYYY"}}],
  "experience": [{{"title": "", "company": "", "type": "job|internship|freelance", "start": "YYYY-MM", "end": "YYYY-MM or present", "description": "one or two sentences"}}],
  "certifications": [""],
  "total_years_estimate": null
}}
Rules:
- "experience" lists paid jobs, internships and freelance work only. Do NOT include academic projects or education.
- Dates: use YYYY-MM when the month is known, otherwise YYYY. Use "present" for a current role.
- "summary": at most two factual sentences taken from the resume.
- "skills": at most 60 items, no soft-skill filler, no duplicates.
- "total_years_estimate": your best guess in years, or null if unclear (it is only a backup).

RESUME:
{resume}
"""


def parse_resume(text, today=None):
    today = today or date.today()
    raw, used = None, "heuristic"
    if llm.is_enabled():
        data = llm.ai_json(PROMPT.format(resume=text[:16000]), system=SYSTEM)
        if isinstance(data, dict):
            raw, used = data, "ai"
            raw["skills"] = dedupe([x for x in (raw.get("skills") or []) if isinstance(x, str)] + find_skills_in_text(text))
    if raw is None:
        raw = heuristic_parse(text, today)
    parsed = normalize_parsed(raw, text, today)
    parsed["parsed_with"] = used
    return parsed
