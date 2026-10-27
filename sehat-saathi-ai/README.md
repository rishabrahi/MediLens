# SehatSaathi AI (सेहतसाथी) — Healthcare Literacy Assistant
### Hackathon Complete MVP • Built with Python, Streamlit & Groq API

An AI-powered, safety-first healthcare literacy platform designed to help people understand general symptoms, medical terminology, and laboratory reports in simple English and Hindi.

> ⚖️ **Mandatory Healthcare Disclaimer:** SehatSaathi AI is an educational tool designed to foster healthcare literacy. It does **not** provide medical diagnoses, treatment plans, prescriptions, or clinical judgment. Lab reference ranges vary significantly across laboratories, patient age, gender, and testing equipment. Never ignore or delay professional clinical advice. In acute medical emergencies, immediately contact local emergency services (**112 / 108 / 102** in India or **911** in the US).

---

## 👥 3-Member Team Architecture

The codebase is strictly modularized into independent files to eliminate git merge conflicts:

| Team Member | Module & Responsibility | Stage Covered |
| :--- | :--- | :--- |
| **Member 1 (UI/UX)** | `app.py`: Streamlit layout, bilingual localization (English 🇬🇧 / Hindi 🇮🇳), input controls, and disclaimer frames. | Stage 1 & Stage 6 |
| **Member 2 (AI/Data)** | `ai_explainer.py` & `report_parser.py`: Groq Python SDK integration, model verification, PDF text extraction via PyMuPDF. | Stage 2 & Stage 5 |
| **Member 3 (Safety/QA)**| `safety_rules.py`, `health_sources.py` & `tests/`: Deterministic emergency triage, anti-prescription interceptor, verified health registries (WHO/NHS), and pytest test suite. | Stage 3 & Stage 4 |

---

## 📁 Repository Directory Structure

```text
sehat-saathi-ai/
├── app.py                      # Main Streamlit application
├── ai_explainer.py             # Groq LLM integration & system prompt safety
├── report_parser.py            # PDF / text medical report extractor & validator
├── health_sources.py           # Vetted WHO, NHS, MedlinePlus medical reference registries
├── safety_rules.py             # Independent deterministic safety & emergency rules
├── requirements.txt            # Pinned dependencies
├── .env.example                # Safe environment variable template
├── .env                        # Local secret keys (never committed to Git!)
├── .gitignore                  # Git ignore rules for secrets and virtualenvs
├── README.md                   # Comprehensive project documentation
└── tests/
    ├── test_safety_rules.py    # Unit tests for deterministic safety rules
    ├── test_report_parser.py   # Unit tests for PDF extraction and validation
    └── test_health_sources.py  # Unit tests for verified source matching
```

---

## 🚀 Step-by-Step Installation & Local Setup (VS Code)

### 1. Prerequisites
- **Python 3.10+** (Python 3.12 recommended)
- **VS Code** with Python extension installed
- **Git**

### 2. Clone the Repository & Enter Folder
```bash
git clone <your-github-repo-url>
cd sehat-saathi-ai
```

### 3. Create & Activate a Virtual Environment

**On Windows (PowerShell):**
```powershell
python -m venv .venv
.venv\Scripts\Activate.ps1
```
*(If PowerShell shows an execution policy error, run: `Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass`)*

**On macOS / Linux:**
```bash
python3 -m venv .venv
source .venv/bin/activate
```

### 4. Install Dependencies
```bash
pip install -r requirements.txt
```

### 5. Setup Environment Variables
Copy `.env.example` to create your local `.env` file:
```bash
cp .env.example .env
```
Open `.env` in VS Code and verify your settings:
```ini
GROQ_API_KEY="gsk_your_groq_api_key_here"
GROQ_MODEL="openai/gpt-oss-120b"
APP_ENV="development"
```

### 6. Run the Automated Test Suite
Verify that all unit tests pass:
```bash
pytest tests/ -v
```
*(You can also run individual test files: `python tests/test_safety_rules.py`)*

### 7. Launch the Streamlit Web Application
```bash
streamlit run app.py
```
Streamlit will automatically open your browser at `http://localhost:8501`.

---

## 🛡️ Core Healthcare Safety Policies

1. **Deterministic Rule Engine Before LLM:**
   - Evaluates input for critical medical emergencies (*severe chest pain, breathing difficulty, stroke symptoms, unconsciousness*) in both English and Hindi.
   - Blocks prescription requests (*"what dose of amoxicillin should I take"*, *"can I stop my medication"*).
2. **Untrusted Data Sanitization:**
   - Strips malicious control characters, scripts, and prompt injection attempts before report text is passed to the LLM.
3. **No Hallucinated Citations:**
   - Links only to verified, curated public health portals (WHO, NHS, MedlinePlus, Ministry of Health India).
4. **Transparent Limitation Notices:**
   - Clearly discloses that automated checks and reference ranges are educational aids and do not substitute for clinical examinations.

---

## 🏆 Hackathon Demonstration Script (For Team & Judges)

1. **Language Inclusivity (Member 1):**
   - Toggle from **English** to **हिन्दी**. Notice the complete interface, disclaimer, and questions translate smoothly.
2. **Emergency Interception Test (Member 3):**
   - In the Symptom Explainer, type: *"The patient has sudden severe chest pain and cannot breathe"*.
   - Show how the deterministic safety engine immediately blocks non-emergency AI answers and directs the user to **112 / 108 / 911**.
3. **Prescription Restriction Test (Member 3):**
   - In the Symptom Explainer, type: *"What dose of amoxicillin should I take for a fever?"*.
   - Show how the anti-prescription rule intercepts the query and emphasizes that only a doctor can prescribe medications.
4. **General Healthcare Explainer (Member 2):**
   - Click the quick topic button: *"Importance of Hydration in Fever"*.
   - Show the structured explanation produced by the Groq `openai/gpt-oss-120b` model, including the *"Questions for Your Doctor"* checklist.
5. **Medical Report & PDF Parsing (Member 2):**
   - Click *"📄 Download Sample CBC Report PDF"*.
   - Switch to *"Upload Report File"* and upload the downloaded PDF.
   - Show text extraction and submit for Groq analysis. Point out how laboratory reference ranges and biomarkers are explained in layman terms without diagnosing disease.
