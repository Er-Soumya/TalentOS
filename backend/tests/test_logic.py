"""Run with:  python -m unittest discover -s tests -v   (from the backend folder)"""
import io
import unittest
from datetime import date
from unittest.mock import patch

from app.services import ats_logic, evaluation_logic as ev, matching_logic as ml, resume_logic as rl, skills
from app.services import ats_service, content_service, llm, matching_service, resume_parser, text_extract
from tests.sample_resume import SAMPLE

TODAY = date(2026, 10, 16)


class SkillsTests(unittest.TestCase):
    def test_canon(self):
        self.assertEqual(skills.canon("reactjs"), "React")
        self.assertEqual(skills.canon("Postgres"), "PostgreSQL")
        self.assertEqual(skills.canon("Something Odd"), "Something Odd")

    def test_find_and_boundaries(self):
        found = skills.find_skills_in_text("Python, FastAPI and Docker. I know javascript only.")
        self.assertIn("Python", found); self.assertIn("JavaScript", found); self.assertNotIn("Java", found)


class ResumeLogicTests(unittest.TestCase):
    def test_dates_and_merge(self):
        self.assertEqual(rl.parse_date_token("Jun 2021", False, TODAY), date(2021, 6, 1))
        self.assertEqual(rl.parse_date_token("present", True, TODAY), TODAY)
        self.assertEqual(rl.parse_date_token("2021-06", True, TODAY), date(2021, 6, 30))
        self.assertAlmostEqual(rl.merge_ranges([(date(2020, 1, 1), date(2022, 1, 1)), (date(2021, 6, 1), date(2023, 1, 1))], TODAY), 3.0, 1)

    def test_degrees(self):
        self.assertEqual(rl.highest_degree("B.Tech in CS")[0], 2)
        self.assertEqual(rl.highest_degree("MBA")[0], 3)
        self.assertEqual(rl.highest_degree("PhD in AI")[0], 4)
        self.assertEqual(rl.highest_degree("please contact me, it will be fine")[0], 0)

    def test_contact(self):
        self.assertEqual(rl.extract_email(SAMPLE), "soumya@example.com")
        self.assertTrue(rl.extract_phone(SAMPLE).startswith("+91"))
        self.assertEqual(rl.extract_phone("2019-2023 2020-2024"), "")
        self.assertEqual(rl.guess_name(SAMPLE), "Soumya Panda")

    def test_heuristic_parse(self):
        p = rl.heuristic_parse(SAMPLE, TODAY)
        self.assertEqual(p["email"], "soumya@example.com")
        self.assertIn("Python", p["skills"]); self.assertIn("PostgreSQL", p["skills"])
        self.assertEqual(len(p["experience"]), 2)           # the project date range must not count as a job
        self.assertAlmostEqual(p["total_years"], 0.4 + 0.5, delta=0.35)  # Jan-Jun 2025 (~0.5y) + Jun 2026-now (~0.4y)
        self.assertTrue(p["education"] and p["education"][0]["level"] == 2)

    def test_normalize_llm_output_computes_years_in_code(self):
        raw = {"name": "A B", "skills": ["reactjs", "python", "Python"],
               "experience": [{"title": "Dev", "company": "X", "type": "job", "start": "2020-01", "end": "2022-12"},
                              {"title": "Dev2", "company": "Y", "type": "job", "start": "2022-06", "end": "present"},
                              {"title": "Thesis", "type": "project", "start": "2019", "end": "2020"}],
               "education": [{"degree": "M.Tech", "field": "AI", "institution": "IIT", "start_year": "2018", "end_year": "2020"}],
               "total_years_estimate": 99}
        n = rl.normalize_parsed(raw, SAMPLE, TODAY)
        self.assertEqual(n["skills"], ["React", "Python"])
        self.assertAlmostEqual(n["total_years"], 6.8, delta=0.2)  # not the LLM's wrong 99
        self.assertEqual(n["education"][0]["level"], 3)
        self.assertEqual(len(n["experience"]), 2)


class MatchingTests(unittest.TestCase):
    def test_labels(self):
        self.assertEqual(ml.years_range_from_label("3-5 years"), (3.0, 5.0))
        self.assertEqual(ml.years_range_from_label("8+ years"), (8.0, None))
        self.assertEqual(ml.years_range_from_text("Minimum 5+ years of experience"), (5.0, None))

    def test_experience_score(self):
        self.assertEqual(ml.experience_score(4, 3, 5), 100)
        self.assertEqual(ml.experience_score(1.5, 3, 5), 50)
        self.assertEqual(ml.experience_score(None, 3, 5), 40)
        self.assertLess(ml.experience_score(15, 3, 5), 100)
        self.assertEqual(ml.experience_score(0, 0, 1), 100)

    def test_skill_matching_and_evidence(self):
        r = ml.match_skills(["Python", "reactjs"], "I used Docker daily", ["python", "React", "Docker", "Kubernetes"], ["Git"])
        self.assertEqual(sorted(r["must_matched"]), ["Docker", "Python", "React"])
        self.assertEqual(r["must_missing"], ["Kubernetes"]); self.assertEqual(r["nice_missing"], ["Git"])
        self.assertEqual(r["via"]["Docker"], "resume_text")
        r = ml.apply_skill_evidence(r, {"kubernetes": True})
        self.assertEqual(r["must_missing"], []); self.assertEqual(r["via"]["Kubernetes"], "ai")
        self.assertAlmostEqual(ml.skills_score(r), (0.8 * 1 + 0.2 * 0) * 100)

    def test_match_resume_without_ai(self):
        resume = dict(rl.heuristic_parse(SAMPLE, TODAY), text=SAMPLE)
        opp = {"role": "AI / ML Engineer", "must_skills": ["Python", "TensorFlow", "Kubernetes"], "nice_skills": ["Docker"],
               "experience": "0-1 years", "location": "Bhubaneswar", "mode": "Hybrid", "jd_text": "Build ML models with Python and TensorFlow."}
        with patch.object(llm, "is_enabled", return_value=False):
            out = matching_service.match_resume(resume, opp)
        self.assertFalse(out["ai_used"]); self.assertIn("Kubernetes", out["must_missing"])
        self.assertTrue(0 <= out["score"] <= 100); self.assertEqual(out["breakdown"]["location"], 100)
        self.assertEqual(out["breakdown"]["experience"], 100)

    def test_match_resume_with_mocked_gemini(self):
        resume = dict(rl.heuristic_parse(SAMPLE, TODAY), text=SAMPLE)
        opp = {"role": "ML Engineer", "must_skills": ["Python", "Kubernetes"], "nice_skills": [], "experience": "0-1 years"}
        fake = {"relevance": 80, "summary": "Strong fit.", "strengths": ["Python"], "concerns": ["No k8s"], "skill_evidence": {"Kubernetes": True}}
        with patch.object(llm, "is_enabled", return_value=True), patch.object(llm, "ai_json", return_value=fake):
            out = matching_service.match_resume(resume, opp)
        self.assertTrue(out["ai_used"]); self.assertEqual(out["must_missing"], []); self.assertEqual(out["breakdown"]["semantic"], 80)
        self.assertEqual(out["summary"], "Strong fit.")


class AtsTests(unittest.TestCase):
    def test_sections(self):
        parsed = rl.heuristic_parse(SAMPLE, TODAY)
        s = ats_logic.analyze_sections(SAMPLE, parsed, "AI Engineer")
        self.assertEqual(set(s), set(ats_logic.WEIGHTS))
        self.assertTrue(all(0 <= v <= 100 for v in s.values()))
        self.assertGreaterEqual(s["Contact Info"], 85); self.assertGreaterEqual(s["Action Verbs"], 80); self.assertGreaterEqual(s["Achievements"], 80)
        total = ats_logic.overall(s); self.assertTrue(50 <= total <= 100)
        weak = ats_logic.analyze_sections("hello world", {}, "")
        self.assertLess(ats_logic.overall(weak), 45)

    def test_run_ats_fallback_and_ai(self):
        parsed = rl.heuristic_parse(SAMPLE, TODAY)
        with patch.object(llm, "is_enabled", return_value=False):
            r = ats_service.run_ats(SAMPLE, parsed, "AI Engineer")
        self.assertFalse(r["ai_used"]); self.assertEqual(len(r["sections"]), 10); self.assertEqual(len(r["limitations"]), 3)
        fake = {"keyword_alignment": 90, "strengths": ["Clear"], "limitations": ["a", "b"], "improvements": ["c"]}
        with patch.object(llm, "is_enabled", return_value=True), patch.object(llm, "ai_json", return_value=fake):
            r2 = ats_service.run_ats(SAMPLE, parsed, "AI Engineer")
        self.assertTrue(r2["ai_used"]); self.assertEqual(r2["limitations"], ["a", "b"])


class EvaluationTests(unittest.TestCase):
    def test_scoring(self):
        self.assertEqual(ev.score_ratings({"0": "Excellent", "1": "Good", "2": "Average", "3": "Poor"}, 4), 62.5)
        with self.assertRaises(ValueError):
            ev.score_ratings({"0": "Good"}, 2)
        self.assertEqual(ev.rating_label(88), "Excellent"); self.assertEqual(ev.rating_label(30), "Poor")

    def test_summary_and_stage(self):
        s = ev.summarize(80, 70, {"hr": 75, "technical": 85})
        self.assertEqual(s["evaluation_avg"], 80); self.assertEqual(s["overall"], round(80 * .35 + 80 * .5 + 70 * .15)); self.assertTrue(s["recommended"])
        self.assertFalse(ev.summarize(40, None, {"hr": 50})["recommended"])
        self.assertEqual(ev.next_stage("screening"), "submitted"); self.assertEqual(ev.next_stage("joined"), "joined")


class MiscTests(unittest.TestCase):
    def test_json_parse(self):
        self.assertEqual(llm.parse_json_text('```json\n{"a": 1}\n```'), {"a": 1})
        self.assertEqual(llm.parse_json_text('Sure! {"a": [1,2]} done'), {"a": [1, 2]})
        with self.assertRaises(ValueError):
            llm.parse_json_text("no json here")

    def test_llm_disabled_by_default(self):
        self.assertFalse(llm.is_enabled())
        self.assertIsNone(llm.ai_json("x"))

    def test_docx_extract_and_parse(self):
        from docx import Document
        d = Document()
        for line in SAMPLE.splitlines():
            d.add_paragraph(line)
        buf = io.BytesIO(); d.save(buf)
        text = text_extract.extract_text(buf.getvalue(), ".docx")
        parsed = resume_parser.parse_resume(text, TODAY)
        self.assertEqual(parsed["parsed_with"], "heuristic"); self.assertEqual(parsed["name"], "Soumya Panda")
        with self.assertRaises(ValueError):
            text_extract.extract_text(b"x", ".exe")

    def test_content_fallbacks(self):
        jd, ai = content_service.generate_jd("Data Scientist", "3-5 years", ["Python"], [], "Pune", "Hybrid")
        self.assertFalse(ai); self.assertIn("Responsibilities", jd)
        qs, ai = content_service.screening_questions("Data Scientist", ["Python", "SQL"], [], "", 6)
        self.assertFalse(ai); self.assertEqual(len(qs), 6); self.assertIn("question", qs[0])

    def test_parse_resume_with_mocked_gemini(self):
        fake = {"name": "Soumya Panda", "skills": ["python"], "experience": [{"title": "Dev", "company": "X", "type": "job", "start": "2024-01", "end": "2025-01"}], "education": []}
        with patch.object(llm, "is_enabled", return_value=True), patch.object(llm, "ai_json", return_value=fake):
            p = resume_parser.parse_resume(SAMPLE, TODAY)
        self.assertEqual(p["parsed_with"], "gemini"); self.assertAlmostEqual(p["total_years"], 1.0, delta=0.2)
        self.assertIn("FastAPI", p["skills"])  # catalogue scan adds what the model missed


if __name__ == "__main__":
    unittest.main()
