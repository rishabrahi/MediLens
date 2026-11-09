# MediLens

MediLens is a bilingual healthcare-literacy app. Its React frontend explains
health topics, symptoms, and lab reports in simple English or Hindi. The
FastAPI backend applies deterministic safety checks and can use Groq for
explanations and report-image transcription.

> **Medical notice:** MediLens is for education, not diagnosis, treatment, or
> prescriptions. It is not an emergency service. Contact local emergency
> services for urgent symptoms and consult a qualified health professional.

## Requirements

- Node.js 20.19+ or 22.12+ and npm
- Python 3.10+
- A Groq API key for AI explanations and image transcription

## Local setup

1. Install frontend dependencies:

   ```powershell
   npm install
   ```

2. Create and activate a Python environment, then install the API dependencies:

   ```powershell
   python -m venv .venv
   .venv\Scripts\Activate.ps1
   python -m pip install -r backend\requirements.txt
   ```

3. Copy `.env.example` to `.env` and add your Groq API key:

   ```powershell
   Copy-Item .env.example .env
   ```

4. Start the API and frontend in separate terminals:

   ```powershell
   npm run dev:api
   npm run dev
   ```

   Open the Vite URL printed in the frontend terminal. Vite forwards `/api`
   requests to `http://127.0.0.1:8000`. The API health check and interactive
   documentation are at `http://127.0.0.1:8000/api/health` and
   `http://127.0.0.1:8000/docs`.

For deployment, serve the frontend and API on the same origin with `/api`
proxied to the FastAPI server, or set `CORS_ORIGINS` to the frontend origin.
Keep `GROQ_API_KEY` on the server; do not put it in a `VITE_` variable.

## Checks

```powershell
npm run lint
npm run build
python -m pytest backend\tests -q
```

## Project layout

- `src/` — React frontend
- `backend/main.py` — FastAPI routes and Groq integration
- `backend/safety_rules.py` — bilingual emergency, prescription, and input-safety checks
- `backend/tests/` — API and safety tests
