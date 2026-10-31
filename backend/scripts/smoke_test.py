"""End-to-end check against a RUNNING server (uses only the Python standard library).

    1. start the API:      uvicorn app.main:app --reload
    2. in a second terminal: python scripts/smoke_test.py            (or give another URL as the first argument)
Every step prints PASS or FAIL. It creates a throw-away organization with a random email."""
import json
import random
import sys
import urllib.error
import urllib.request
import uuid

BASE = (sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:8000").rstrip("/")
OTP = sys.argv[2] if len(sys.argv) > 2 else "1234"
RESUME = b"""Asha Verma
Pune | asha.verma@example.com | +91 98765 12345

PROFESSIONAL SUMMARY
Backend engineer with 3 years of experience building APIs with Python, FastAPI and PostgreSQL.

SKILLS
Python, FastAPI, PostgreSQL, Docker, AWS, Git

EXPERIENCE
Backend Engineer at Acme Tech   Jan 2022 - Present
- Built REST APIs serving 50k users with Python and FastAPI
- Reduced query time by 40% by optimising PostgreSQL indexes
- Deployed services with Docker on AWS

EDUCATION
B.Tech in Computer Science, ABC Institute of Technology   2017 - 2021
"""
results = []


def call(method, path, body=None, token=None, fields=None, files=None):
    headers, data = {}, None
    if token:
        headers["Authorization"] = f"Bearer {token}"
    if files is not None or fields is not None:
        boundary = uuid.uuid4().hex
        parts = [f'--{boundary}\r\nContent-Disposition: form-data; name="{k}"\r\n\r\n{v}\r\n'.encode() for k, v in (fields or {}).items()]
        for name, (fname, content, ctype) in (files or {}).items():
            parts.append(f'--{boundary}\r\nContent-Disposition: form-data; name="{name}"; filename="{fname}"\r\nContent-Type: {ctype}\r\n\r\n'.encode() + content + b"\r\n")
        parts.append(f"--{boundary}--\r\n".encode())
        data, headers["Content-Type"] = b"".join(parts), f"multipart/form-data; boundary={boundary}"
    elif body is not None:
        data, headers["Content-Type"] = json.dumps(body).encode(), "application/json"
    req = urllib.request.Request(BASE + path, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=120) as r:
            return r.status, json.loads(r.read() or b"null")
    except urllib.error.HTTPError as e:
        raw = e.read()
        try:
            return e.code, json.loads(raw)
        except Exception:  # noqa: BLE001
            return e.code, raw.decode(errors="ignore")


def step(name, ok, detail=""):
    results.append(ok)
    print(("PASS  " if ok else "FAIL  ") + name + (f"   {detail}" if detail and not ok else ""))
    return ok


def main():
    s, h = call("GET", "/api/health")
    step("health", s == 200 and h.get("database") is True, h)
    print(f"      AI: {h.get('provider')} / {h.get('model')}   configured: {h.get('ai')}   reachable: {h.get('ai_ready')}   OTP mode: {h.get('otp_mode')}")
    if not results[-1]:
        print("Server or database is not reachable - fix that first."); return
    email = f"smoke{random.randint(10000, 99999)}@example.com"
    s, r = call("POST", "/api/auth/signup/otp", {"email": email}); step("signup otp", s == 200, r)
    s, r = call("POST", "/api/auth/signup", {"org_name": "Smoke Test Org", "email": email, "phone": "+91 99999 00000", "password": "Passw0rd!x", "otp": OTP}); step("signup", s == 201, r)
    s, r = call("POST", "/api/auth/login", {"email": email, "password": "Passw0rd!x"}); step("login", s == 200 and "access_token" in r, r)
    tok = r.get("access_token") if isinstance(r, dict) else None
    s, r = call("GET", "/api/auth/me", token=tok); step("me", s == 200 and r.get("email") == email, r)

    s, r = call("POST", "/api/opportunities", {"recruiter": "Smoke", "role": "Backend Engineer", "experience": "3-5 years", "ctc": "10-15 LPA", "location": "Pune", "mode": "Hybrid",
                                               "positions": 2, "status": "Active", "must_skills": ["Python", "FastAPI", "Kubernetes"], "nice_skills": ["Docker"], "jd_text": "Build APIs with Python and FastAPI."}, token=tok)
    step("create opportunity", s == 201 and r.get("code", "").startswith("OPP-"), r)
    opp = r if isinstance(r, dict) else {}
    s, r = call("GET", "/api/opportunities", token=tok); step("list opportunities", s == 200 and len(r) == 1, r)

    s, r = call("POST", "/api/resumes/upload", files={"files": ("asha_verma_resume.txt", RESUME, "text/plain")}, token=tok)
    ok = s == 201 and len(r.get("resumes", [])) == 1 and not r.get("errors")
    step("upload resume", ok, r)
    resume = r["resumes"][0] if ok else {}
    if ok:
        print(f"      parsed: name={resume['name']!r} years={resume['years']} skills={resume['skills'][:6]} via={resume['parsed_with']}")

    s, r = call("POST", "/api/matching/run", {"opportunity_id": opp.get("id"), "resume_ids": [resume.get("id")]}, token=tok)
    ok = s == 200 and r["results"] and 0 <= r["results"][0]["report"]["score"] <= 100
    step("match resume", ok, r)
    app_id = r["results"][0]["application_id"] if ok else None
    if ok:
        rep = r["results"][0]["report"]
        print(f"      score={rep['score']} missing={rep['must_missing']} ai_used={rep['ai_used']}")
    s, r = call("GET", f"/api/matching/{opp.get('id')}", token=tok); step("stored ranking", s == 200 and len(r["results"]) == 1, r)

    s, r = call("POST", "/api/ats/check", fields={"resume_id": str(resume.get("id")), "target_role": "Backend Engineer"}, token=tok)
    step("ats check", s == 200 and len(r["report"]["sections"]) == 10, r)
    if s == 200:
        print(f"      ats score={r['report']['score']} grade={r['report']['grade']}")

    s, r = call("POST", "/api/screening/generate", {"opportunity_id": opp.get("id"), "count": 6}, token=tok); step("screening questions", s == 200 and len(r["questions"]) == 6, r)
    s, r = call("POST", "/api/interviews", {"resume_id": resume.get("id"), "opportunity_id": opp.get("id"), "date": "2026-12-01", "time": "11:00", "round": "Technical round", "meeting_link": "https://meet.example.com/x", "participants": ["Smoke"]}, token=tok)
    step("schedule interview", s == 201, r)

    for rnd in ("hr", "technical"):
        s, r = call("GET", f"/api/evaluations/questions?round={rnd}&opportunity_id={opp.get('id')}", token=tok)
        step(f"{rnd} questions", s == 200 and len(r["questions"]) == 6, r)
        ratings = {str(i): "Good" for i in range(6)}
        s, r = call("POST", "/api/evaluations", {"application_id": app_id, "round": rnd, "ratings": ratings, "comments": "ok"}, token=tok)
        step(f"submit {rnd} evaluation", s == 200 and "overall" in r, r)
    if s == 200:
        print(f"      overall={r['overall']} recommended={r['recommended']}")
    s, r = call("POST", "/api/evaluations/decision", {"application_id": app_id, "go_ahead": True}, token=tok); step("decision (go ahead)", s == 200 and r["stage"] == "submitted", r)
    s, r = call("GET", "/api/evaluations/stats", token=tok); step("evaluation stats", s == 200 and r["hr"]["count"] == 1, r)

    for path in ("/api/dashboard/overview", "/api/dashboard/recruiter", "/api/dashboard/fulfilment", f"/api/dashboard/fulfilment/{opp.get('id')}/progress"):
        s, r = call("GET", path, token=tok); step(path, s == 200, r)

    print(f"\n{sum(results)} of {len(results)} checks passed")


if __name__ == "__main__":
    main()
