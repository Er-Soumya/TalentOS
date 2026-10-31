"""Resume database: upload (parse + store), list, view, re-parse, delete."""
import logging
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, Depends, File, UploadFile
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import get_current_user, get_owned
from ..models import Resume, User
from ..serializers import resume_out
from ..services.resume_store import ingest_upload, reparse

router = APIRouter(prefix="/api/resumes", tags=["resumes"])
log = logging.getLogger("talentos.resumes")


@router.post("/upload", status_code=201)
def upload_resumes(files: list[UploadFile] = File(...), stage: bool = False, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """Upload one or many resumes. Each one is read, parsed and saved.
    With ?stage=true (used by the Matcher) the resume is kept out of the Resume Database until the match is complete."""
    saved, errors = [], []
    for f in files:
        try:
            r, created = ingest_upload(db, user.org_id, f.filename, f.file.read(), in_database=not stage)
            item = resume_out(r)
            item["created"] = created
            saved.append(item)
        except (ValueError, RuntimeError) as e:
            db.rollback()
            errors.append({"file": f.filename, "error": str(e)})
        except Exception as e:  # noqa: BLE001
            db.rollback()
            log.exception("Resume upload failed for %s", f.filename)
            errors.append({"file": f.filename, "error": "Unexpected error while processing this file"})
    return {"resumes": saved, "errors": errors}


@router.get("")
def list_resumes(q: Optional[str] = None, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    rows = db.scalars(select(Resume).where(Resume.org_id == user.org_id, Resume.in_database.is_(True)).order_by(Resume.uploaded_at.desc(), Resume.id.desc())).all()
    if q:
        ql = q.lower()
        rows = [r for r in rows if ql in f"{r.name} {r.title} {' '.join(r.skills or [])} {r.filename}".lower()]
    return [resume_out(r) for r in rows]


@router.get("/{rid}")
def get_resume(rid: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return resume_out(get_owned(db, Resume, rid, user.org_id, "Resume"), full=True)


@router.post("/{rid}/reparse")
def reparse_resume(rid: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    r = get_owned(db, Resume, rid, user.org_id, "Resume")
    return resume_out(reparse(db, r), full=True)


@router.delete("/{rid}")
def delete_resume(rid: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    r = get_owned(db, Resume, rid, user.org_id, "Resume")
    path = r.stored_path
    db.delete(r)
    db.commit()
    if path:
        Path(path).unlink(missing_ok=True)
    return {"ok": True}
