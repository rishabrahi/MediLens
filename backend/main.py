from __future__ import annotations

import base64
import binascii
import os
import re
from pathlib import Path
from typing import Literal

import httpx
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, RedirectResponse
from pydantic import BaseModel, ConfigDict, Field

from backend.safety_rules import evaluate_safety


ROOT_DIR = Path(__file__).resolve().parents[1]
load_dotenv(ROOT_DIR / ".env")

GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions"
GROQ_API_KEY = os.getenv("GROQ_API_KEY", "").strip()
GROQ_MODEL = os.getenv("GROQ_MODEL", "openai/gpt-oss-120b").strip()
GROQ_VISION_MODELS = [
    model.strip()
    for model in os.getenv(
        "GROQ_VISION_MODELS",
        "meta-llama/llama-4-scout-17b-16e-instruct",
    ).split(",")
    if model.strip()
]
MAX_IMAGE_DATA_URL_LENGTH = 8_000_000
MAX_REPORT_LENGTH = 30_000

app = FastAPI(title="MediLens API", version="1.0.0")
allowed_origins = [
    origin.strip()
    for origin in os.getenv(
        "CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173"
    ).split(",")
    if origin.strip()
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type"],
)


class APIModel(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="forbid")


class TopicRequest(APIModel):
    query: str = Field(min_length=1, max_length=5_000)
    language: Literal["en", "hi"] = "en"


class ChatRequest(APIModel):
    query: str | None = Field(default=None, max_length=5_000)
    message: str | None = Field(default=None, max_length=5_000)
    language: Literal["en", "hi"] = "en"


class ReportRequest(APIModel):
    report_text: str = Field(alias="reportText", min_length=1, max_length=MAX_REPORT_LENGTH)
    language: Literal["en", "hi"] = "en"


class ImageRequest(APIModel):
    image: str = Field(min_length=1, max_length=MAX_IMAGE_DATA_URL_LENGTH)


HEALTH_TOPIC_PROMPT = """
You are MediLens, a healthcare literacy assistant. Explain the health topic in
clear, everyday language for a non-medical reader. Answer only in {language}.
Do not diagnose the user, prescribe medicines, recommend doses, or claim a cure.
Explain what the topic is, common causes, and safe general steps that may help.
Use short sentences and explain any medical terms. Advise appropriate professional
care for persistent or concerning symptoms. Do not repeat the user's question.
"""

REPORT_PROMPT = """
You are MediLens, a laboratory-report literacy assistant. Explain every test and
value in clear, everyday language. Answer only in {language}. Explain what each
test measures and, when a reference range is supplied, whether the result is
within that range. Discuss possible general reasons for out-of-range values
without diagnosing the reader. Do not prescribe medicines or doses. Explain that
ranges vary by laboratory and one result is not a diagnosis. Finish every point.
"""

TRANSCRIPTION_PROMPT = """
Transcribe only the visible text from this laboratory report image. Include test
names, results, units, and reference ranges. Put one result on each line. Do not
explain or diagnose. Mark unreadable text as [unclear]. Return only the
transcription.
"""


@app.get("/", include_in_schema=False)
async def api_root() -> RedirectResponse:
    return RedirectResponse(url="/docs")


@app.exception_handler(HTTPException)
async def handle_http_error(_request: Request, exc: HTTPException) -> JSONResponse:
    return JSONResponse(status_code=exc.status_code, content={"error": str(exc.detail)})


@app.exception_handler(RequestValidationError)
async def handle_validation_error(
    _request: Request, exc: RequestValidationError
) -> JSONResponse:
    first_error = exc.errors()[0]
    message = str(first_error["msg"]).removeprefix("Value error, ")
    if first_error["loc"][-1:] == ("image",) and first_error["type"] == "string_too_long":
        return JSONResponse(
            status_code=413,
            content={
                "error": "That photo is too large. Use a smaller image or paste the text."
            },
        )
    return JSONResponse(status_code=422, content={"error": message})


def _language_name(language: Literal["en", "hi"]) -> str:
    return "simple, clear Hindi" if language == "hi" else "simple, clear English"


def _safety_response(text: str, language: Literal["en", "hi"]) -> dict | None:
    assessment = evaluate_safety(text, language)
    if assessment.is_safe_to_proceed:
        return None

    if assessment.is_emergency:
        status = "emergency"
        content = assessment.warning_message
    elif assessment.is_prescription_attempt:
        status = "prescription_blocked"
        content = assessment.warning_message
    else:
        status = "blocked"
        content = assessment.warning_message

    return {
        "status": status,
        "content": content,
        "modelUsed": "deterministic-safety-engine",
        "language": language,
    }


async def _groq_completion(
    messages: list[dict], *, max_tokens: int, model: str = GROQ_MODEL
) -> tuple[str, str]:
    if not GROQ_API_KEY:
        raise HTTPException(
            status_code=503,
            detail="AI explanations are unavailable. Configure GROQ_API_KEY in the project .env file.",
        )

    headers = {
        "Authorization": f"Bearer {GROQ_API_KEY}",
        "Content-Type": "application/json",
        "User-Agent": "MediLens-API/1.0",
    }
    payload = {
        "model": model,
        "messages": messages,
        "temperature": 0.2,
        "max_tokens": max_tokens,
    }

    try:
        async with httpx.AsyncClient(timeout=45.0) as client:
            response = await client.post(GROQ_API_URL, headers=headers, json=payload)
    except httpx.TimeoutException as exc:
        raise HTTPException(
            status_code=504, detail="The AI service took too long to respond. Please try again."
        ) from exc
    except httpx.HTTPError as exc:
        raise HTTPException(
            status_code=502, detail="Could not connect to the AI service. Please try again."
        ) from exc

    if response.status_code == 401:
        raise HTTPException(
            status_code=503, detail="The configured Groq API key was rejected."
        )
    if response.status_code == 429:
        raise HTTPException(
            status_code=503, detail="The AI service is busy. Please try again shortly."
        )
    if response.status_code >= 400:
        raise HTTPException(
            status_code=502,
            detail=f"The AI service returned an error (HTTP {response.status_code}).",
        )

    try:
        data = response.json()
        content = data["choices"][0]["message"]["content"].strip()
        model_used = data.get("model", model)
    except (ValueError, KeyError, IndexError, TypeError, AttributeError) as exc:
        raise HTTPException(
            status_code=502, detail="The AI service returned an invalid response."
        ) from exc

    if not content:
        raise HTTPException(status_code=502, detail="The AI service returned an empty response.")
    return content, model_used


async def _explain_topic(query: str, language: Literal["en", "hi"]) -> dict:
    clean_query = query.strip()
    if len(clean_query) < 3:
        raise HTTPException(
            status_code=400,
            detail="Query is too short. Please provide symptoms or a healthcare topic.",
        )

    safety_result = _safety_response(clean_query, language)
    if safety_result:
        return safety_result

    answer, model_used = await _groq_completion(
        [
            {
                "role": "system",
                "content": HEALTH_TOPIC_PROMPT.format(language=_language_name(language)),
            },
            {"role": "user", "content": clean_query},
        ],
        max_tokens=1_600,
    )
    return {
        "status": "success",
        "content": answer,
        "modelUsed": model_used,
        "language": language,
    }


@app.get("/api/health")
async def health_check() -> dict:
    return {
        "status": "ok",
        "groqConfigured": bool(GROQ_API_KEY),
        "model": GROQ_MODEL,
    }


@app.post("/api/groq/explain-topic")
async def explain_topic(request: TopicRequest) -> dict:
    return await _explain_topic(request.query, request.language)


@app.post("/api/groq/chat")
async def chat(request: ChatRequest) -> dict:
    query = (request.message or request.query or "").strip()
    if not query:
        raise HTTPException(status_code=400, detail="Message or query is required.")
    return await _explain_topic(query, request.language)


@app.post("/api/groq/explain-report")
async def explain_report(request: ReportRequest) -> dict:
    report_text = request.report_text.strip()
    if len(report_text) < 15:
        raise HTTPException(
            status_code=400,
            detail="Report text is too short. Please include lab markers and values.",
        )

    safety_result = _safety_response(report_text, request.language)
    if safety_result:
        return safety_result

    safe_report = evaluate_safety(report_text, request.language).sanitized_text
    answer, model_used = await _groq_completion(
        [
            {
                "role": "system",
                "content": REPORT_PROMPT.format(language=_language_name(request.language)),
            },
            {"role": "user", "content": safe_report},
        ],
        max_tokens=1_600,
    )
    return {
        "status": "success",
        "content": answer,
        "modelUsed": model_used,
        "language": request.language,
    }


def _decode_report_image(data_url: str) -> tuple[str, str]:
    match = re.fullmatch(
        r"data:image/(jpeg|jpg|png|webp);base64,([A-Za-z0-9+/=\r\n]+)",
        data_url,
        re.IGNORECASE,
    )
    if not match:
        raise HTTPException(
            status_code=400, detail="Upload a JPG, PNG, or WebP photo of the report."
        )

    image_type = match.group(1).lower()
    try:
        image_bytes = base64.b64decode(match.group(2), validate=True)
    except (binascii.Error, ValueError) as exc:
        raise HTTPException(status_code=400, detail="The image data is invalid.") from exc

    signatures = {
        "jpeg": image_bytes.startswith(b"\xff\xd8\xff"),
        "jpg": image_bytes.startswith(b"\xff\xd8\xff"),
        "png": image_bytes.startswith(b"\x89PNG\r\n\x1a\n"),
        "webp": image_bytes.startswith(b"RIFF") and image_bytes[8:12] == b"WEBP",
    }
    if not image_bytes or not signatures[image_type]:
        raise HTTPException(
            status_code=400, detail="The image data does not match its file type."
        )

    mime_type = "jpeg" if image_type == "jpg" else image_type
    return mime_type, base64.b64encode(image_bytes).decode("ascii")


@app.post("/api/groq/image-to-text")
async def image_to_text(request: ImageRequest) -> dict:
    if len(request.image) > MAX_IMAGE_DATA_URL_LENGTH:
        raise HTTPException(
            status_code=413,
            detail="That photo is too large. Use a smaller image or paste the text.",
        )

    mime_type, image_base64 = _decode_report_image(request.image)
    if not GROQ_API_KEY:
        raise HTTPException(
            status_code=503,
            detail="Image reading is unavailable. Configure GROQ_API_KEY in the project .env file.",
        )

    image_url = f"data:image/{mime_type};base64,{image_base64}"
    last_error: HTTPException | None = None
    for model in GROQ_VISION_MODELS:
        try:
            text, model_used = await _groq_completion(
                [
                    {
                        "role": "user",
                        "content": [
                            {"type": "text", "text": TRANSCRIPTION_PROMPT},
                            {"type": "image_url", "image_url": {"url": image_url}},
                        ],
                    }
                ],
                max_tokens=1_200,
                model=model,
            )
            text = re.sub(r"^```[a-z]*\s*", "", text, flags=re.IGNORECASE)
            text = re.sub(r"\s*```$", "", text).strip()
            if len(text) < 15:
                raise HTTPException(
                    status_code=422,
                    detail="Not enough text was found in that photo. Try a clearer picture or paste the results.",
                )
            return {"status": "success", "text": text, "modelUsed": model_used}
        except HTTPException as exc:
            last_error = exc
            if exc.status_code in {503, 504}:
                raise

    if last_error is not None:
        raise last_error
    raise HTTPException(status_code=503, detail="No image-reading model is configured.")
