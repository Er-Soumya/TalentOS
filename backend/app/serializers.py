"""Turn database rows into the JSON the frontend receives."""


def iso(d):
    return d.isoformat() if d else None


def opp_out(o):
    return {"id": o.id, "code": o.code, "recruiter": o.recruiter, "role": o.role, "experience": o.experience,
            "ctc": o.ctc, "location": o.location, "mode": o.mode, "positions": o.positions, "status": o.status,
            "must_skills": o.must_skills or [], "nice_skills": o.nice_skills or [], "jd_text": o.jd_text,
            "created_on": iso(o.created_at.date()) if o.created_at else None}


def resume_out(r, full=False):
    out = {"id": r.id, "name": r.name, "email": r.email, "phone": r.phone, "location": r.location, "title": r.title,
           "summary": r.summary, "skills": r.skills or [], "education": r.education or [], "years": r.total_years,
           "file": r.filename, "uploaded": iso(r.uploaded_at.date()) if r.uploaded_at else None, "ats": r.ats_score,
           "last_match": r.last_match, "parsed_with": r.parsed_with, "in_database": r.in_database}
    if full:
        out.update({"experience": r.experience or [], "certifications": r.certifications or [], "ats_report": r.ats_report})
    return out


def resume_for_match(r):
    """The dict shape the matching service expects."""
    return {"name": r.name, "current_title": r.title, "total_years": r.total_years, "skills": r.skills or [],
            "education": r.education or [], "experience": r.experience or [], "location": r.location,
            "summary": r.summary, "text": r.text}


def resume_as_parsed(r):
    return {"name": r.name, "email": r.email, "phone": r.phone, "location": r.location, "summary": r.summary,
            "skills": r.skills or [], "education": r.education or [], "experience": r.experience or []}


def interview_out(i):
    return {"id": i.id, "application_id": i.application_id, "candidate": i.candidate_name, "role": i.role,
            "opportunity_code": i.opportunity_code, "date": iso(i.date), "time": i.time, "round": i.round,
            "link": i.meeting_link, "participants": i.participants or []}


def application_out(a, r=None):
    out = {"id": a.id, "opportunity_id": a.opportunity_id, "resume_id": a.resume_id, "stage": a.stage,
           "match_score": a.match_score}
    if r is not None:
        out["resume"] = resume_out(r)
    return out
