"""
SehatSaathi AI (सेहतसाथी) - Hackathon MVP
Stage 4: Verified Healthcare Source References (health_sources.py)
-------------------------------------------------------------------
Role Responsibility: Member 3 (Safety, Sources & QA)

Strict Healthcare Requirement:
- NEVER invent URLs, research papers, clinical citations, or quotations.
- Only return vetted, static, authoritative public health domains:
  * World Health Organization (WHO)
  * NHS Health A-Z (National Health Service, UK)
  * MedlinePlus (National Library of Medicine / NIH, USA)
  * National Health Portal / Ayushman Bharat (Govt. of India)
  * Centers for Disease Control and Prevention (CDC)
"""

from typing import List, Dict, Any, Optional

# ==============================================================================
# 1. VERIFIED HEALTHCARE DIRECTORY (CURATED & VERIFIED ACCURATE)
# ==============================================================================
VERIFIED_HEALTH_REGISTRY: List[Dict[str, Any]] = [
    {
        "id": "hypertension",
        "keywords": ["blood pressure", "hypertension", "bp", "उच्च रक्तचाप", "सिस्टोलिक", "डायस्टोलिक"],
        "title_en": "Hypertension (High Blood Pressure) Factsheet",
        "title_hi": "उच्च रक्तचाप (Hypertension) तथ्य-पत्र",
        "organization": "World Health Organization (WHO)",
        "url": "https://www.who.int/news-room/fact-sheets/detail/hypertension",
        "summary_en": "Explains blood pressure definitions, standard measurement guidelines, and lifestyle measures.",
        "summary_hi": "रक्तचाप की परिभाषा, जांच के मानक नियम और जीवनशैली में सुधार की जानकारी।"
    },
    {
        "id": "fever",
        "keywords": ["fever", "temperature", "chills", "mild fever", "बुखार", "तापमान"],
        "title_en": "Fever in Adults and Children",
        "title_hi": "बुखार (Fever) - कारण एवं सामान्य देखभाल",
        "organization": "MedlinePlus (NIH National Library of Medicine)",
        "url": "https://medlineplus.gov/fever.html",
        "summary_en": "Overview of physiological temperature elevation, hydration principles, and when to seek urgent medical evaluation.",
        "summary_hi": "शारीरिक तापमान बढ़ने के कारण, पानी पीने का महत्व और डॉक्टर को कब दिखाना चाहिए।"
    },
    {
        "id": "anemia_hemoglobin",
        "keywords": ["hemoglobin", "haemoglobin", "anemia", "anaemia", "rbc", "mcv", "iron", "हीमोग्लोबिन", "एनीमिया"],
        "title_en": "Anaemia Factsheet & Iron Nutrition",
        "title_hi": "एनीमिया (खून की कमी) और पोषण",
        "organization": "World Health Organization (WHO)",
        "url": "https://www.who.int/news-room/fact-sheets/detail/anaemia",
        "summary_en": "Defines hemoglobin thresholds, nutritional factors, red blood cell health, and clinical testing recommendations.",
        "summary_hi": "हीमोग्लोबिन के मानक स्तर, पोषण की भूमिका और आवश्यक रक्त जांच की जानकारी।"
    },
    {
        "id": "diabetes_glucose",
        "keywords": ["glucose", "blood sugar", "fasting sugar", "diabetes", "hba1c", "डायबिटीज", "शुगर"],
        "title_en": "Diabetes & Blood Sugar Overview",
        "title_hi": "डायबिटीज और ब्लड ग्लूकोज की समझ",
        "organization": "NHS (UK Health A-Z)",
        "url": "https://www.nhs.uk/conditions/diabetes/",
        "summary_en": "Details how insulin balances blood sugar, standard testing guidelines, and physician consultations.",
        "summary_hi": "इंसुलिन और ब्लड शुगर का संबंध, लैब टेस्ट की सामान्य सीमाएं और चिकित्सीय सलाह।"
    },
    {
        "id": "cholesterol_lipid",
        "keywords": ["cholesterol", "lipid", "triglycerides", "ldl", "hdl", "लिपिड", "कोलेस्ट्रॉल"],
        "title_en": "High Cholesterol & Lipid Profile Guidance",
        "title_hi": "कोलेस्ट्रॉल और लिपिड प्रोफाइल गाइड",
        "organization": "Centers for Disease Control and Prevention (CDC)",
        "url": "https://www.cdc.gov/cholesterol/about/index.html",
        "summary_en": "Educational breakdown of LDL, HDL, and triglycerides reference ranges and cardiovascular wellness.",
        "summary_hi": "LDL, HDL और ट्राइग्लिसराइड्स के संदर्भ मानों की सरल व्याख्या।"
    },
    {
        "id": "complete_blood_count",
        "keywords": ["cbc", "platelets", "wbc", "complete blood count", "प्लेटलेट्स", "श्वेत रक्त कोशिकाएं"],
        "title_en": "Complete Blood Count (CBC) Test Information",
        "title_hi": "कम्पलीट ब्लड काउंट (CBC) टेस्ट गाइड",
        "organization": "MedlinePlus (National Institutes of Health)",
        "url": "https://medlineplus.gov/lab-tests/complete-blood-count-cbc/",
        "summary_en": "Explains what each component of a CBC measures (WBC, RBC, Platelets) and why lab reference ranges vary.",
        "summary_hi": "CBC जांच के घटकों और लैब की सामान्य सीमाओं में अंतर के कारणों की स्पष्ट व्याख्या।"
    }
]

# General fallbacks if specific condition is not detected
DEFAULT_GENERAL_SOURCES: List[Dict[str, Any]] = [
    {
        "id": "who_main",
        "title_en": "WHO Health Topics A to Z",
        "title_hi": "विश्व स्वास्थ्य संगठन (WHO) स्वास्थ्य विषय",
        "organization": "World Health Organization (WHO)",
        "url": "https://www.who.int/health-topics",
        "summary_en": "Global, peer-reviewed health topics and public wellness advisories.",
        "summary_hi": "विश्व स्वास्थ्य संगठन द्वारा प्रमाणित स्वास्थ्य विषयों का व्यापक संग्रह।"
    },
    {
        "id": "medlineplus_main",
        "title_en": "MedlinePlus Medical Encyclopedia & Lab Tests",
        "title_hi": "मेडलाइन प्लस मेडिकल एनसाइक्लोपीडिया",
        "organization": "U.S. National Library of Medicine (NIH)",
        "url": "https://medlineplus.gov/",
        "summary_en": "Trusted, ad-free patient education portal on health conditions and diagnostic lab tests.",
        "summary_hi": "रोगों, लक्षणों और लैब टेस्ट की प्रमाणित जानकारी का निःशुल्क पोर्टल।"
    },
    {
        "id": "nhp_india",
        "title_en": "National Health Portal of India",
        "title_hi": "राष्ट्रीय स्वास्थ्य पोर्टल (भारत सरकार)",
        "organization": "Ministry of Health & Family Welfare, Govt. of India",
        "url": "https://www.nhp.gov.in/",
        "summary_en": "Authoritative citizen healthcare guidance, wellness initiatives, and hospital helplines.",
        "summary_hi": "भारत सरकार के स्वास्थ्य एवं परिवार कल्याण मंत्रालय का आधिकारिक नागरिक स्वास्थ्य पोर्टल।"
    }
]

# ==============================================================================
# 2. SOURCE RETRIEVAL & MATCHING ENGINE
# ==============================================================================
def find_verified_sources(
    text: str,
    language: str = "en",
    max_results: int = 3
) -> List[Dict[str, str]]:
    """
    Finds verified healthcare reference links matching topics or biomarkers in text.
    Never invents or fabricates URLs.
    
    Args:
        text: User query or report content.
        language: 'en' for English, 'hi' for Hindi.
        max_results: Maximum source cards to return.
        
    Returns:
        List of formatted source dictionaries.
    """
    lowered = text.lower()
    matched_sources = []

    for entry in VERIFIED_HEALTH_REGISTRY:
        if any(keyword in lowered for keyword in entry["keywords"]):
            matched_sources.append({
                "title": entry["title_hi"] if language == "hi" else entry["title_en"],
                "organization": entry["organization"],
                "url": entry["url"],
                "summary": entry["summary_hi"] if language == "hi" else entry["summary_en"]
            })
            if len(matched_sources) >= max_results:
                break

    # If no specific match was found, return authoritative general health registries
    if not matched_sources:
        for entry in DEFAULT_GENERAL_SOURCES[:max_results]:
            matched_sources.append({
                "title": entry["title_hi"] if language == "hi" else entry["title_en"],
                "organization": entry["organization"],
                "url": entry["url"],
                "summary": entry["summary_hi"] if language == "hi" else entry["summary_en"]
            })

    return matched_sources
