"""TalentOS API.  Run from the backend folder:  uvicorn app.main:app --reload"""
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from . import models  # noqa: F401  (registers the tables)
from .config import settings
from .database import Base, SessionLocal, engine
from .routers import applications, ats, auth, dashboard, evaluations, interviews, matching, offers, opportunities, resumes, screening
from .services import llm
from .services.resume_store import cleanup_staged

logging.basicConfig(level=logging.INFO, format="%(levelname)s  %(name)s  %(message)s")
log = logging.getLogger("talentos")


@asynccontextmanager
async def lifespan(app):
    try:
        Base.metadata.create_all(bind=engine)  # creates the tables the first time
    except Exception as e:  # noqa: BLE001
        raise RuntimeError("Could not connect to PostgreSQL. Check that it is running and that DATABASE_URL in .env is correct "
                           f"(user, password, port, database name). Original error: {e}") from e
    with SessionLocal() as db:  # remove uploads that were never saved (matching / ATS never finished)
        removed = cleanup_staged(db)
        if removed:
            log.info("Removed %s unsaved upload(s)", removed)
    log.info("AI: %s", f"{llm.provider()} / {llm.model_name()}" if llm.is_enabled() else "NOT configured - using built-in fallbacks")
    if llm.is_enabled() and llm.check_ready() is False:
        log.warning("The AI is not reachable (is Ollama running, and did you run: ollama pull %s ?). The app will use its built-in fallbacks until it is.", llm.model_name())
    log.info("OTP mode: %s", settings.otp_mode)
    yield


app = FastAPI(title=settings.app_name, version="1.0.0", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=settings.cors_list, allow_credentials=True, allow_methods=["*"], allow_headers=["*"])

for module in (auth, opportunities, resumes, matching, applications, ats, screening, interviews, evaluations, offers, dashboard):
    app.include_router(module.router)


@app.get("/api/health", tags=["system"])
def health():
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        db_ok = True
    except Exception:  # noqa: BLE001
        db_ok = False
        return {"status": "ok" if db_ok else "database_unreachable", "database": db_ok, "ai": llm.is_enabled(), "ai_ready": llm.check_ready(),
            "provider": llm.provider(), "model": llm.model_name() if llm.is_enabled() else None, "otp_mode": settings.otp_mode}