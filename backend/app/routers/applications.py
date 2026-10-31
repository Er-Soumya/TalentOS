"""Applications = candidates inside an opportunity's pipeline."""
from typing import Optional

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import get_current_user, get_owned
from ..models import Application, Resume, User
from ..schemas import StageIn
from ..serializers import application_out

router = APIRouter(prefix="/api/applications", tags=["applications"])


@router.get("")
def list_applications(opportunity_id: Optional[int] = None, stage: Optional[str] = None, db: Session = Depends(get_db),
                      user: User = Depends(get_current_user)):
    stmt = select(Application, Resume).join(Resume, Resume.id == Application.resume_id).where(Application.org_id == user.org_id)
    if opportunity_id:
        stmt = stmt.where(Application.opportunity_id == opportunity_id)
    if stage:
        stmt = stmt.where(Application.stage == stage)
    rows = db.execute(stmt.order_by(Application.match_score.desc().nulls_last(), Application.id)).all()
    return [application_out(a, r) for a, r in rows]


@router.patch("/{app_id}/stage")
def set_stage(app_id: int, body: StageIn, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """Move a candidate to any stage manually (for example to 'offered' or 'joined')."""
    a = get_owned(db, Application, app_id, user.org_id, "Application")
    a.stage = body.stage
    db.commit()
    return application_out(a)
