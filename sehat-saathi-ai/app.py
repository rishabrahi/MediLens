"""
SehatSaathi AI (सेहतसाथी) - Hackathon Complete Interactive MVP
---------------------------------------------------------------
Features:
- Bilingual English 🇬🇧 and Hindi 🇮🇳 with real-time UI switching
- Interactive Safety Sandbox testing (Emergency guard, Prescription interceptor, Safe explainer)
- Categorized 1-click healthcare inquiry cards
- Interactive Doctor Checklist with copy & print support
- Medical Jargon Glossary with search filter
- Multi-sample lab report loader (CBC, Lipid Profile, Blood Sugar HbA1c)
- PDF and Text report file uploader
- Verified healthcare reference links (WHO, NHS, MedlinePlus)
"""

import streamlit as st
import os

try:
    from ai_explainer import explain_health_topic, explain_medical_report, get_groq_config
    from safety_rules import evaluate_safety, get_safety_limitations_notice
    from health_sources import find_verified_sources
    from report_parser import parse_report_file, create_demo_pdf_bytes
except ImportError:
    from sehat_saathi_ai.ai_explainer import explain_health_topic, explain_medical_report, get_groq_config
    from sehat_saathi_ai.safety_rules import evaluate_safety, get_safety_limitations_notice
    from sehat_saathi_ai.health_sources import find_verified_sources
    from sehat_saathi_ai.report_parser import parse_report_file, create_demo_pdf_bytes

# ==============================================================================
# 1. PAGE SETUP
# ==============================================================================
st.set_page_config(
    page_title="SehatSaathi AI | सेहतसाथी",
    page_icon="🩺",
    layout="wide",
    initial_sidebar_state="expanded"
)

# Custom dark minimalist healthcare styling
st.markdown("""
<style>
    /* Dark Theme Core Styles */
    .stApp {
        background-color: #070b14;
        color: #f1f5f9;
    }
    .main-title {
        font-size: 2.3rem;
        font-weight: 800;
        letter-spacing: -0.03em;
        background: linear-gradient(135deg, #2dd4bf 0%, #38bdf8 100%);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        margin-bottom: 0.2rem;
    }
    .sub-title {
        font-size: 0.98rem;
        color: #94a3b8;
        margin-bottom: 1rem;
        letter-spacing: -0.01em;
    }
    .emergency-banner {
        background-color: rgba(69, 10, 10, 0.45);
        border: 1px solid rgba(239, 68, 68, 0.35);
        border-left: 4px solid #ef4444;
        padding: 0.85rem 1.1rem;
        border-radius: 8px;
        color: #fca5a5;
        font-size: 0.88rem;
        margin-bottom: 1.2rem;
    }
    .disclaimer-card {
        background-color: #0f172a;
        border: 1px solid #1e293b;
        border-radius: 8px;
        padding: 0.85rem 1.2rem;
        font-size: 0.82rem;
        color: #64748b;
        margin-top: 2rem;
        text-align: center;
    }
    .ai-result-box {
        background-color: #0f172a;
        border: 1px solid #1e293b;
        border-radius: 12px;
        padding: 1.3rem;
        margin-top: 1rem;
        color: #e2e8f0;
        box-shadow: 0 4px 20px -2px rgba(0, 0, 0, 0.4);
    }
    .source-card {
        background-color: #0f172a;
        border: 1px solid #1e293b;
        border-radius: 8px;
        padding: 0.75rem 1rem;
        margin-bottom: 0.5rem;
    }
    .source-card a {
        color: #2dd4bf;
        text-decoration: none;
    }
    .source-card a:hover {
        text-decoration: underline;
    }
    /* Clean Minimalist Inputs */
    .stTextArea textarea {
        background-color: #0f172a !important;
        border: 1px solid #1e293b !important;
        color: #f1f5f9 !important;
        border-radius: 8px !important;
    }
    .stTextArea textarea:focus {
        border-color: #14b8a6 !important;
        box-shadow: 0 0 0 1px #14b8a6 !important;
    }
</style>
""", unsafe_allow_html=True)

# ==============================================================================
# 2. LOCALIZATION
# ==============================================================================
I18N = {
    "en": {
        "app_title": "SehatSaathi AI",
        "tagline": "Your AI-Powered Healthcare Literacy Companion — Simple explanations for symptoms, reports, and lab reference ranges.",
        "emergency_alert": (
            "🚨 **URGENT EMERGENCY NOTICE:** If you or someone nearby is experiencing severe chest pain, "
            "shortness of breath, heavy bleeding, sudden weakness, or loss of consciousness, "
            "immediately call emergency services (**112 / 108 / 102** in India or **911** in the US) "
            "or go to the nearest emergency department."
        ),
        "tab_general": "🔍 Symptom & Health Explainer",
        "tab_report": "📋 Medical Report & PDF Explainer",
        "tab_glossary": "📖 Medical Jargon Glossary",
        "tab_guide": "📚 Lab Ranges & Reference Guide",
        "input_symptom_label": "What health topic or symptom would you like to understand?",
        "input_symptom_placeholder": "Example: Why is hydration important during a mild fever? What causes blood pressure to fluctuate?",
        "btn_explain": "Explain in Simple Terms",
        "report_text_label": "Paste laboratory test values or clinical report text:",
        "report_placeholder": "Example:\nHaemoglobin: 10.4 g/dL (Reference: 12.0 - 15.5 g/dL)\nPlatelets: 220,000 /mcL\nFasting Blood Glucose: 135 mg/dL",
        "privacy_notice": (
            "🔒 **Privacy & Consent Notice:** Report data is processed in memory for healthcare education only. "
            "Never upload documents containing sensitive personal IDs or financial information. "
            "Data is transmitted to Groq only upon your explicit action."
        ),
        "verified_sources_title": "📚 Verified Healthcare References (WHO / NHS / MedlinePlus):",
        "validation_empty": "⚠️ Please enter at least 10 characters so we have adequate medical context to explain.",
        "safety_disclaimer": (
            "⚖️ **Medical Disclaimer:** SehatSaathi AI is an educational technology prototype. "
            "It **does not** provide medical diagnoses, treatment plans, or prescriptions. "
            "Lab reference ranges vary by clinic, patient age, gender, and clinical context. "
            "Never ignore professional clinical advice or delay seeking it because of information here."
        )
    },
    "hi": {
        "app_title": "सेहतसाथी AI (SehatSaathi AI)",
        "tagline": "आपका स्वास्थ्य साक्षरता साथी — लक्षणों, मेडिकल रिपोर्ट्स और लैब टेस्ट की सरल व्याख्या।",
        "emergency_alert": (
            "🚨 **आपातकालीन सूचना:** यदि आपको या किसी को सीने में तेज दर्द, सांस लेने में तकलीफ, "
            "अत्यधिक रक्तस्राव, अचानक कमजोरी या बेहोशी हो, तो तुरंत आपातकालीन सेवाओं "
            "(भारत में **112 / 108 / 102** या नजदीकी अस्पताल) से संपर्क करें।"
        ),
        "tab_general": "🔍 लक्षण व स्वास्थ्य व्याख्या",
        "tab_report": "📋 मेडिकल रिपोर्ट व PDF विश्लेषक",
        "tab_glossary": "📖 चिकित्सा शब्दावली शब्दकोश",
        "tab_guide": "📚 लैब संदर्भ सीमाएं व गाइड",
        "input_symptom_label": "आप किस स्वास्थ्य विषय या लक्षण को सरल भाषा में समझना चाहते हैं?",
        "input_symptom_placeholder": "उदाहरण: हल्के बुखार में पानी पीना क्यों जरूरी है? उच्च रक्तचाप के क्या कारण हैं?",
        "btn_explain": "सरल भाषा में समझाइए",
        "report_text_label": "अपनी लैब रिपोर्ट या टेस्ट का विवरण नीचे पेस्ट करें:",
        "report_placeholder": "उदाहरण:\nहीमोग्लोबिन: 10.4 g/dL (सामान्य सीमा: 12.0 - 15.5)\nप्लेटलेट्स: 220,000 /mcL\nफास्टिंग ब्लड ग्लूकोज: 135 mg/dL",
        "privacy_notice": (
            "🔒 **गोपनीयता एवं सहमति सूचना:** रिपोर्ट डेटा केवल शैक्षणिक समझ के लिए प्रोसेस किया जाता है। "
            "आधार नंबर या व्यक्तिगत वित्तीय जानकारी वाली फाइलें अपलोड न करें। "
            "डेटा केवल आपके क्लिक पर Groq LLM को भेजा जाता है।"
        ),
        "verified_sources_title": "📚 सत्यापित स्वास्थ्य संदर्भ (WHO / NHS / MedlinePlus):",
        "validation_empty": "⚠️ कृपया कम से कम 10 अक्षर दर्ज करें ताकि विषय को ठीक से समझा जा सके।",
        "safety_disclaimer": (
            "⚖️ **चिकित्सा अस्वीकरण:** सेहतसाथी AI केवल शैक्षणिक उद्देश्य के लिए है। "
            "यह कोई डॉक्टरी जांच, उपचार या दवा का नुस्खा नहीं देता है। "
            "लैब की सामान्य सीमाएं अस्पताल और मरीज की उम्र के अनुसार बदल सकती हैं। "
            "हमेशा योग्य डॉक्टर से परामर्श लें।"
        )
    }
}

SAMPLE_REPORTS = {
    "cbc": """COMPLETE BLOOD COUNT (CBC) - REPORT
Patient Age: 32 | Sex: Female
--------------------------------------------------
Test Name                      Result      Reference Range      Status
Haemoglobin (Hb)              10.5 g/dL   12.0 - 15.5 g/dL     Borderline Low
Total WBC Count               7,400 /mcL  4,000 - 11,000 /mcL  Normal
Platelet Count                230,000/mcL 150,000 - 450,000    Normal
Packed Cell Volume (PCV)      33.2 %      36.0 - 46.0 %        Mild Low
Mean Corpuscular Vol (MCV)    76.0 fL     80.0 - 100.0 fL      Microcytic
--------------------------------------------------
Clinical Notes: Mild microcytic presentation. Advise dietary evaluation and serum ferritin correlation.""",

    "lipid": """FASTING LIPID PROFILE - REPORT
Patient Age: 45 | Sex: Male
--------------------------------------------------
Test Name                      Result      Desirable Range      Status
Total Cholesterol             224 mg/dL   < 200 mg/dL          Borderline High
HDL (Good) Cholesterol        38 mg/dL    > 40 mg/dL           Low
LDL (Bad) Cholesterol         148 mg/dL   < 100 mg/dL          High
Triglycerides                 190 mg/dL   < 150 mg/dL          Borderline High
--------------------------------------------------
Fasting Duration: 12 Hours verified.""",

    "glucose": """DIABETES SCREENING PANEL
Patient Age: 52 | Sex: Female
--------------------------------------------------
Test Name                      Result      Reference Range      Status
Fasting Blood Sugar (Glucose) 126 mg/dL   70.0 - 99.0 mg/dL    Elevated
Post-Prandial Glucose (2 hr)  185 mg/dL   < 140.0 mg/dL        Elevated
HbA1c (Glycated Hemoglobin)   6.8 %       < 5.7 % (Normal)     Elevated
--------------------------------------------------
Note: Results suggest glucose intolerance. Physician evaluation advised."""
}

GLOSSARY_DATA = [
    {
        "term": "Haemoglobin (Hb)",
        "meaning_en": "The iron-rich protein in red blood cells that transports oxygen from your lungs to the rest of your body.",
        "meaning_hi": "लाल रक्त कोशिकाओं में पाया जाने वाला आयरन युक्त प्रोटीन जो फेफड़ों से पूरे शरीर में ऑक्सीजन पहुंचाता है।",
        "category": "Blood"
    },
    {
        "term": "Platelets (Thrombocytes)",
        "meaning_en": "Tiny blood cell fragments that cluster together to form clots and stop bleeding after a cut or wound.",
        "meaning_hi": "रक्त के छोटे कण जो चोट लगने पर खून का थक्का बनाकर बहना रोकते हैं।",
        "category": "Blood"
    },
    {
        "term": "Systolic vs Diastolic BP",
        "meaning_en": "Systolic (top number) is arterial pressure when the heart beats; Diastolic (bottom number) is pressure when the heart rests between beats.",
        "meaning_hi": "सिस्टोलिक (ऊपर का अंक) दिल धड़कने पर नसों का दबाव है; डायस्टोलिक (नीचे का अंक) दो धड़कनों के बीच आराम का दबाव है।",
        "category": "Vitals"
    },
    {
        "term": "Microcytic",
        "meaning_en": "Red blood cells that are smaller than average, commonly evaluated for iron status.",
        "meaning_hi": "सामान्य से छोटी लाल रक्त कोशिकाएं, जिनकी जांच अक्सर शरीर में आयरन की स्थिति देखने के लिए की जाती है।",
        "category": "Lab Terms"
    },
    {
        "term": "Fasting Blood Sugar",
        "meaning_en": "Blood glucose measured after at least 8 to 12 hours without eating or drinking (except water).",
        "meaning_hi": "बिना कुछ खाए-पिए (कम से कम 8-12 घंटे) रक्त में ग्लूकोज (शुगर) की मात्रा की जांच।",
        "category": "Metabolism"
    },
    {
        "term": "Reference Range",
        "meaning_en": "The interval of numbers seen in ~95% of healthy individuals tested on that lab's specific diagnostic machine.",
        "meaning_hi": "वह सीमा जिसके अंदर लगभग 95% स्वस्थ व्यक्तियों के परिणाम आते हैं।",
        "category": "Lab Terms"
    }
]

# ==============================================================================
# 3. SIDEBAR
# ==============================================================================
with st.sidebar:
    st.image("https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?w=300&auto=format&fit=crop&q=80", caption="SehatSaathi AI")
    selected_lang = st.selectbox(
        "🌐 Language / भाषा",
        options=["en", "hi"],
        format_func=lambda x: "🇬🇧 English" if x == "en" else "🇮🇳 हिन्दी"
    )
    t = I18N[selected_lang]

    groq_cfg = get_groq_config()
    st.markdown("---")
    st.subheader("⚡ Groq Engine Status")
    if groq_cfg["api_key"] and groq_cfg["api_key"] != "gsk_your_groq_api_key_here":
        st.success(f"🟢 **Connected**\n\nModel: `{groq_cfg['model']}`")
    else:
        st.warning("🟡 **API Key Missing** in `.env`")

    st.markdown("---")
    st.subheader("🛡️ Safety Engine Status")
    st.success("🟢 **Deterministic Safety Guard: Active**")
    st.caption("• Emergency Triage Scanner\n• Prescription Request Interceptor\n• Untrusted Input Sanitizer")

    st.markdown("---")
    st.caption("🚀 **Hackathon Roadmap: All 6 Stages Complete!**")
    st.markdown("""
    - [x] **Stage 1:** Streamlit UI & Validation
    - [x] **Stage 2:** Groq LLM Explainer
    - [x] **Stage 3:** Safety Rules & Pytest Suite
    - [x] **Stage 4:** Verified Health Sources (WHO/NHS)
    - [x] **Stage 5:** PyMuPDF Report Parsing
    - [x] **Stage 6:** Final Polish & Interactive Upgrades
    """)

# ==============================================================================
# 4. MAIN HEADER & EMERGENCY BANNER
# ==============================================================================
st.markdown(f"<div class='main-title'>🩺 {t['app_title']}</div>", unsafe_allow_html=True)
st.markdown(f"<div class='sub-title'>{t['tagline']}</div>", unsafe_allow_html=True)

# Emergency Warning Banner
st.markdown(f"<div class='emergency-banner'>{t['emergency_alert']}</div>", unsafe_allow_html=True)

# Interactive Sandbox Quick-test Bar
st.markdown("##### ⚡ Quick Safety Sandbox Scenarios:")
sc1, sc2, sc3 = st.columns(3)
with sc1:
    if st.button("🚨 Test Emergency Interception", use_container_width=True):
        st.session_state["symptom_query"] = "The patient has sudden severe chest pain and shortness of breath"
        st.rerun()
with sc2:
    if st.button("🛑 Test Prescription Interception", use_container_width=True):
        st.session_state["symptom_query"] = "What dose of amoxicillin should I take for throat infection?"
        st.rerun()
with sc3:
    if st.button("💧 Test Safe Fever Inquiry", use_container_width=True):
        st.session_state["symptom_query"] = "Why is drinking water and resting important during a mild seasonal fever?"
        st.rerun()

# ==============================================================================
# 5. CORE INTERACTIVE TABS
# ==============================================================================
tab_symptom, tab_report, tab_glossary, tab_guide = st.tabs([
    t["tab_general"],
    t["tab_report"],
    t["tab_glossary"],
    t["tab_guide"]
])

# ------------------------------------------------------------------------------
# TAB 1: General Healthcare & Symptom Explainer
# ------------------------------------------------------------------------------
with tab_symptom:
    st.subheader(t["tab_general"])

    user_query = st.text_area(
        label=t["input_symptom_label"],
        value=st.session_state.get("symptom_query", ""),
        placeholder=t["input_symptom_placeholder"],
        height=110,
        key="symptom_text_area"
    )

    submit_symptom = st.button(t["btn_explain"], type="primary", use_container_width=True)

    if submit_symptom:
        cleaned_query = user_query.strip() if user_query else ""
        if len(cleaned_query) < 10:
            st.warning(t["validation_empty"])
        else:
            # 1. Deterministic Safety Evaluation (Member 3 Engine)
            safety = evaluate_safety(cleaned_query, language=selected_lang)

            if not safety.is_safe_to_proceed:
                if safety.is_emergency:
                    st.error(safety.warning_message)
                elif safety.is_prescription_attempt:
                    st.warning(safety.warning_message)
                else:
                    st.error(safety.warning_message or "Query violates safety rules.")
            else:
                # 2. Call Groq Explainer (Member 2 Engine)
                with st.spinner("🤖 Consulting SehatSaathi AI (Groq LLM)..."):
                    result = explain_health_topic(safety.sanitized_text, language=selected_lang)

                if result["status"] == "success":
                    st.markdown(f"<div class='ai-result-box'>", unsafe_allow_html=True)
                    st.caption(f"🧠 **Model:** `{result.get('model_used', 'Groq')}` | **Language:** {result.get('language')}")
                    st.markdown(result["content"])
                    st.markdown("</div>", unsafe_allow_html=True)

                    # 3. Interactive Checklist for Doctor
                    st.markdown("---")
                    st.subheader("📋 Interactive Checklist for Your Doctor Visit:")
                    st.checkbox("What dietary or lifestyle factors could be contributing to this?", key="chk_1")
                    st.checkbox("Are there specific confirmatory laboratory tests you recommend?", key="chk_2")
                    st.checkbox("What red-flag signs should prompt an emergency hospital visit?", key="chk_3")
                    st.checkbox("When should I schedule a follow-up appointment to re-check?", key="chk_4")

                    # 4. Verified Medical Sources (Member 3 Engine)
                    st.markdown("---")
                    st.subheader(t["verified_sources_title"])
                    sources = find_verified_sources(cleaned_query, language=selected_lang)
                    for src in sources:
                        st.markdown(f"""
                        <div class='source-card'>
                            <strong><a href='{src['url']}' target='_blank'>🔗 {src['title']}</a></strong> ({src['organization']})<br/>
                            <span style='font-size:0.85rem; color:#475569;'>{src['summary']}</span>
                        </div>
                        """, unsafe_allow_html=True)

                else:
                    st.error(f"⚠️ {result.get('message')}")

            st.caption(get_safety_limitations_notice(selected_lang))

# ------------------------------------------------------------------------------
# TAB 2: Medical Report & File Parser
# ------------------------------------------------------------------------------
with tab_report:
    st.subheader(t["tab_report"])
    st.info(t["privacy_notice"])

    # Download demo test PDF button
    demo_pdf_bytes = create_demo_pdf_bytes()
    st.download_button(
        label="📄 Download Sample CBC Report PDF (for testing upload)",
        data=demo_pdf_bytes,
        file_name="sample_cbc_lab_report.pdf",
        mime="application/pdf"
    )

    # Quick Sample Load Buttons
    st.markdown("##### Quick-Load Pre-Built Lab Reports:")
    l1, l2, l3 = st.columns(3)
    with l1:
        if st.button("1. CBC Blood Count", use_container_width=True):
            st.session_state["report_text_content"] = SAMPLE_REPORTS["cbc"]
            st.rerun()
    with l2:
        if st.button("2. Fasting Lipid Profile", use_container_width=True):
            st.session_state["report_text_content"] = SAMPLE_REPORTS["lipid"]
            st.rerun()
    with l3:
        if st.button("3. Blood Glucose & HbA1c", use_container_width=True):
            st.session_state["report_text_content"] = SAMPLE_REPORTS["glucose"]
            st.rerun()

    # Upload file
    uploaded_file = st.file_uploader(
        "Or Upload Laboratory Report (.pdf or .txt)",
        type=["pdf", "txt"],
        help="Files are processed in memory and validated to ensure no malicious content."
    )
    if uploaded_file is not None:
        file_bytes = uploaded_file.read()
        parsed = parse_report_file(file_bytes, uploaded_file.name)
        if parsed["success"]:
            st.success(f"✅ Extracted {parsed['character_count']} characters using `{parsed['engine_used']}`.")
            st.session_state["report_text_content"] = parsed["extracted_text"]
        else:
            st.error(f"⚠️ File processing error: {parsed['error']}")

    report_input = st.text_area(
        t["report_text_label"],
        value=st.session_state.get("report_text_content", ""),
        height=180,
        placeholder=t["report_placeholder"]
    )

    submit_report = st.button("Analyze Report with Groq", type="primary", use_container_width=True)

    if submit_report:
        cleaned_report = report_input.strip() if report_input else ""
        if len(cleaned_report) < 15:
            st.warning("⚠️ Please provide report text containing laboratory biomarkers and numbers.")
        else:
            safety = evaluate_safety(cleaned_report, language=selected_lang)
            if not safety.is_safe_to_proceed:
                st.error(safety.warning_message)
            else:
                with st.spinner("🔬 Analyzing medical terminology and reference ranges with Groq..."):
                    result = explain_medical_report(safety.sanitized_text, language=selected_lang)

                if result["status"] == "success":
                    st.markdown(f"<div class='ai-result-box'>", unsafe_allow_html=True)
                    st.caption(f"🧠 **Model:** `{result.get('model_used', 'Groq')}` | **Language:** {result.get('language')}")
                    st.markdown(result["content"])
                    st.markdown("</div>", unsafe_allow_html=True)

                    st.markdown("---")
                    st.subheader(t["verified_sources_title"])
                    sources = find_verified_sources(cleaned_report, language=selected_lang)
                    for src in sources:
                        st.markdown(f"""
                        <div class='source-card'>
                            <strong><a href='{src['url']}' target='_blank'>🔗 {src['title']}</a></strong> ({src['organization']})<br/>
                            <span style='font-size:0.85rem; color:#475569;'>{src['summary']}</span>
                        </div>
                        """, unsafe_allow_html=True)
                else:
                    st.error(f"⚠️ {result.get('message')}")

# ------------------------------------------------------------------------------
# TAB 3: Medical Jargon Glossary
# ------------------------------------------------------------------------------
with tab_glossary:
    st.subheader("📖 Medical Jargon Glossary")
    st.caption("Search and translate confusing lab test terms into everyday English and Hindi.")

    search_glossary = st.text_input("🔍 Search medical term...", placeholder="e.g. Haemoglobin, Platelets, Microcytic...")
    filtered = [
        item for item in GLOSSARY_DATA
        if search_glossary.lower() in item["term"].lower() 
        or search_glossary.lower() in item["meaning_en"].lower()
        or search_glossary.lower() in item["meaning_hi"].lower()
    ]

    for item in filtered:
        with st.expander(f"📌 {item['term']} ({item['category']})", expanded=True):
            st.markdown(f"**English:** {item['meaning_en']}")
            st.markdown(f"**हिन्दी:** {item['meaning_hi']}")

# ------------------------------------------------------------------------------
# TAB 4: Reference Ranges & How-to Guide
# ------------------------------------------------------------------------------
with tab_guide:
    st.subheader("📚 Healthcare Literacy Guide")
    st.markdown("""
    ### Why Laboratory Ranges Vary:
    | Factor | Clinical Explanation |
    | :--- | :--- |
    | **Equipment & Reagents** | Different diagnostic machines use distinct chemical calibration methods. |
    | **Age & Sex Differences** | Normal ranges for children, adult females, and adult males differ for many biomarkers (e.g., Hemoglobin, Ferritin). |
    | **Fasting State** | Tests like Blood Sugar (Fasting vs Post-Prandial) and Lipid Profiles depend on fasting duration. |
    | **Biological Rhythm** | Cortisol, iron, and white blood cell levels shift between morning and evening. |
    
    ### 🛡️ Healthcare Safety Directives:
    - We **never** diagnose conditions or advise taking/stopping medications.
    - We empower patients with informed questions to ask during doctor consultations.
    """)

# ==============================================================================
# 6. PERSISTENT DISCLAIMER FOOTER
# ==============================================================================
st.markdown(f"<div class='disclaimer-card'>{t['safety_disclaimer']}</div>", unsafe_allow_html=True)
