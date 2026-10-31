"""Candidate Evaluation: HR / Technical / Managerial rounds, summary with recommendation, go-ahead decision."""
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import get_current_user, get_owned
from ..models import Application, Evaluation, Opportunity, Resume, User
from ..schemas import DecisionIn, EvaluationIn
from ..serializers import iso, opp_out, resume_out
from ..services.content_service import technical_questions
from ..services.evaluation_logic import ROUNDS, next_stage, rating_label, score_ratings, summarize
from ..services.questions import HR_QUESTIONS, MANAGERIAL_QUESTIONS, template_questions

router = APIRouter(prefix="/api/evaluations", tags=["evaluations"])
N_QUESTIONS = 6  # every round has exactly 6 questions


def round_questions(round_, opp):
    """(questions, ai_used). HR / managerial are fixed lists; technical questions come from the opportunity (Gemini)."""
    if round_ == "hr":
        return HR_QUESTIONS[:N_QUESTIONS], False
    if round_ == "managerial":
        return MANAGERIAL_QUESTIONS[:N_QUESTIONS], False
    must, nice = opp.must_skills or [], opp.nice_skills or []
    qs, ai = technical_questions(opp.role, must, nice, opp.jd_text or "", N_QUESTIONS)
    if len(qs) < N_QUESTIONS:  # always return exactly 6
        extra = [q["question"] for q in template_questions(opp.role, must, nice, 30) if q["question"] not in qs]
        qs = (qs + extra)[:N_QUESTIONS]
    return qs[:N_QUESTIONS], ai


def build_summary(db, app):
    opp, r = db.get(Opportunity, app.opportunity_id), db.get(Resume, app.resume_id)
    evs = db.scalars(select(Evaluation).where(Evaluation.application_id == app.id)).all()
    rounds = {e.round: e.score for e in evs}
    s = summarize(app.match_score, r.ats_score, rounds)
    return {"application_id": app.id, "opportunity_code": opp.code, "role": opp.role, "candidate": r.name,
            "match": app.match_score, "ats": r.ats_score, "stage": app.stage,
            "rounds": [{"round": k, "score": round(v, 1), "rating": rating_label(v)} for k, v in rounds.items()], **s}


@router.get("/questions")
def questions(round: str, opportunity_id: Optional[int] = None, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    if round not in ROUNDS:
        raise HTTPException(status_code=422, detail="round must be hr, technical or managerial")
    opp = None
    if round == "technical":
        if not opportunity_id:
            raise HTTPException(status_code=422, detail="opportunity_id is required for the technical round")
        opp = get_owned(db, Opportunity, opportunity_id, user.org_id, "Opportunity")
    qs, ai = round_questions(round, opp)
    return {"round": round, "questions": qs, "ai_used": ai}


@router.get("/candidates")
def ranked_candidates(opportunity_id: int, round: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """Candidates of an opportunity in match-rank order, with their status for the chosen round."""
    if round not in ROUNDS:
        raise HTTPException(status_code=422, detail="round must be hr, technical or managerial")
    opp = get_owned(db, Opportunity, opportunity_id, user.org_id, "Opportunity")
    rows = db.execute(select(Application, Resume).join(Resume, Resume.id == Application.resume_id)
                      .where(Application.opportunity_id == opp.id, Application.org_id == user.org_id)
                      .order_by(Application.match_score.desc().nulls_last(), Application.id)).all()
    out = []
    for i, (a, r) in enumerate(rows, 1):
        ev = db.scalar(select(Evaluation).where(Evaluation.application_id == a.id, Evaluation.round == round))
        out.append({"rank": i, "application_id": a.id, "stage": a.stage, "match": a.match_score, "ats": r.ats_score,
                    "resume": resume_out(r),
                    "evaluation": {"score": round_(ev.score), "rating": rating_label(ev.score), "date": iso(ev.updated_at.date())} if ev else None})
    return {"opportunity": opp_out(opp), "round": round, "candidates": out}


def round_(v):
    return round(v, 1)


@router.post("")
def submit_evaluation(body: EvaluationIn, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    app = get_owned(db, Application, body.application_id, user.org_id, "Application")
    try:
        score = score_ratings(body.ratings, N_QUESTIONS)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    ev = db.scalar(select(Evaluation).where(Evaluation.application_id == app.id, Evaluation.round == body.round))
    if ev is None:
        ev = Evaluation(org_id=user.org_id, application_id=app.id, round=body.round)
        db.add(ev)
    ev.ratings, ev.score, ev.comments = body.ratings, score, body.comments.strip()
    db.commit()
    return build_summary(db, app)


@router.get("/summary/{application_id}")
def summary(application_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return build_summary(db, get_owned(db, Application, application_id, user.org_id, "Application"))


@router.post("/decision")
def decide(body: DecisionIn, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """'Do you want to go ahead?' Yes = next stage, No = rejected."""
    app = get_owned(db, Application, body.application_id, user.org_id, "Application")
    app.stage = next_stage(app.stage) if body.go_ahead else "rejected"
    db.commit()
    return {"application_id": app.id, "stage": app.stage}


@router.get("/recent")
def recent(limit: int = 10, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    limit = max(1, min(limit, 100))
    rows = db.execute(
        select(Evaluation, Application, Resume, Opportunity)
        .join(Application, Application.id == Evaluation.application_id).join(Resume, Resume.id == Application.resume_id)
        .join(Opportunity, Opportunity.id == Application.opportunity_id)
        .where(Evaluation.org_id == user.org_id).order_by(Evaluation.updated_at.desc()).limit(limit)).all()
    return [{"candidate": r.name, "opportunity_code": o.code, "round": e.round, "score": round_(e.score),
             "rating": rating_label(e.score), "date": iso(e.updated_at.date())} for e, a, r, o in rows]


@router.get("/stats")
def stats(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    rows = db.execute(select(Evaluation.round, func.count(), func.max(Evaluation.updated_at))
                      .where(Evaluation.org_id == user.org_id).group_by(Evaluation.round)).all()
    out = {r: {"count": 0, "last": None} for r in ROUNDS}
    for rnd, n, last in rows:
        if rnd in out:
            out[rnd] = {"count": n, "last": iso(last.date()) if last else None}
    return out
