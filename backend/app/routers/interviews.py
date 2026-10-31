"""Interview scheduling (feeds the calendar and 'upcoming interviews')."""
import re
from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import get_current_user, get_owned
from ..models import Application, Interview, Opportunity, Resume, User
from ..schemas import InterviewIn
from ..serializers import interview_out

router = APIRouter(prefix="/api/interviews", tags=["interviews"])
TIME_RE = re.compile(r"([01]\d|2[0-3]):[0-5]\d")


@router.post("", status_code=201)
def schedule_interview(body: InterviewIn, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    try:
        day = date.fromisoformat(body.date)
    except ValueError:
        raise HTTPException(status_code=422, detail="Date must be YYYY-MM-DD")
    if not TIME_RE.fullmatch(body.time):
        raise HTTPException(status_code=422, detail="Time must be HH:MM (24-hour)")
    name, role, code, app_id = body.candidate_name.strip(), body.role.strip(), "", None
    opp = get_owned(db, Opportunity, body.opportunity_id, user.org_id, "Opportunity") if body.opportunity_id else None
    if opp:
        role, code = role or opp.role, opp.code
    if body.resume_id:
        r = get_owned(db, Resume, body.resume_id, user.org_id, "Resume")
        name = name or r.name
        if opp:
            app = db.scalar(select(Application).where(Application.opportunity_id == opp.id, Application.resume_id == r.id))
            app_id = app.id if app else None
    if not name:
        raise HTTPException(status_code=422, detail="Candidate name is required")
    iv = Interview(org_id=user.org_id, application_id=app_id, candidate_name=name, role=role, opportunity_code=code, date=day,
                   time=body.time, round=body.round or "Technical round", meeting_link=body.meeting_link.strip(),
                   participants=[p.strip() for p in body.participants if p.strip()])
    db.add(iv)
    db.commit()
    db.refresh(iv)
    return interview_out(iv)


@router.get("")
def list_interviews(from_date: Optional[str] = None, to_date: Optional[str] = None, db: Session = Depends(get_db),
                    user: User = Depends(get_current_user)):
    stmt = select(Interview).where(Interview.org_id == user.org_id)
    try:
        if from_date:
            stmt = stmt.where(Interview.date >= date.fromisoformat(from_date))
        if to_date:
            stmt = stmt.where(Interview.date <= date.fromisoformat(to_date))
    except ValueError:
        raise HTTPException(status_code=422, detail="Dates must be YYYY-MM-DD")
    return [interview_out(i) for i in db.scalars(stmt.order_by(Interview.date, Interview.time)).all()]


@router.delete("/{iid}")
def delete_interview(iid: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    db.delete(get_owned(db, Interview, iid, user.org_id, "Interview"))
    db.commit()
    return {"ok": True}
