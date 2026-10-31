"""Question banks and template fallbacks (pure Python). Gemini versions live in question_service.py."""

HR_QUESTIONS = [
    "Tell us about yourself and what motivates your career choices.",
    "Why do you want to join our organization and this role?",
    "What are your key strengths and the areas you are working to improve?",
    "What are your salary expectations and notice period?",
    "How do you handle pressure and maintain work-life balance?",
    "Where do you see yourself in the next three to five years?",
]
MANAGERIAL_QUESTIONS = [
    "Describe a time you led a team through a difficult project.",
    "How do you resolve conflicts within a team?",
    "How do you prioritise and delegate tasks?",
    "How do you measure and improve team performance?",
    "Describe a decision you made with incomplete information.",
    "How do you give feedback to an underperforming team member?",
]


def template_screening(role, skills, n):
    """List of {question, hints}. Ported from the frontend's mock generator."""
    role = role or "this role"
    general = [
        {"question": f"Walk me through your most relevant project for the {role} role.", "hints": ["ownership", "architecture", "impact", "metrics"]},
        {"question": "Describe a time you had to learn a new technology quickly to deliver a task.", "hints": ["learning agility", "time management", "result"]},
        {"question": "How do you approach debugging a production issue under time pressure?", "hints": ["root cause", "logs", "rollback", "communication"]},
        {"question": "How do you ensure the quality and maintainability of your work?", "hints": ["code review", "testing", "documentation", "CI/CD"]},
        {"question": "Tell me about a disagreement with a teammate and how you resolved it.", "hints": ["collaboration", "empathy", "compromise"]},
        {"question": "How do you prioritise when multiple tasks have the same deadline?", "hints": ["prioritisation", "stakeholders", "trade-offs"]},
        {"question": f"Why are you interested in this {role} opportunity?", "hints": ["motivation", "company research", "career goals"]},
    ]
    skill_qs = []
    for s in skills or []:
        skill_qs.append({"question": f"Explain how you have used {s} in a real project. What challenges did you face?", "hints": [s, "project experience", "challenges", "outcome"]})
        skill_qs.append({"question": f"What are common pitfalls when working with {s}, and how do you avoid them?", "hints": [s, "best practices", "debugging", "performance"]})
    return ([general[0]] + skill_qs + general[1:])[:max(1, n)]


def template_jd(role, experience, skills, location, mode):
    sk = skills or ["relevant tools"]
    return (f"We are hiring a {role or 'professional'} ({experience or 'experience as required'}) for our {location or 'team'} ({mode or 'flexible'} mode).\n\n"
            f"Responsibilities\n• Own delivery of key {role or 'role'} initiatives from design to production\n• Work hands-on with {', '.join(sk)}\n"
            f"• Collaborate with cross-functional teams and mentor peers\n\nRequirements\n• {experience or 'Relevant'} of hands-on experience\n"
            f"• Strong skills in {', '.join(sk[:3])}\n• Clear communication and problem-solving ability")


def template_questions(role, must, nice, count, shuffle=False):
    """Fallback screening questions (skill-based + general). Same shape as the Gemini version."""
    import random
    skills = list(must or []) + list(nice or [])[:1]
    qs = template_screening(role, skills, 60)
    if shuffle and len(qs) > 2:
        head, rest = qs[0], qs[1:]
        random.shuffle(rest)
        qs = [head] + rest
    return qs[:max(1, count)]
