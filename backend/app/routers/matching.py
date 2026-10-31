"""Resume Matcher: rank resumes against an opportunity (or a pasted JD) and keep the ranking."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..config import settings
from ..database import get_db
from ..deps import get_current_user, get_owned
from ..models import Application, Opportunity, Resume, User
from ..schemas import MatchRunIn
from ..serializers import application_out, opp_out, resume_for_match, resume_out
from ..services.matching_service import match_resume

router = APIRouter(prefix="/api/matching", tags=["matching"])


def _opp_dict(o):
    return {"id": o.id, "code": o.code, "role": o.role, "must_skills": o.must_skills or [], "nice_skills": o.nice_skills or [],
            "experience": o.experience, "location": o.location, "mode": o.mode, "jd_text": o.jd_text}


@router.post("/run")
def run_matching(body: MatchRunIn, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """Score the chosen resumes. With an opportunity, each candidate also enters (or updates) that opportunity's pipeline."""
    ids = list(dict.fromkeys(body.resume_ids))
    if not ids:
        raise HTTPException(status_code=422, detail="Select at least one resume")
    if len(ids) > settings.max_match_batch:
        raise HTTPException(status_code=422, detail=f"Match at most {settings.max_match_batch} resumes at a time")
    opp = get_owned(db, Opportunity, body.opportunity_id, user.org_id, "Opportunity") if body.opportunity_id else None
    jd = (body.jd_text or "").strip() or (opp.jd_text if opp else "")
    if not opp and not jd:
        raise HTTPException(status_code=422, detail="Choose an opportunity or paste a job description")
    resumes = [get_owned(db, Resume, rid, user.org_id, "Resume") for rid in ids]

    results = []
    for r in resumes:
        report = match_resume(resume_for_match(r), _opp_dict(opp) if opp else {"jd_text": jd}, jd)
        app_id = stage = None
        if opp:
            app = db.scalar(select(Application).where(Application.opportunity_id == opp.id, Application.resume_id == r.id))
            if app is None:
                app = Application(org_id=user.org_id, opportunity_id=opp.id, resume_id=r.id, stage="screening")
                db.add(app)
            app.match_score, app.match_report = report["score"], report
            db.flush()
            app_id, stage = app.id, app.stage
        r.in_database = True  # the resume joins the Resume Database once its matching is complete
        r.last_match = {"opportunity_id": opp.id if opp else None, "code": opp.code if opp else None, "score": report["score"]}
        results.append({"application_id": app_id, "stage": stage, "resume": resume_out(r), "report": report})
    db.commit()
    results.sort(key=lambda x: x["report"]["score"], reverse=True)
    for i, x in enumerate(results, 1):
        x["rank"] = i
    return {"opportunity": opp_out(opp) if opp else None, "results": results, "ai_used": any(x["report"]["ai_used"] for x in results)}


@router.get("/{opportunity_id}")
def stored_ranking(opportunity_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """The saved ranking for an opportunity (used by Candidate Evaluation)."""
    opp = get_owned(db, Opportunity, opportunity_id, user.org_id, "Opportunity")
    rows = db.execute(
        select(Application, Resume).join(Resume, Resume.id == Application.resume_id)
        .where(Application.opportunity_id == opp.id, Application.org_id == user.org_id)
        .order_by(Application.match_score.desc().nulls_last(), Application.id)
    ).all()
    out = []
    for i, (a, r) in enumerate(rows, 1):
        item = application_out(a, r)
        item.update({"rank": i, "report": a.match_report})
        out.append(item)
    return {"opportunity": opp_out(opp), "results": out}
