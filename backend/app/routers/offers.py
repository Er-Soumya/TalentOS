"""Offers & Joining: candidates who completed all three rounds get an offer (the HR sends it), then are marked as joined."""
from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import get_current_user, get_owned
from ..models import Application, Evaluation, Opportunity, Resume, User
from ..serializers import iso, resume_out
from ..services.evaluation_logic import ROUNDS, offer_action, summarize

router = APIRouter(prefix="/api/offers", tags=["offers"])
COLUMNS = ("selected", "offered", "joined")


@router.get("")
def list_offers(opportunity_id: Optional[int] = None, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """Three lists for one page: selected (ready for an offer), offered, joined."""
    stmt = (select(Application, Resume, Opportunity)
            .join(Resume, Resume.id == Application.resume_id).join(Opportunity, Opportunity.id == Application.opportunity_id)
            .where(Application.org_id == user.org_id, Application.stage.in_(COLUMNS)))
    if opportunity_id:
        stmt = stmt.where(Application.opportunity_id == opportunity_id)
    rows = db.execute(stmt.order_by(Application.updated_at.desc())).all()
    rounds = {}
    ids = [a.id for a, _, _ in rows]
    if ids:
        for ev in db.scalars(select(Evaluation).where(Evaluation.application_id.in_(ids))).all():
            rounds.setdefault(ev.application_id, {})[ev.round] = ev.score
    out = {c: [] for c in COLUMNS}
    for a, r, o in rows:
        rs = rounds.get(a.id, {})
        s = summarize(a.match_score, r.ats_score, rs)
        out[a.stage].append({
            "application_id": a.id, "stage": a.stage, "opportunity_id": o.id, "opportunity_code": o.code, "role": o.role,
            "ctc": o.ctc, "resume": resume_out(r), "match": a.match_score, "ats": r.ats_score,
            "rounds": {k: round(v, 1) for k, v in rs.items()}, "rounds_done": [k for k in ROUNDS if k in rs],
            "overall": s["overall"], "recommended": s["recommended"],
            "can_send_offer": a.stage == "selected" and all(k in rs for k in ROUNDS),
            "offered_on": iso(a.offered_on), "joined_on": iso(a.joined_on),
        })
    return out


def _act(db, user, app_id, action):
    a = get_owned(db, Application, app_id, user.org_id, "Application")
    done = db.scalars(select(Evaluation.round).where(Evaluation.application_id == a.id)).all()
    try:
        new_stage = offer_action(a.stage, action, set(done))
    except ValueError as e:
        raise HTTPException(status_code=409, detail=str(e))
    a.stage = new_stage
    if new_stage == "offered":
        a.offered_on = date.today()
    elif new_stage == "joined":
        a.joined_on = date.today()
    db.commit()
    return {"application_id": a.id, "stage": a.stage, "offered_on": iso(a.offered_on), "joined_on": iso(a.joined_on)}


@router.post("/{app_id}/send")
def send_offer(app_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """The HR sends the offer. Only candidates who completed HR, Technical and Managerial rounds can receive it."""
    return _act(db, user, app_id, "send")


@router.post("/{app_id}/join")
def confirm_joining(app_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """The HR confirms that the candidate has joined."""
    return _act(db, user, app_id, "join")


@router.post("/{app_id}/decline")
def decline(app_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """The offer was declined (or the candidate will not be offered): the candidate is marked as rejected."""
    return _act(db, user, app_id, "decline")