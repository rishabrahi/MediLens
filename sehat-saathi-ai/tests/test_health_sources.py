"""
SehatSaathi AI - Verified Health Sources Unit Tests
Tests for Member 3's health_sources.py module
"""

import sys
import os

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from health_sources import find_verified_sources, VERIFIED_HEALTH_REGISTRY

def test_source_matching_hypertension():
    sources_en = find_verified_sources("My doctor mentioned borderline blood pressure", language="en")
    assert len(sources_en) > 0
    assert any("who.int" in s["url"] or "cdc.gov" in s["url"] for s in sources_en)
    assert any("Hypertension" in s["title"] or "Blood Pressure" in s["title"] for s in sources_en)

def test_source_matching_hindi():
    sources_hi = find_verified_sources("उच्च रक्तचाप और सिरदर्द के लक्षण", language="hi")
    assert len(sources_hi) > 0
    assert any("तथ्य-पत्र" in s["title"] or "रक्तचाप" in s["title"] for s in sources_hi)

def test_source_matching_anemia():
    sources = find_verified_sources("Haemoglobin is 10.2 g/dL and MCV is low", language="en")
    assert len(sources) > 0
    assert any("Anaemia" in s["title"] or "CBC" in s["title"] for s in sources)

def test_fallback_sources():
    sources = find_verified_sources("General biological curiosity about cells", language="en")
    assert len(sources) > 0
    assert any("who.int" in s["url"] or "medlineplus.gov" in s["url"] for s in sources)

def test_never_empty_urls():
    for item in VERIFIED_HEALTH_REGISTRY:
        assert item["url"].startswith("https://")
        assert len(item["keywords"]) > 0

if __name__ == "__main__":
    print("Testing health_sources...")
    test_source_matching_hypertension()
    print("✓ test_source_matching_hypertension passed")
    test_source_matching_hindi()
    print("✓ test_source_matching_hindi passed")
    test_source_matching_anemia()
    print("✓ test_source_matching_anemia passed")
    test_fallback_sources()
    print("✓ test_fallback_sources passed")
    test_never_empty_urls()
    print("✓ test_never_empty_urls passed")
    print("\nALL HEALTH SOURCE TESTS PASSED!")
