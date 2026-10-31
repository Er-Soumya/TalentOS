"""Screening Questions: AI-generated questions (with answer hints) for an opportunity or a pasted JD."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import get_current_user, get_owned
from ..models import Opportunity, User
from ..schemas import ScreeningIn
from ..services.content_service import screening_questions

router = APIRouter(prefix="/api/screening", tags=["screening"])


@router.post("/generate")
def generate_questions(body: ScreeningIn, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    role, must, nice, jd = body.role, body.must_skills, body.nice_skills, body.jd_text
    if body.opportunity_id:
        o = get_owned(db, Opportunity, body.opportunity_id, user.org_id, "Opportunity")
        role, must, nice, jd = o.role, o.must_skills or [], o.nice_skills or [], jd or o.jd_text
    if not (role or must or jd.strip()):
        raise HTTPException(status_code=422, detail="Choose an opportunity (or provide a role / job description)")
    questions, ai = screening_questions(role, must, nice, jd, body.count, shuffle=body.regenerate)
    return {"questions": questions, "ai_used": ai}
