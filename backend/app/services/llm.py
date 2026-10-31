"""AI wrapper: Ollama (default, free) or Gemini. Gives JSON answers with throttling, retries and caching.
Ollama is called with plain HTTP (no extra package needed). Gemini's package is only imported if you choose it.
If the AI is unreachable, callers use their built-in fallback logic, so the app never stops working."""
import hashlib
import json
import logging
import random
import re
import socket
import threading
import time
import urllib.error
import urllib.request
from collections import OrderedDict

from ..config import settings

log = logging.getLogger("talentos.llm")


class LLMError(Exception):
    """The AI was reachable but the call failed (model missing, bad output, ...)."""


class LLMUnavailable(LLMError):
    """The AI is switched off, not running, or overloaded. Callers should use their fallback."""


class _HttpError(Exception):
    def __init__(self, status_code, message):
        super().__init__(message)
        self.status_code = status_code


_lock = threading.Lock()
_last_call = [0.0]
_cache = OrderedDict()
_clients = {}
_ready = {"at": 0.0, "value": None}


def provider():
    return (settings.llm_provider or "ollama").strip().lower()


def model_name():
    return settings.gemini_model if provider() == "gemini" else settings.ollama_model


def key_setting():
    return "GEMINI_API_KEY" if provider() == "gemini" else "OLLAMA_BASE_URL"


def model_setting():
    return "GEMINI_MODEL" if provider() == "gemini" else "OLLAMA_MODEL"


def is_enabled():
    """True when the chosen provider is configured. (It does not check that Ollama is actually running: see check_ready.)"""
    if provider() == "gemini":
        return bool((settings.gemini_api_key or "").strip())
    if provider() == "ollama":
        return bool((settings.ollama_base_url or "").strip() and (settings.ollama_model or "").strip())
    return False


def parse_json_text(text):
    """Parse model output into Python data. Tolerates ```json fences and text around the JSON. Raises ValueError."""
    t = (text or "").strip()
    t = re.sub(r"^```(?:json)?\s*|\s*```$", "", t, flags=re.I).strip()
    try:
        return json.loads(t)
    except json.JSONDecodeError:
        pass
    starts = [i for i in (t.find("{"), t.find("[")) if i != -1]
    if starts:
        i = min(starts)
        j = max(t.rfind("}"), t.rfind("]"))
        if j > i:
            try:
                return json.loads(t[i:j + 1])
            except json.JSONDecodeError:
                pass
    raise ValueError("The AI returned text that is not valid JSON")


def _throttle():
    gap = 60.0 / max(1, settings.llm_rpm)
    with _lock:
        wait = _last_call[0] + gap - time.monotonic()
        if wait > 0:
            time.sleep(wait)
        _last_call[0] = time.monotonic()


# ------------------------------------------------------------------ Ollama
def _ollama_url(path):
    return settings.ollama_base_url.rstrip("/") + path


def _http_json(method, url, payload=None, timeout=10):
    data = json.dumps(payload).encode() if payload is not None else None
    req = urllib.request.Request(url, data=data, method=method, headers={"Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return json.loads(r.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8", "ignore")
        try:
            body = json.loads(body).get("error", body)
        except (ValueError, AttributeError):
            pass
        raise _HttpError(e.code, str(body)[:300]) from e
    except urllib.error.URLError as e:
        if isinstance(e.reason, (socket.timeout, TimeoutError)):
            raise _HttpError(504, "request timed out") from e
        raise LLMUnavailable(f"Ollama is not reachable at {settings.ollama_base_url} - is it running? (start the Ollama app, or check OLLAMA_BASE_URL)") from e
    except (socket.timeout, TimeoutError) as e:
        raise _HttpError(504, "request timed out") from e


def _call_ollama(prompt, system, max_output_tokens):
    messages = ([{"role": "system", "content": system}] if system else []) + [{"role": "user", "content": prompt}]
    payload = {
        "model": settings.ollama_model, "messages": messages, "stream": False, "format": "json",
        "keep_alive": settings.ollama_keep_alive,
        "options": {"temperature": 0, "seed": 7, "num_ctx": settings.ollama_num_ctx, "num_predict": min(max_output_tokens, 4096)},
    }
    out = _http_json("POST", _ollama_url("/api/chat"), payload, timeout=settings.llm_timeout_s)
    text = ((out or {}).get("message") or {}).get("content")
    if not text:
        raise LLMError("Ollama returned an empty answer")
    return text


def check_ready():
    """True / False: can we reach the AI and is the model installed? None if no AI is configured. Cached for 15 seconds."""
    if not is_enabled():
        return None
    if provider() == "gemini":
        return True
    if time.monotonic() - _ready["at"] < 15 and _ready["value"] is not None:
        return _ready["value"]
    try:
        tags = _http_json("GET", _ollama_url("/api/tags"), timeout=3)
        want = settings.ollama_model.strip()
        names = [m.get("name", "") for m in (tags or {}).get("models", [])]
        ok = any(n == want or n.startswith(want + ":") or (":" not in want and n.split(":")[0] == want) for n in names)
    except (LLMError, _HttpError):
        ok = False
    _ready.update(at=time.monotonic(), value=ok)
    return ok


# ------------------------------------------------------------------ Gemini (optional)
def _gemini_client():
    if "gemini" not in _clients:
        from google import genai
        from google.genai import types
        try:
            _clients["gemini"] = genai.Client(api_key=settings.gemini_api_key, http_options=types.HttpOptions(timeout=settings.llm_timeout_s * 1000))
        except TypeError:
            _clients["gemini"] = genai.Client(api_key=settings.gemini_api_key)
    return _clients["gemini"]


def _call_gemini(prompt, system, schema, max_output_tokens):
    from google.genai import types
    cfg = {"temperature": 0.0, "max_output_tokens": max_output_tokens, "response_mime_type": "application/json"}
    if system:
        cfg["system_instruction"] = system
    if schema is not None:
        cfg["response_schema"] = schema
    resp = _gemini_client().models.generate_content(model=settings.gemini_model, contents=prompt, config=types.GenerateContentConfig(**cfg))
    text = getattr(resp, "text", None)
    if not text:
        raise LLMError("Gemini returned an empty response (it may have been blocked or cut off)")
    return text


def _call_model(prompt, system, schema, max_output_tokens):
    """One raw call to the chosen provider; returns the answer text. Isolated so tests can replace it."""
    if provider() == "gemini":
        return _call_gemini(prompt, system, schema, max_output_tokens)
    if provider() == "ollama":
        return _call_ollama(prompt, system, max_output_tokens)
    raise LLMError("LLM_PROVIDER in .env must be 'ollama' or 'gemini'")


def _status(e):
    for attr in ("code", "status_code"):
        v = getattr(e, attr, None)
        if isinstance(v, int):
            return v
    return None


def generate_json(prompt, *, system=None, schema=None, max_output_tokens=8192, use_cache=True):
    """Ask the AI for JSON and return the parsed data. Raises LLMUnavailable (use the fallback) or LLMError."""
    if not is_enabled():
        raise LLMUnavailable(f"{key_setting()} is empty or LLM_PROVIDER is wrong - running in fallback mode")
    key = hashlib.sha256(f"{provider()}|{model_name()}|{system}|{prompt}".encode()).hexdigest()
    if use_cache and key in _cache:
        _cache.move_to_end(key)
        return _cache[key]

    use_schema = schema
    attempts = settings.llm_max_retries + 1
    for attempt in range(attempts):
        last = attempt == attempts - 1
        try:
            _throttle()
            text = _call_model(prompt, system, use_schema, max_output_tokens)
        except LLMUnavailable:
            raise  # not running / switched off: retrying will not help
        except LLMError:
            if last:
                raise
            time.sleep(0.5)
            continue
        except Exception as e:  # HTTP / SDK errors
            msg, status = str(e), _status(e)
            low = msg.lower()
            if status in (401, 403) or "api key" in low:
                raise LLMError(f"The AI provider rejected the credentials - check {key_setting()} in .env") from e
            if status == 404 or "not found" in low:
                hint = f"run:  ollama pull {settings.ollama_model}" if provider() == "ollama" else f"change {model_setting()} in .env"
                raise LLMError(f"The AI model '{model_name()}' was not found - {hint}") from e
            if use_schema is not None and (status == 400 or isinstance(e, (ValueError, TypeError))):
                use_schema = None  # schema rejected: retry once in plain JSON mode
                continue
            retryable = status in (429, 500, 502, 503, 504) or any(k in low for k in ("rate limit", "resource_exhausted", "unavailable", "overloaded", "timed out", "timeout"))
            if not retryable:
                raise LLMError(f"AI call failed: {msg[:300]}") from e
            if last:
                raise LLMUnavailable("The AI is overloaded, timed out or rate-limited right now") from e
            time.sleep(min(30, (2 ** attempt) * 2 + random.random()))
            continue
        try:
            data = parse_json_text(text)
        except ValueError as e:
            if last:
                raise LLMError(str(e)) from e
            continue
        if use_cache:
            _cache[key] = data
            while len(_cache) > 256:
                _cache.popitem(last=False)
        return data
    raise LLMUnavailable("The AI did not return a usable answer")


def ai_json(prompt, system=None, schema=None, use_cache=True, max_output_tokens=8192):
    """Like generate_json, but returns None instead of raising, so every caller can fall back gracefully."""
    try:
        return generate_json(prompt, system=system, schema=schema, use_cache=use_cache, max_output_tokens=max_output_tokens)
    except LLMUnavailable as e:
        log.info("AI not used: %s", e)
    except LLMError as e:
        log.warning("AI error: %s", e)
    return None