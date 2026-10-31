# TalentOS Backend (FastAPI + PostgreSQL + Gemini)

API for the TalentOS React frontend: organizations & login, opportunities, resume database (with AI parsing),
resume matcher, ATS checker, screening questions, interviews, candidate evaluation and dashboard numbers.

**Works even with an empty Gemini key.** Without a key every AI step uses a built-in fallback (rule-based parsing,
template questions, keyword relevance), and every response says `"ai_used": false`. Add the key later and the same
endpoints start using Gemini - no code change.

## 1. One-time setup (Windows PowerShell, inside this `backend` folder)
```powershell
python --version                      # 3.14 is fine
python -m venv .venv
.\.venv\Scripts\Activate.ps1          # if blocked:  Set-ExecutionPolicy -Scope CurrentUser RemoteSigned
python -m pip install --upgrade pip
pip install -r requirements.txt
```
If `pip install` fails for one package on Python 3.14, copy the error text and send it to me (the usual fix is a newer version of that package).

## 2. Fill the values in `.env`
| Setting | What to put | Required? |
|---|---|---|
| `DATABASE_URL` | replace `YOUR_PASSWORD` with your PostgreSQL `postgres` password. The database `talentos` must already exist (pgAdmin -> Create -> Database). Special characters in the password must be URL-encoded (`@` becomes `%40`). | **Yes** |
| `JWT_SECRET` | any long random text. Empty = a temporary secret is used (everyone is logged out on each restart). | Recommended |
| `GEMINI_API_KEY` | key from Google AI Studio. **Empty = fallback mode.** | Later |
| `GEMINI_MODEL` | default `gemini-flash-latest`. If you get "model not found", pick a current Flash model name from AI Studio. | Optional |
| `OTP_MODE` / `DEV_OTP` | `fixed` + `1234` = the OTP is always 1234 (development). `email` = real random OTP, needs the `SMTP_*` values. | Optional |
| `CORS_ORIGINS` | your React dev URL (already `http://localhost:5173`). | Optional |

## 3. Run
```powershell
uvicorn app.main:app --reload
```
Open http://127.0.0.1:8000/docs (interactive API page) and http://127.0.0.1:8000/api/health
(`"database": true` means PostgreSQL is connected). Tables are created automatically on first start.

## 4. Check everything works
Terminal 1 keeps the server running. In a **second** PowerShell (venv activated):
```powershell
python scripts/smoke_test.py
```
It signs up a throw-away organization and walks the whole product (opportunity -> resume upload -> match -> ATS -> questions ->
interview -> evaluation -> decision -> dashboard), printing PASS / FAIL for each step.
Offline unit tests (no server or database needed): `python -m unittest discover -s tests -t .`

## 5. Where things are
```
app/main.py            starts the API, CORS, creates tables
app/config.py          reads .env
app/models.py          PostgreSQL tables
app/schemas.py         request bodies        app/serializers.py   response shapes
app/routers/           one file per page/feature (auth, opportunities, resumes, matching, applications,
                       ats, screening, interviews, evaluations, dashboard)
app/services/llm.py    ALL Gemini calls (throttle, retry, cache, JSON parsing)
app/services/resume_parser.py     resume text -> profile (Gemini + code-computed experience years)
app/services/matching_service.py  scoring: skills 40, semantic 25, experience 20, education 5, location 5, title 5
app/services/ats_service.py       10 ATS sections (+ Gemini wording)
app/services/content_service.py   JD + screening / technical questions
app/services/*_logic.py, skills.py  pure scoring maths (fully unit-tested)
```

## 6. Main endpoints (all except auth need `Authorization: Bearer <token>`)
- Auth: `POST /api/auth/signup/otp`, `/signup`, `/login`, `/login/otp`, `/login/otp/verify`, `GET/PATCH /me`, `POST /change-password`
- Opportunities: `GET/POST /api/opportunities`, `GET/PUT/DELETE /{id}`, `GET /new-code`, `POST /generate-jd`, `POST /extract-jd`
- Resume Database: `POST /api/resumes/upload` (many files), `GET /api/resumes`, `GET/DELETE /{id}`, `POST /{id}/reparse`
- Matcher: `POST /api/matching/run`, `GET /api/matching/{opportunity_id}`; stages: `PATCH /api/applications/{id}/stage`
- ATS: `POST /api/ats/check` (form: `resume_id` or `file`, optional `target_role`)
- Screening: `POST /api/screening/generate`
- Interviews: `POST/GET /api/interviews`, `DELETE /{id}`
- Evaluation: `GET /api/evaluations/questions`, `/candidates`, `/recent`, `/stats`, `/summary/{application_id}`, `POST /api/evaluations`, `POST /api/evaluations/decision`
- Dashboard: `GET /api/dashboard/overview`, `/recruiter?limit=10`, `/fulfilment`, `/fulfilment/{id}/candidates?group=`, `/fulfilment/{id}/progress`

## 7. Adding Gemini later
1. Put the key in `.env` -> `GEMINI_API_KEY=...`, restart the server (`/api/health` then shows `"gemini": true`).
2. Existing resumes were parsed by the fallback. Re-run them through Gemini with `POST /api/resumes/{id}/reparse`.
3. Free-tier limits: calls are spaced automatically (`GEMINI_RPM`, default 10 per minute), retried on rate limits, and cached.
   If Gemini is rate-limited, the request still succeeds using the fallback.
4. Free-tier inputs can be used by Google to improve its products - use sample resumes while developing; use a paid key for real candidate data.

## 8. Notes
- Scanned/image-only PDFs have no text to read (OCR is not included).
- `.doc` (old Word) is not supported; use PDF, DOCX or TXT.
- Uploaded files are stored in `uploads/` (ignored by git). Re-uploading the same file reuses the saved result.
- Database migrations (Alembic) are not set up yet: tables are created automatically, but changing a column later needs a migration or a manual `ALTER TABLE`.
