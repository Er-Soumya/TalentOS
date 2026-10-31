"""ATS Score Checker: upload a resume (or pick one from the database), get a report, and save the score on the resume."""
from typing import Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import get_current_user, get_owned
from ..models import Resume, User
from ..serializers import resume_as_parsed, resume_out
from ..services.ats_service import run_ats
from ..services.resume_store import ingest_upload

router = APIRouter(prefix="/api/ats", tags=["ats"])


@router.post("/check")
def check_resume(resume_id: Optional[int] = Form(None), target_role: str = Form(""), file: Optional[UploadFile] = File(None),
                 db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """Send either `resume_id` (a resume already in the database) or a new `file`. A new file is saved to the Resume Database only after the check is complete."""
    if resume_id is None and file is None:
        raise HTTPException(status_code=422, detail="Upload a resume file or choose one from the Resume Database")
    if resume_id is not None:
        r = get_owned(db, Resume, resume_id, user.org_id, "Resume")
    else:
        try:
            r, _ = ingest_upload(db, user.org_id, file.filename, file.file.read(), in_database=False)
        except (ValueError, RuntimeError) as e:
            raise HTTPException(status_code=422, detail=str(e))
    report = run_ats(r.text, resume_as_parsed(r), (target_role or "").strip())
    r.ats_score, r.ats_report = report["score"], report
    r.in_database = True  # saved to the Resume Database now that the ATS check is complete
    db.commit()
    return {"resume": resume_out(r), "report": report}