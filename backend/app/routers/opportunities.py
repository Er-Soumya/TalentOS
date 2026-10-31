"""Opportunity creation: CRUD, system-generated IDs, AI job-description generation / extraction."""
import os
import random
from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import get_current_user, get_owned
from ..models import Opportunity, User
from ..schemas import JdGenerateIn, OpportunityIn
from ..serializers import opp_out
from ..services.content_service import generate_jd
from ..services.matching_logic import years_range_from_label
from ..services.skills import canon, dedupe
from ..services.text_extract import extract_text

router = APIRouter(prefix="/api/opportunities", tags=["opportunities"])


def _new_code(db, org_id):
    year = date.today().year
    for _ in range(50):
        code = f"OPP-{year}-{random.randint(1000, 9999)}"
        if not db.scalar(select(Opportunity.id).where(Opportunity.org_id == org_id, Opportunity.code == code)):
            return code
    raise HTTPException(status_code=500, detail="Could not generate an opportunity ID")


def _apply(o, body):
    role = body.role.strip()
    must = dedupe(body.must_skills)
    if not role:
        raise HTTPException(status_code=422, detail="Required role is missing")
    if not must:
        raise HTTPException(status_code=422, detail="Add at least one must-have skill")
    lo, hi = years_range_from_label(body.experience)
    must_keys = {s.lower() for s in must}
    o.role, o.recruiter, o.experience = role, body.recruiter.strip(), body.experience.strip()
    o.min_years, o.max_years = lo, hi
    o.ctc, o.location, o.mode = body.ctc.strip(), body.location.strip(), body.mode.strip()
    o.positions, o.status = body.positions, body.status
    o.must_skills = must
    o.nice_skills = [s for s in dedupe(body.nice_skills) if canon(s).lower() not in must_keys]
    o.jd_text = body.jd_text.strip()


@router.get("/new-code")
def new_code(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """A free opportunity ID to show on the 'Create opportunity' page."""
    return {"code": _new_code(db, user.org_id)}


@router.get("")
def list_opportunities(status: Optional[str] = None, q: Optional[str] = None, db: Session = Depends(get_db),
                       user: User = Depends(get_current_user)):
    stmt = select(Opportunity).where(Opportunity.org_id == user.org_id).order_by(Opportunity.created_at.desc(), Opportunity.id.desc())
    if status:
        stmt = stmt.where(Opportunity.status == status)
    rows = db.scalars(stmt).all()
    if q:
        ql = q.lower()
        rows = [o for o in rows if ql in f"{o.code} {o.role} {o.recruiter} {o.location}".lower()]
    return [opp_out(o) for o in rows]


@router.post("", status_code=201)
def create_opportunity(body: OpportunityIn, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    code = (body.code or "").strip().upper()
    if not code or db.scalar(select(Opportunity.id).where(Opportunity.org_id == user.org_id, Opportunity.code == code)):
        code = _new_code(db, user.org_id)
    o = Opportunity(org_id=user.org_id, code=code)
    _apply(o, body)
    db.add(o)
    db.commit()
    db.refresh(o)
    return opp_out(o)


@router.get("/{opp_id}")
def get_opportunity(opp_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return opp_out(get_owned(db, Opportunity, opp_id, user.org_id, "Opportunity"))


@router.put("/{opp_id}")
def update_opportunity(opp_id: int, body: OpportunityIn, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    o = get_owned(db, Opportunity, opp_id, user.org_id, "Opportunity")
    _apply(o, body)
    db.commit()
    db.refresh(o)
    return opp_out(o)


@router.delete("/{opp_id}")
def delete_opportunity(opp_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    o = get_owned(db, Opportunity, opp_id, user.org_id, "Opportunity")
    db.delete(o)
    db.commit()
    return {"ok": True}


@router.post("/generate-jd")
def generate_job_description(body: JdGenerateIn, user: User = Depends(get_current_user)):
    text, ai = generate_jd(body.role, body.experience, body.must_skills, body.nice_skills, body.location, body.mode)
    return {"jd": text, "ai_used": ai}


@router.post("/extract-jd")
def extract_job_description(file: UploadFile = File(...), user: User = Depends(get_current_user)):
    """Upload a JD file (.pdf / .docx / .txt) and get its text back to show in the editor."""
    ext = os.path.splitext(file.filename or "")[1].lower()
    try:
        text = extract_text(file.file.read(), ext)
    except (ValueError, RuntimeError) as e:
        raise HTTPException(status_code=422, detail=str(e))
    return {"text": text}
