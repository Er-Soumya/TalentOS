"""All database tables. Tables are created automatically on startup (see main.py)."""
from datetime import date, datetime

from sqlalchemy import Boolean, Date, DateTime, Float, ForeignKey, Integer, String, Text, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from .database import Base


class Organization(Base):
    __tablename__ = "organizations"
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(200))
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    phone: Mapped[str] = mapped_column(String(40), default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class User(Base):
    __tablename__ = "users"
    id: Mapped[int] = mapped_column(primary_key=True)
    org_id: Mapped[int] = mapped_column(ForeignKey("organizations.id", ondelete="CASCADE"), index=True)
    name: Mapped[str] = mapped_column(String(200))
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    phone: Mapped[str] = mapped_column(String(40), default="")
    password_hash: Mapped[str] = mapped_column(String(300))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class OtpCode(Base):
    __tablename__ = "otp_codes"
    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(String(255), index=True)
    purpose: Mapped[str] = mapped_column(String(20))
    code: Mapped[str] = mapped_column(String(10))
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    used: Mapped[bool] = mapped_column(Boolean, default=False)


class Opportunity(Base):
    __tablename__ = "opportunities"
    __table_args__ = (UniqueConstraint("org_id", "code", name="uq_opportunity_code"),)
    id: Mapped[int] = mapped_column(primary_key=True)
    org_id: Mapped[int] = mapped_column(ForeignKey("organizations.id", ondelete="CASCADE"), index=True)
    code: Mapped[str] = mapped_column(String(30))
    recruiter: Mapped[str] = mapped_column(String(120), default="")
    role: Mapped[str] = mapped_column(String(200))
    experience: Mapped[str] = mapped_column(String(30), default="")
    min_years: Mapped[float] = mapped_column(Float, default=0)
    max_years: Mapped[float | None] = mapped_column(Float, nullable=True)
    ctc: Mapped[str] = mapped_column(String(60), default="")
    location: Mapped[str] = mapped_column(String(120), default="")
    mode: Mapped[str] = mapped_column(String(20), default="")
    positions: Mapped[int] = mapped_column(Integer, default=1)
    status: Mapped[str] = mapped_column(String(20), default="Active")
    must_skills: Mapped[list] = mapped_column(JSONB, default=list)
    nice_skills: Mapped[list] = mapped_column(JSONB, default=list)
    jd_text: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class Resume(Base):
    __tablename__ = "resumes"
    id: Mapped[int] = mapped_column(primary_key=True)
    org_id: Mapped[int] = mapped_column(ForeignKey("organizations.id", ondelete="CASCADE"), index=True)
    filename: Mapped[str] = mapped_column(String(300))
    stored_path: Mapped[str] = mapped_column(String(500), default="")
    content_hash: Mapped[str] = mapped_column(String(64), index=True)
    text: Mapped[str] = mapped_column(Text, default="")
    name: Mapped[str] = mapped_column(String(200), default="")
    email: Mapped[str] = mapped_column(String(255), default="")
    phone: Mapped[str] = mapped_column(String(60), default="")
    location: Mapped[str] = mapped_column(String(120), default="")
    title: Mapped[str] = mapped_column(String(200), default="")
    summary: Mapped[str] = mapped_column(Text, default="")
    skills: Mapped[list] = mapped_column(JSONB, default=list)
    education: Mapped[list] = mapped_column(JSONB, default=list)
    experience: Mapped[list] = mapped_column(JSONB, default=list)
    certifications: Mapped[list] = mapped_column(JSONB, default=list)
    total_years: Mapped[float | None] = mapped_column(Float, nullable=True)
    parsed_with: Mapped[str] = mapped_column(String(20), default="heuristic")
    # False while a resume was only uploaded in the Matcher / ATS page; it becomes True when matching / the ATS check is complete
    in_database: Mapped[bool] = mapped_column(Boolean, default=True, server_default="true")
    ats_score: Mapped[int | None] = mapped_column(Integer, nullable=True)
    ats_report: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    last_match: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    uploaded_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class Application(Base):
    """One candidate (resume) in one opportunity's pipeline."""
    __tablename__ = "applications"
    __table_args__ = (UniqueConstraint("opportunity_id", "resume_id", name="uq_application"),)
    id: Mapped[int] = mapped_column(primary_key=True)
    org_id: Mapped[int] = mapped_column(ForeignKey("organizations.id", ondelete="CASCADE"), index=True)
    opportunity_id: Mapped[int] = mapped_column(ForeignKey("opportunities.id", ondelete="CASCADE"), index=True)
    resume_id: Mapped[int] = mapped_column(ForeignKey("resumes.id", ondelete="CASCADE"), index=True)
    stage: Mapped[str] = mapped_column(String(20), default="screening")
    match_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    match_report: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    offered_on: Mapped[date | None] = mapped_column(Date, nullable=True)
    joined_on: Mapped[date | None] = mapped_column(Date, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class Interview(Base):
    __tablename__ = "interviews"
    id: Mapped[int] = mapped_column(primary_key=True)
    org_id: Mapped[int] = mapped_column(ForeignKey("organizations.id", ondelete="CASCADE"), index=True)
    application_id: Mapped[int | None] = mapped_column(ForeignKey("applications.id", ondelete="SET NULL"), nullable=True)
    candidate_name: Mapped[str] = mapped_column(String(200))
    role: Mapped[str] = mapped_column(String(200), default="")
    opportunity_code: Mapped[str] = mapped_column(String(30), default="")
    date: Mapped[date] = mapped_column(Date, index=True)
    time: Mapped[str] = mapped_column(String(5))
    round: Mapped[str] = mapped_column(String(40), default="Technical round")
    meeting_link: Mapped[str] = mapped_column(String(500), default="")
    participants: Mapped[list] = mapped_column(JSONB, default=list)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class Evaluation(Base):
    __tablename__ = "evaluations"
    __table_args__ = (UniqueConstraint("application_id", "round", name="uq_evaluation_round"),)
    id: Mapped[int] = mapped_column(primary_key=True)
    org_id: Mapped[int] = mapped_column(ForeignKey("organizations.id", ondelete="CASCADE"), index=True)
    application_id: Mapped[int] = mapped_column(ForeignKey("applications.id", ondelete="CASCADE"), index=True)
    round: Mapped[str] = mapped_column(String(20))
    ratings: Mapped[dict] = mapped_column(JSONB, default=dict)
    score: Mapped[float] = mapped_column(Float)
    comments: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
