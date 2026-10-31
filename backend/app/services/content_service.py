"""AI-written content: job descriptions and screening / technical-round questions (with templates as fallback)."""
from . import llm
from .questions import template_questions

SYSTEM = "You are an experienced technical recruiter. Return ONLY valid JSON."


def generate_jd(role, experience, must, nice, location, mode):
    prompt = (f'Write a concise, realistic job description for "{role}" ({experience or "experience as required"}), '
              f'{location or "flexible location"}, {mode or "flexible"} work mode.\n'
              f'Must-have skills: {", ".join(must) or "-"}. Nice-to-have: {", ".join(nice) or "-"}.\n'
              'Use sections: an intro sentence, "Responsibilities" (4-6 bullets starting with "• ") and "Requirements" (4-6 bullets starting with "• ").\n'
              'Return JSON: {"jd": "the full text with \\n line breaks"}')
    data = llm.ai_json(prompt, system=SYSTEM)
    if isinstance(data, dict) and str(data.get("jd") or "").strip():
        return str(data["jd"]).strip(), True
    sk = list(must) or ["relevant tools"]
    text = (f"We are hiring a {role or 'professional'} ({experience or 'experience as required'}) for our {location or 'team'} ({mode or 'flexible'} mode).\n\n"
            f"Responsibilities\n• Own delivery of key {role or 'role'} initiatives from design to production\n• Work hands-on with {', '.join(sk)}\n"
            f"• Collaborate with cross-functional teams and mentor peers\n\nRequirements\n• {experience or 'Relevant'} of hands-on experience\n"
            f"• Strong skills in {', '.join(sk[:3])}\n• Clear communication and problem-solving ability")
    return text, False


def screening_questions(role, must, nice, jd_text, count, shuffle=False):
    """Returns ([{question, hints}], ai_used)."""
    prompt = (f'Create {count} screening interview questions for the role "{role or "this role"}".\n'
              f'Must-have skills: {", ".join(must) or "-"}. Nice-to-have: {", ".join(nice) or "-"}.\n'
              f'Job description:\n{(jd_text or "-")[:3000]}\n'
              'Mix skill-specific, scenario-based and behavioural questions. For each question give 3-5 short answer-hint keywords.\n'
              'Return JSON: {"questions": [{"question": "", "hints": [""]}]}')
    data = llm.ai_json(prompt, system=SYSTEM, use_cache=not shuffle)
    out = []
    if isinstance(data, dict):
        for q in data.get("questions") or []:
            if isinstance(q, dict) and str(q.get("question") or "").strip():
                out.append({"question": str(q["question"]).strip(), "hints": [str(h) for h in (q.get("hints") or [])][:5]})
    if out:
        return out[:count], True
    return template_questions(role, must, nice, count, shuffle), False


def technical_questions(role, must, nice, jd_text, count=6):
    qs, ai = screening_questions(role, must, nice, jd_text, count)
    return [q["question"] for q in qs], ai
