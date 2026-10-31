"""Tests for the Gemini wrapper's retry / cache / fallback behaviour (no real Gemini calls are made)."""
import time
import unittest

from app.config import settings
from app.services import llm


class LLMBehaviour(unittest.TestCase):
    def setUp(self):
        self.saved = (settings.gemini_api_key, settings.gemini_rpm, settings.gemini_max_retries, llm._call_model, time.sleep)
        settings.gemini_rpm, settings.gemini_max_retries = 100000, 2
        llm._cache.clear()
        time.sleep = lambda s: None

    def tearDown(self):
        settings.gemini_api_key, settings.gemini_rpm, settings.gemini_max_retries, llm._call_model, time.sleep = self.saved

    def test_schema_rejected_then_plain_json_and_cache(self):
        settings.gemini_api_key = "x"
        calls = []

        def fake(prompt, system, schema, max_tokens):
            calls.append(schema)
            if schema is not None:
                raise ValueError("default value is not supported")
            return '```json\n{"ok": true}\n```'
        llm._call_model = fake
        self.assertEqual(llm.generate_json("p", schema=dict), {"ok": True})
        self.assertEqual(calls, [dict, None])
        self.assertEqual(llm.generate_json("p", schema=dict), {"ok": True})
        self.assertEqual(len(calls), 2)  # second answer came from the cache

    def test_rate_limit_retries_then_unavailable_and_ai_json_returns_none(self):
        settings.gemini_api_key = "x"

        class Err(Exception):
            code = 429
        n = [0]

        def fake(*a):
            n[0] += 1
            raise Err("RESOURCE_EXHAUSTED")
        llm._call_model = fake
        with self.assertRaises(llm.LLMUnavailable):
            llm.generate_json("q1")
        self.assertEqual(n[0], 3)
        self.assertIsNone(llm.ai_json("q2"))

    def test_bad_key_and_bad_model_give_clear_errors(self):
        settings.gemini_api_key = "x"

        class Err(Exception):
            def __init__(self, msg, code):
                super().__init__(msg)
                self.code = code
        llm._call_model = lambda *a: (_ for _ in ()).throw(Err("API key not valid", 403))
        with self.assertRaises(llm.LLMError) as cm:
            llm.generate_json("k1")
        self.assertIn("GEMINI_API_KEY", str(cm.exception))
        llm._call_model = lambda *a: (_ for _ in ()).throw(Err("model not found", 404))
        with self.assertRaises(llm.LLMError) as cm:
            llm.generate_json("k2")
        self.assertIn("GEMINI_MODEL", str(cm.exception))

    def test_invalid_json_is_retried(self):
        settings.gemini_api_key = "x"
        answers = iter(["not json at all", '{"a": 1}'])
        llm._call_model = lambda *a: next(answers)
        self.assertEqual(llm.generate_json("j1"), {"a": 1})

    def test_disabled_without_key(self):
        settings.gemini_api_key = ""
        self.assertIsNone(llm.ai_json("anything"))


if __name__ == "__main__":
    unittest.main()
