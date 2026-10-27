"""
SehatSaathi AI / MediLens - Groq LLM Explainer Module (ai_explainer.py)
------------------------------------------------------------------------
Minimal, Bite-Sized, Plain-Language Output Engine:
- Keeps responses under 120-140 words.
- Eliminates messy text walls and complex jargon.
- Retains essential safety: non-diagnostic, no prescribing, questions for doctor.
- Dual-mode dispatcher: official groq SDK with standard urllib fallback.
"""

import os
import json
import urllib.request
import urllib.error
from typing import Dict, Any, List, Optional

# ------------------------------------------------------------------------------
# 1. ENVIRONMENT CONFIGURATION
# ------------------------------------------------------------------------------
def get_groq_config() -> Dict[str, str]:
    """Retrieve Groq API key and model name securely from .env or environment."""
    api_key = os.getenv("GROQ_API_KEY", "").strip()
    model = os.getenv("GROQ_MODEL", "openai/gpt-oss-120b").strip()

    if not api_key:
        candidate_paths = [
            os.path.join(os.path.dirname(__file__), ".env"),
            os.path.join(os.getcwd(), ".env"),
            os.path.join(os.getcwd(), "sehat-saathi-ai", ".env")
        ]
        for path in candidate_paths:
            if os.path.exists(path):
                try:
                    with open(path, "r", encoding="utf-8") as f:
                        for line in f:
                            clean_line = line.strip()
                            if clean_line.startswith("GROQ_API_KEY="):
                                api_key = clean_line.split("=", 1)[1].strip().strip('"').strip("'")
                            elif clean_line.startswith("GROQ_MODEL="):
                                model = clean_line.split("=", 1)[1].strip().strip('"').strip("'")
                except Exception:
                    pass
                if api_key:
                    break

    return {
        "api_key": api_key,
        "model": model or "openai/gpt-oss-120b"
    }


# ==============================================================================
# 2. MINIMAL, SIMPLE, BITE-SIZED SYSTEM PROMPTS
# ==============================================================================
SYSTEM_HEALTHCARE_SAFETY_PROMPT = """
You are MediLens / SehatSaathi AI, a friendly healthcare literacy assistant.
Your goal is to explain health topics, symptoms, and bodily processes in VERY SIMPLE, BITE-SIZED, MINIMAL language.

CRITICAL INSTRUCTIONS:
1. KEEP IT SHORT & CRISP: Do NOT write long essays or messy walls of text. Keep your entire response strictly under 120-140 words.
2. EXPLAIN LIKE A FRIEND: Use simple everyday words (no complex medical jargon).
3. LANGUAGE: Answer completely in {target_language}.
4. STRICT SAFETY: Never diagnose diseases, never prescribe medication or doses.

FORMAT EXACTLY LIKE THIS:
💡 In Simple Words:
[1-2 clear sentences explaining the concept in plain everyday words]

⚠️ Good to Know:
• [1 brief bullet: this is for education, not a diagnosis]
• [1 brief bullet: safe general tip like hydration or when to see a doctor]

🩺 2 Questions to Ask Your Doctor:
1. [Short, practical question]
2. [Short, practical question]
"""

SYSTEM_REPORT_PROMPT = """
You are MediLens / SehatSaathi AI. Explain medical lab reports in VERY SIMPLE, BITE-SIZED language (under 130 words).
Do NOT write messy or lengthy output.

FORMAT EXACTLY LIKE THIS:
🧪 Quick Lab Summary:
• [Key test name]: [1 simple sentence on what it measures and whether it's within or outside normal range]

💡 In Simple Words:
[1-2 clear sentences explaining why lab reference ranges vary by clinic/machine and that one out-of-range number is not an automatic diagnosis]

🩺 2 Questions for Your Doctor:
1. [Short question]
2. [Short question]
"""

# ==============================================================================
# 3. LOW-LEVEL GROQ DISPATCHER (SDK or Built-in urllib)
# ==============================================================================
def call_groq_api(
    messages: List[Dict[str, str]],
    model_override: Optional[str] = None,
    max_tokens: int = 350,
    temperature: float = 0.2
) -> Dict[str, Any]:
    """
    Executes a chat completion request to Groq.
    Prefers official 'groq' SDK if installed; falls back to standard urllib.
    """
    config = get_groq_config()
    api_key = config["api_key"]
    model = model_override or config["model"]

    if not api_key or api_key == "gsk_your_groq_api_key_here":
        raise ValueError(
            "GROQ_API_KEY is not configured in .env. Please add your real Groq API key."
        )

    # Attempt 1: Try official groq SDK if installed
    try:
        from groq import Groq
        client = Groq(api_key=api_key)
        response = client.chat.completions.create(
            model=model,
            messages=messages,
            temperature=temperature,
            max_tokens=max_tokens,
        )
        content = response.choices[0].message.content or ""
        return {
            "content": content,
            "model": model,
            "backend": "groq-python-sdk"
        }
    except ImportError:
        pass
    except Exception as sdk_err:
        err_msg = str(sdk_err)
        if "model_not_found" in err_msg:
            model = "openai/gpt-oss-120b"
        else:
            raise sdk_err

    # Attempt 2: Standard Library urllib.request (Zero Dependencies)
    url = "https://api.groq.com/openai/v1/chat/completions"
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
        "User-Agent": "MediLens-AI/1.0"
    }

    payload = {
        "model": model,
        "messages": messages,
        "temperature": temperature,
        "max_tokens": max_tokens
    }

    req = urllib.request.Request(
        url,
        data=json.dumps(payload).encode("utf-8"),
        headers=headers,
        method="POST"
    )

    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            content = data["choices"][0]["message"]["content"]
            return {
                "content": content,
                "model": data.get("model", model),
                "backend": "urllib-fallback"
            }
    except urllib.error.HTTPError as http_err:
        raw_error = http_err.read().decode("utf-8")
        try:
            parsed = json.loads(raw_error)
            err_detail = parsed.get("error", {}).get("message", raw_error)
        except Exception:
            err_detail = raw_error

        if http_err.code == 401:
            raise PermissionError("Invalid Groq API key.")
        elif http_err.code == 404:
            raise KeyError(f"Configured model '{model}' not found: {err_detail}")
        elif http_err.code == 429:
            raise RuntimeError("Groq API rate limit reached. Please retry in a moment.")
        else:
            raise RuntimeError(f"Groq API Error: {err_detail}")
    except urllib.error.URLError as url_err:
        raise ConnectionError(f"Network error connecting to Groq API: {url_err}")


# ==============================================================================
# 4. HIGH-LEVEL FUNCTIONS
# ==============================================================================
def explain_health_topic(
    query: str,
    language: str = "en"
) -> Dict[str, Any]:
    target_lang = "Hindi (सरल हिंदी)" if language == "hi" else "Simple English"

    clean_query = query.strip() if query else ""
    if len(clean_query) < 5:
        return {
            "status": "error",
            "error_type": "ValidationError",
            "message": "Query is too short. Please provide at least 5 to 10 characters."
        }

    system_prompt = SYSTEM_HEALTHCARE_SAFETY_PROMPT.format(
        target_language=target_lang
    )

    messages = [
        {"role": "system", "content": system_prompt},
        {
            "role": "user",
            "content": f"Explain this health topic in very simple, short {target_lang}: '{clean_query}'"
        }
    ]

    try:
        response = call_groq_api(messages, max_tokens=350)
        return {
            "status": "success",
            "model_used": response["model"],
            "backend": response["backend"],
            "language": language,
            "content": response["content"]
        }
    except Exception as e:
        return {
            "status": "error",
            "error_type": type(e).__name__,
            "message": str(e)
        }


def explain_medical_report(
    report_text: str,
    language: str = "en"
) -> Dict[str, Any]:
    target_lang = "Hindi (सरल हिंदी)" if language == "hi" else "Simple English"

    clean_report = report_text.strip() if report_text else ""
    if len(clean_report) < 15:
        return {
            "status": "error",
            "error_type": "ValidationError",
            "message": "Report text is too short. Please provide specific test names and values."
        }

    system_prompt = SYSTEM_REPORT_PROMPT.format(
        target_language=target_lang
    )

    messages = [
        {"role": "system", "content": system_prompt},
        {
            "role": "user",
            "content": f"Summarize this medical report in VERY SHORT, SIMPLE {target_lang}:\n\n{clean_report}"
        }
    ]

    try:
        response = call_groq_api(messages, max_tokens=350)
        return {
            "status": "success",
            "model_used": response["model"],
            "backend": response["backend"],
            "language": language,
            "content": response["content"]
        }
    except Exception as e:
        return {
            "status": "error",
            "error_type": type(e).__name__,
            "message": str(e)
        }


def check_emergency_symptoms(text: str) -> Dict[str, Any]:
    """
    Deterministic emergency check helper delegating to safety_rules.
    """
    try:
        from safety_rules import check_emergency_triage
        return check_emergency_triage(text)
    except Exception:
        # Fallback keyword scan
        lowered = text.lower() if text else ""
        emergency_words = ["chest pain", "shortness of breath", "stroke", "unconscious", "heart attack"]
        matched = [w for w in emergency_words if w in lowered]
        return {
            "is_emergency": len(matched) > 0,
            "matched_signals": matched,
            "emergency_numbers": {"india_national": "112"}
        }

