"""Request bodies (what the frontend sends)."""
from typing import Literal, Optional

from pydantic import BaseModel, Field

Status = Literal["Active", "Hold", "Closed"]
Round = Literal["hr", "technical", "managerial"]
Stage = Literal["screening", "submitted", "interviewed", "selected", "offered", "joined", "rejected"]


class OtpRequest(BaseModel):
    email: str


class SignupIn(BaseModel):
    org_name: str
    email: str
    phone: str = ""
    password: str
    otp: str


class LoginIn(BaseModel):
    email: str
    password: str


class OtpLoginIn(BaseModel):
    email: str
    otp: str


class ProfileUpdate(BaseModel):
    org_name: Optional[str] = None
    phone: Optional[str] = None


class PasswordChange(BaseModel):
    current_password: str
    new_password: str


class OpportunityIn(BaseModel):
    code: Optional[str] = None
    recruiter: str = ""
    role: str
    experience: str = ""
    ctc: str = ""
    location: str = ""
    mode: str = ""
    positions: int = Field(default=1, ge=1, le=10000)
    status: Status = "Active"
    must_skills: list[str] = []
    nice_skills: list[str] = []
    jd_text: str = ""


class JdGenerateIn(BaseModel):
    role: str
    experience: str = ""
    must_skills: list[str] = []
    nice_skills: list[str] = []
    location: str = ""
    mode: str = ""


class MatchRunIn(BaseModel):
    opportunity_id: Optional[int] = None
    jd_text: Optional[str] = None
    resume_ids: list[int]


class StageIn(BaseModel):
    stage: Stage


class InterviewIn(BaseModel):
    resume_id: Optional[int] = None
    opportunity_id: Optional[int] = None
    candidate_name: str = ""
    role: str = ""
    date: str            # YYYY-MM-DD
    time: str            # HH:MM (24h)
    round: str = "Technical round"
    meeting_link: str = ""
    participants: list[str] = []


class ScreeningIn(BaseModel):
    opportunity_id: Optional[int] = None
    role: str = ""
    must_skills: list[str] = []
    nice_skills: list[str] = []
    jd_text: str = ""
    count: int = Field(default=10, ge=1, le=30)
    regenerate: bool = False


class EvaluationIn(BaseModel):
    application_id: int
    round: Round
    ratings: dict[str, str]
    comments: str = ""


class DecisionIn(BaseModel):
    application_id: int
    go_ahead: bool
