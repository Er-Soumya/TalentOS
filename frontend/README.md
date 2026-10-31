# TalentOS — The Operating System For Modern Hiring (Frontend)

React 18 + Vite + Tailwind CSS 3. **Frontend only** — all data is mocked in `src/data` and `src/context/AppContext.jsx`. A TechGenius Balaji Solutions Pvt. Ltd. product.

## Connected to the backend
This version talks to the TalentOS backend (FastAPI + PostgreSQL + Gemini). There is no sample data any more:
you create an account, then everything you see is stored in the database.

1. Start the backend first (`uvicorn app.main:app --reload` in the backend folder).
2. `.env` in this folder holds the backend address: `VITE_API_URL=http://127.0.0.1:8000` (restart `npm run dev` after changing it).

## Run
```bash
npm install
npm run dev      # http://localhost:5173
npm run build
```

## Sign in
- Click **Create organization account**. In development the OTP is the backend's `DEV_OTP` (default **1234**).
- After creating the account you are taken to the login page.

## Pages
- **Login / Sign-up** — split 50/50 brand panel and form
- **Overview** — greeting, summary cards, opportunities, hiring activity, interview schedule, calendar
- **Dashboard** — Recruiter Dashboard (stage cards, Recent Hiring, upcoming interviews) and Fulfilment (openings, eye-icon candidate lists, per-opportunity progress)
- **Opportunity Creation** — list plus add/edit page (positions, Active/Hold/Closed, must-have and nice-to-have skills, JD upload/paste)
- **Resume Matcher** — JD + candidates, AI ranking, full report, schedule interview (updates the calendar)
- **ATS Score Checker** — score, section breakdown, limitations and improvements
- **Resume Database** — every uploaded resume; send candidates to the Matcher or ATS checker
- **Screening Questions** — AI-style question generation with answer hints
- **Candidate Evaluation** — HR / Technical / Managerial rounds, ranked candidates, rated questions, summary with recommendation and go-ahead decision

## Notes
- The "Hiring activity" chart on the Overview page still shows sample numbers.
- All server calls live in `src/api.js` (client) and `src/context/AppContext.jsx` (data loading and actions).

## Branding
- Product logo: `public/talentos-logo.png` · Company logo: `public/logo.png`
- Colours: `tailwind.config.js` · Font: DM Sans (Google Fonts, `index.html`)
