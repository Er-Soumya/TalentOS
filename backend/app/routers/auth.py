"""Organization sign-up, login (password or OTP), profile."""
import hmac
import logging
import re
import secrets
import smtplib
from datetime import datetime, timedelta, timezone
from email.message import EmailMessage

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..config import settings
from ..database import get_db
from ..deps import get_current_user
from ..models import Organization, OtpCode, User
from ..schemas import LoginIn, OtpLoginIn, OtpRequest, PasswordChange, ProfileUpdate, SignupIn
from ..security import create_token, hash_password, verify_password

router = APIRouter(prefix="/api/auth", tags=["auth"])
log = logging.getLogger("talentos.auth")
EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


def _email(value):
    e = (value or "").strip().lower()
    if not EMAIL_RE.match(e):
        raise HTTPException(status_code=422, detail="Enter a valid email address")
    return e


def _send_email(to, code):
    if not settings.smtp_host:
        log.warning("OTP for %s is %s (SMTP is not configured, so it is only printed here)", to, code)
        return
    msg = EmailMessage()
    msg["Subject"] = "Your TalentOS verification code"
    msg["From"] = settings.smtp_from or settings.smtp_user
    msg["To"] = to
    msg.set_content(f"Your TalentOS verification code is {code}. It expires in {settings.otp_ttl_minutes} minutes.")
    with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=15) as s:
        s.starttls()
        if settings.smtp_user:
            s.login(settings.smtp_user, settings.smtp_password)
        s.send_message(msg)


def issue_otp(db, email, purpose):
    """OTP_MODE=fixed: nothing to send, DEV_OTP is always accepted. OTP_MODE=email: random code, stored and emailed."""
    if settings.otp_mode != "email":
        return
    code = f"{secrets.randbelow(10000):04d}"
    db.add(OtpCode(email=email, purpose=purpose, code=code, expires_at=datetime.now(timezone.utc) + timedelta(minutes=settings.otp_ttl_minutes)))
    db.commit()
    try:
        _send_email(email, code)
    except Exception as e:  # noqa: BLE001
        log.error("Could not send OTP email: %s", e)
        raise HTTPException(status_code=502, detail="Could not send the OTP email. Check the SMTP settings in .env")


def check_otp(db, email, purpose, code):
    code = (code or "").strip()
    if settings.otp_mode != "email":
        return hmac.compare_digest(code.encode(), settings.dev_otp.encode())
    row = db.scalars(select(OtpCode).where(OtpCode.email == email, OtpCode.purpose == purpose, OtpCode.used.is_(False),
                                           OtpCode.expires_at > datetime.now(timezone.utc)).order_by(OtpCode.id.desc())).first()
    if row and hmac.compare_digest(row.code.encode(), code.encode()):
        row.used = True
        db.commit()
        return True
    return False


def user_out(db, u):
    org = db.get(Organization, u.org_id)
    return {"id": u.id, "name": u.name, "email": u.email, "phone": u.phone, "org_id": u.org_id, "org_name": org.name if org else ""}


def _token_response(db, user):
    return {"access_token": create_token(user.id, user.org_id), "token_type": "bearer", "user": user_out(db, user)}


@router.post("/signup/otp")
def signup_otp(body: OtpRequest, db: Session = Depends(get_db)):
    email = _email(body.email)
    if db.scalar(select(User.id).where(User.email == email)):
        raise HTTPException(status_code=409, detail="An account with this email already exists")
    issue_otp(db, email, "signup")
    return {"sent": True, "otp_mode": settings.otp_mode}


@router.post("/signup", status_code=201)
def signup(body: SignupIn, db: Session = Depends(get_db)):
    email, name = _email(body.email), body.org_name.strip()
    if not name:
        raise HTTPException(status_code=422, detail="Organization name is required")
    if len(body.password) < 8:
        raise HTTPException(status_code=422, detail="Password must be at least 8 characters")
    if db.scalar(select(User.id).where(User.email == email)):
        raise HTTPException(status_code=409, detail="An account with this email already exists")
    if not check_otp(db, email, "signup", body.otp):
        raise HTTPException(status_code=400, detail="Incorrect or expired OTP")
    org = Organization(name=name, email=email, phone=body.phone.strip())
    db.add(org)
    db.flush()
    db.add(User(org_id=org.id, name=name, email=email, phone=body.phone.strip(), password_hash=hash_password(body.password)))
    db.commit()
    return {"ok": True, "message": "Account created. Please sign in."}


@router.post("/login")
def login(body: LoginIn, db: Session = Depends(get_db)):
    user = db.scalar(select(User).where(User.email == _email(body.email)))
    if user is None or not verify_password(body.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    return _token_response(db, user)


@router.post("/login/otp")
def login_otp(body: OtpRequest, db: Session = Depends(get_db)):
    email = _email(body.email)
    if db.scalar(select(User.id).where(User.email == email)):
        issue_otp(db, email, "login")
    return {"sent": True, "otp_mode": settings.otp_mode}  # same answer whether or not the email exists


@router.post("/login/otp/verify")
def login_otp_verify(body: OtpLoginIn, db: Session = Depends(get_db)):
    email = _email(body.email)
    user = db.scalar(select(User).where(User.email == email))
    if user is None or not check_otp(db, email, "login", body.otp):
        raise HTTPException(status_code=401, detail="Incorrect OTP or unknown email")
    return _token_response(db, user)


@router.get("/me")
def me(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return user_out(db, user)


@router.patch("/me")
def update_me(body: ProfileUpdate, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    org = db.get(Organization, user.org_id)
    if body.org_name is not None:
        if not body.org_name.strip():
            raise HTTPException(status_code=422, detail="Organization name is required")
        org.name = user.name = body.org_name.strip()
    if body.phone is not None:
        org.phone = user.phone = body.phone.strip()
    db.commit()
    return user_out(db, user)


@router.post("/change-password")
def change_password(body: PasswordChange, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if not verify_password(body.current_password, user.password_hash):
        raise HTTPException(status_code=400, detail="Current password is incorrect")
    if len(body.new_password) < 8:
        raise HTTPException(status_code=422, detail="New password must be at least 8 characters")
    user.password_hash = hash_password(body.new_password)
    db.commit()
    return {"ok": True}
