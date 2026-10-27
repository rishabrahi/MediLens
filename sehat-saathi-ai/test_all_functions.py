"""
SehatSaathi AI - Automated Verification Script
Tests Every Core Function with Live Groq API
"""

import sys
import os

# Add script directory to sys.path
sys.path.insert(0, os.path.dirname(__file__))

from ai_explainer import (
    get_groq_config,
    check_emergency_symptoms,
    explain_health_topic,
    explain_medical_report
)

def run_tests():
    print("=" * 70)
    print("   SEHATSAATHI AI - COMPREHENSIVE FUNCTION TEST SUITE")
    print("=" * 70)

    # --------------------------------------------------------------------------
    # TEST 1: Config & API Key Check
    # --------------------------------------------------------------------------
    print("\n[TEST 1] Checking Groq Configuration...")
    config = get_groq_config()
    api_key = config["api_key"]
    model = config["model"]
    assert api_key, "FAIL: GROQ_API_KEY is empty!"
    assert model, "FAIL: GROQ_MODEL is empty!"
    masked = api_key[:7] + "..." + api_key[-4:]
    print(f"  -> GROQ_API_KEY: {masked}")
    print(f"  -> GROQ_MODEL:   {model}")
    print("  -> PASSED: Configuration loaded successfully.")

    # --------------------------------------------------------------------------
    # TEST 2: Deterministic Emergency Detection Check
    # --------------------------------------------------------------------------
    print("\n[TEST 2] Testing Deterministic Emergency Triage...")
    # Safe query
    safe_res = check_emergency_symptoms("What is the difference between systolic and diastolic BP?")
    assert not safe_res["is_emergency"], "FAIL: Safe query was falsely marked emergency"
    print("  -> Safe query test: PASSED (No false positive)")

    # Emergency query English
    urgent_res_en = check_emergency_symptoms("Patient has sudden severe chest pain and shortness of breath")
    assert urgent_res_en["is_emergency"], "FAIL: English emergency query was not detected"
    print(f"  -> Urgent English test: PASSED (Signals: {urgent_res_en['matched_signals']})")

    # Emergency query Hindi
    urgent_res_hi = check_emergency_symptoms("रोगी को अचानक सीने में दर्द और सांस लेने में तकलीफ हो रही है")
    assert urgent_res_hi["is_emergency"], "FAIL: Hindi emergency query was not detected"
    print(f"  -> Urgent Hindi test: PASSED (Signals: {urgent_res_hi['matched_signals']})")

    # --------------------------------------------------------------------------
    # TEST 3: Input Validation Guards
    # --------------------------------------------------------------------------
    print("\n[TEST 3] Testing Input Length & Empty Validation...")
    val_res = explain_health_topic("hi")
    assert val_res["status"] == "error", "FAIL: Too short query was not rejected"
    assert val_res["error_type"] == "ValidationError", "FAIL: Unexpected error type"
    print(f"  -> Short input guard: PASSED ({val_res['message']})")

    val_rep = explain_medical_report("Hb: 12")
    assert val_rep["status"] == "error", "FAIL: Too short report was not rejected"
    print(f"  -> Short report guard: PASSED ({val_rep['message']})")

    # --------------------------------------------------------------------------
    # TEST 4: Live Groq API - Health Topic in English
    # --------------------------------------------------------------------------
    print("\n[TEST 4] Live Groq API: Health Topic Explainer (English)...")
    q_en = "Why is drinking water and resting important during a mild seasonal fever?"
    res_en = explain_health_topic(q_en, language="en")
    print(f"  -> Status: {res_en['status']}")
    assert res_en["status"] == "success", f"FAIL: {res_en.get('message')}"
    print(f"  -> Model Used: {res_en['model_used']} via {res_en['backend']}")
    print(f"  -> Output length: {len(res_en['content'])} characters")
    print("  -> Sample response preview:")
    preview_en = "\n".join("     " + line for line in res_en["content"].split("\n")[:8])
    print(preview_en)
    print("  -> PASSED: English Health Explainer works cleanly.")

    # --------------------------------------------------------------------------
    # TEST 5: Live Groq API - Health Topic in Hindi
    # --------------------------------------------------------------------------
    print("\n[TEST 5] Live Groq API: Health Topic Explainer (Hindi)...")
    q_hi = "हल्के बुखार में पानी पीना और आराम करना शरीर के लिए क्यों जरूरी है?"
    res_hi = explain_health_topic(q_hi, language="hi")
    print(f"  -> Status: {res_hi['status']}")
    assert res_hi["status"] == "success", f"FAIL: {res_hi.get('message')}"
    print(f"  -> Model Used: {res_hi['model_used']} via {res_hi['backend']}")
    print(f"  -> Output length: {len(res_hi['content'])} characters")
    print("  -> Sample Hindi preview:")
    preview_hi = "\n".join("     " + line for line in res_hi["content"].split("\n")[:8])
    print(preview_hi)
    print("  -> PASSED: Hindi Health Explainer works cleanly.")

    # --------------------------------------------------------------------------
    # TEST 6: Live Groq API - Medical Report Explainer (English)
    # --------------------------------------------------------------------------
    print("\n[TEST 6] Live Groq API: Medical Report Explainer (English)...")
    sample_report = (
        "CBC REPORT:\n"
        "Haemoglobin: 10.4 g/dL (Reference Range: 12.0 - 15.5 g/dL)\n"
        "Total WBC: 6,800 /mcL (Reference Range: 4,000 - 11,000 /mcL)\n"
        "Platelet Count: 240,000 /mcL (Reference Range: 150,000 - 450,000 /mcL)"
    )
    rep_en = explain_medical_report(sample_report, language="en")
    print(f"  -> Status: {rep_en['status']}")
    assert rep_en["status"] == "success", f"FAIL: {rep_en.get('message')}"
    print(f"  -> Model Used: {rep_en['model_used']} via {rep_en['backend']}")
    print("  -> Sample Report explanation preview:")
    preview_rep = "\n".join("     " + line for line in rep_en["content"].split("\n")[:8])
    print(preview_rep)
    print("  -> PASSED: Medical Report Explainer works cleanly.")

    print("\n" + "=" * 70)
    print("   ALL 6 TEST SUITES PASSED CLEANLY! GROQ IS FULLY OPERATIONAL!")
    print("=" * 70)

if __name__ == "__main__":
    run_tests()
