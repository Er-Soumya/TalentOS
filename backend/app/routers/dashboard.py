"""Numbers for the Overview and Dashboard pages."""
from datetime import date, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import get_current_user, get_owned
from ..models import Application, Interview, Opportunity, Resume, User
from ..serializers import interview_out, opp_out
from ..services.evaluation_logic import STAGES

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])
GROUPS = {"screening": ["screening"], "interviewed": ["interviewed"], "selected": ["selected"], "offered": ["offered"], "joined": ["joined"]}

def stage_counts(db, org_id, opp_id=None):
    stmt = select(Application.stage, func.count()).where(Application.org_id == org_id)
    if opp_id:
        stmt = stmt.where(Application.opportunity_id == opp_id)
    counts = {s: 0 for s in STAGES}
    for stage, n in db.execute(stmt.group_by(Application.stage)).all():
        if stage in counts:
            counts[stage] = n
    return counts


def upcoming(db, org_id, limit=10):
    stmt = select(Interview).where(Interview.org_id == org_id, Interview.date >= date.today()).order_by(Interview.date, Interview.time).limit(limit)
    return [interview_out(i) for i in db.scalars(stmt).all()]


def _per_opp_stage(db, org_id):
    """{opportunity_id: {stage: count}}"""
    out = {}
    for opp_id, stage, n in db.execute(select(Application.opportunity_id, Application.stage, func.count())
                                       .where(Application.org_id == org_id).group_by(Application.opportunity_id, Application.stage)).all():
        out.setdefault(opp_id, {})[stage] = n
    return out


@router.get("/overview")
def overview(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    org = user.org_id
    opps = db.scalars(select(Opportunity).where(Opportunity.org_id == org)).all()
    active = [o for o in opps if o.status == "Active"]
    counts = stage_counts(db, org)
    per = _per_opp_stage(db, org)
    filled = sum(per.get(o.id, {}).get("joined", 0) for o in active)
    today = date.today()
    week = db.scalar(select(func.count()).select_from(Interview).where(Interview.org_id == org, Interview.date >= today,
                                                                      Interview.date <= today + timedelta(days=7))) or 0
    total_upcoming = db.scalar(select(func.count()).select_from(Interview).where(Interview.org_id == org, Interview.date >= today)) or 0
    return {
        "stats": {"active_opportunities": len(active), "candidates_in_pipeline": sum(counts.values()),
                  "upcoming_interviews": total_upcoming, "offers_extended": counts["offered"] + counts["joined"]},
        "positions": {"open": sum(o.positions for o in active), "filled": filled, "active_roles": len(active)},
        "status_counts": {s: sum(1 for o in opps if o.status == s) for s in ("Active", "Hold", "Closed")},
        "by_mode": {m: sum(1 for o in opps if o.mode == m) for m in ("Onsite", "Hybrid", "Remote")},
        "interviews_this_week": week, "upcoming": upcoming(db, org, 5),
    }


@router.get("/recruiter")
def recruiter(limit: int = 10, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    org, limit = user.org_id, max(1, min(limit, 50))
    per = _per_opp_stage(db, org)
    rows = db.scalars(select(Opportunity).where(Opportunity.org_id == org).order_by(Opportunity.created_at.desc(), Opportunity.id.desc()).limit(limit)).all()
    recent = [{"id": o.id, "code": o.code, "role": o.role, "positions": o.positions, "status": o.status,
               "candidates": sum(n for s, n in per.get(o.id, {}).items() if s in STAGES)} for o in rows]
    return {"stages": stage_counts(db, org), "recent": recent, "upcoming": upcoming(db, org, 10)}


@router.get("/fulfilment")
def fulfilment(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    per = _per_opp_stage(db, user.org_id)
    rows = db.scalars(select(Opportunity).where(Opportunity.org_id == user.org_id).order_by(Opportunity.created_at.desc(), Opportunity.id.desc())).all()
    out = []
    for o in rows:
        c = per.get(o.id, {})
        out.append({"id": o.id, "code": o.code, "role": o.role, "ctc": o.ctc, "positions": o.positions, "status": o.status,
                                        "screening": c.get("screening", 0), "interviewed": c.get("interviewed", 0),
                                        "selected": c.get("selected", 0), "offered": c.get("offered", 0), "joined": c.get("joined", 0)})
    return out


@router.get("/fulfilment/{opp_id}/candidates")
def fulfilment_candidates(opp_id: int, group: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """The names behind a number on the Fulfilment page (the eye icon)."""
    if group not in GROUPS:
        raise HTTPException(status_code=422, detail="group must be screening, interviewed or offer")
    o = get_owned(db, Opportunity, opp_id, user.org_id, "Opportunity")
    rows = db.execute(select(Application, Resume).join(Resume, Resume.id == Application.resume_id)
                      .where(Application.opportunity_id == o.id, Application.stage.in_(GROUPS[group]))).all()
    return {"opportunity": opp_out(o), "group": group,
            "candidates": [{"application_id": a.id, "resume_id": r.id, "name": r.name, "stage": a.stage} for a, r in rows]}


@router.get("/fulfilment/{opp_id}/progress")
def fulfilment_progress(opp_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """Total progress of one opportunity (click on the opportunity ID)."""
    o = get_owned(db, Opportunity, opp_id, user.org_id, "Opportunity")
    counts = stage_counts(db, user.org_id, o.id)
    cands = db.execute(select(Application, Resume).join(Resume, Resume.id == Application.resume_id)
                       .where(Application.opportunity_id == o.id).order_by(Application.id)).all()
    joined = counts["joined"]
    return {"opportunity": opp_out(o), "positions": o.positions, "joined": joined, "remaining": max(o.positions - joined, 0),
            "progress_pct": min(round(joined / o.positions * 100), 100) if o.positions else 0, "stages": counts,
            "candidates": [{"application_id": a.id, "name": r.name, "stage": a.stage} for a, r in cands]}
