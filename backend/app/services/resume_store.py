"""Save an uploaded resume: validate -> read text -> parse (AI or fallback) -> store in the resume database."""
import hashlib
import os
import re
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path

from sqlalchemy import select

from ..config import settings
from ..models import Resume
from .resume_parser import parse_resume
from .text_extract import extract_text

ALLOWED = {".pdf", ".docx", ".txt"}


def _name_from_file(filename):
    stem = os.path.splitext(os.path.basename(filename or ""))[0]
    stem = re.sub(r"\b(resume|cv)\b", "", re.sub(r"[_\-.]+", " ", stem), flags=re.I)
    return re.sub(r"\s+", " ", stem).strip().title() or "New Candidate"


def ingest_upload(db, org_id, filename, data, in_database=True):
    """Returns (resume_row, created). Re-uploading the identical file returns the existing row (no new AI call).
    in_database=False keeps the resume out of the Resume Database until matching / the ATS check is complete."""
    ext = os.path.splitext(filename or "")[1].lower()
    if ext not in ALLOWED:
        raise ValueError("Unsupported file type. Please upload a PDF, DOCX or TXT file.")
    if not data:
        raise ValueError("The file is empty.")
    if len(data) > settings.max_upload_mb * 1024 * 1024:
        raise ValueError(f"File is larger than {settings.max_upload_mb} MB.")
    digest = hashlib.sha256(data).hexdigest()
    existing = db.scalar(select(Resume).where(Resume.org_id == org_id, Resume.content_hash == digest))
    if existing:
        if in_database and not existing.in_database:
            existing.in_database = True
            db.commit()
        return existing, False
    text = extract_text(data, ext)
    if len(text) < 40:
        raise ValueError("Could not read any text from this file (scanned/image PDFs are not supported yet).")
    parsed = parse_resume(text)
    folder = Path(settings.upload_dir) / str(org_id)
    folder.mkdir(parents=True, exist_ok=True)
    path = folder / f"{uuid.uuid4().hex}{ext}"
    path.write_bytes(data)
    r = Resume(org_id=org_id, filename=os.path.basename(filename), stored_path=str(path), content_hash=digest, text=text,
               name=parsed["name"] or _name_from_file(filename), email=parsed["email"], phone=parsed["phone"],
               location=parsed["location"], title=parsed["current_title"], summary=parsed["summary"], skills=parsed["skills"],
               education=parsed["education"], experience=parsed["experience"], certifications=parsed["certifications"],
               total_years=parsed["total_years"], parsed_with=parsed["parsed_with"], in_database=in_database)
    db.add(r)
    db.commit()
    db.refresh(r)
    return r, True


def reparse(db, r):
    """Re-run parsing on the stored text (use this after you change the AI model to improve older resumes)."""
    parsed = parse_resume(r.text)
    r.name = parsed["name"] or r.name or _name_from_file(r.filename)
    r.email, r.phone, r.location = parsed["email"], parsed["phone"], parsed["location"]
    r.title, r.summary, r.skills = parsed["current_title"], parsed["summary"], parsed["skills"]
    r.education, r.experience, r.certifications = parsed["education"], parsed["experience"], parsed["certifications"]
    r.total_years, r.parsed_with = parsed["total_years"], parsed["parsed_with"]
    db.commit()
    db.refresh(r)
    return r


def cleanup_staged(db, hours=24):
    """Delete uploads that were never saved to the database (matching / the ATS check never finished)."""
    cutoff = datetime.now(timezone.utc) - timedelta(hours=hours)
    rows = db.scalars(select(Resume).where(Resume.in_database.is_(False), Resume.uploaded_at < cutoff)).all()
    for r in rows:
        if r.stored_path:
            Path(r.stored_path).unlink(missing_ok=True)
        db.delete(r)
    db.commit()
    return len(rows)