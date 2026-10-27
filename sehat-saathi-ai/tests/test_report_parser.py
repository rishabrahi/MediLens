"""
SehatSaathi AI - Report Parser Unit Tests
Tests for Member 2's report_parser.py module
"""

import sys
import os

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from report_parser import (
    validate_report_file,
    parse_report_file,
    create_demo_pdf_bytes,
    MAX_FILE_SIZE_BYTES
)

def test_file_validation():
    # Empty file
    assert not validate_report_file(b"", "report.pdf")["is_valid"]
    
    # Oversized file
    big_bytes = b"0" * (MAX_FILE_SIZE_BYTES + 1024)
    assert not validate_report_file(big_bytes, "big.pdf")["is_valid"]
    
    # Unsupported extension
    assert not validate_report_file(b"test data", "image.png")["is_valid"]
    
    # Valid PDF file
    valid_res = validate_report_file(b"PDF content", "lab_report.pdf")
    assert valid_res["is_valid"] is True

def test_txt_report_parsing():
    content = b"Haemoglobin: 11.2 g/dL\nPlatelets: 200,000"
    res = parse_report_file(content, "report.txt")
    assert res["success"] is True
    assert "Haemoglobin" in res["extracted_text"]

def test_demo_pdf_parsing():
    demo_bytes = create_demo_pdf_bytes()
    assert len(demo_bytes) > 0
    res = parse_report_file(demo_bytes, "cbc_report.pdf")
    assert res["success"] is True
    assert "Haemoglobin" in res["extracted_text"]
    assert "Platelet" in res["extracted_text"]

if __name__ == "__main__":
    print("Testing report_parser...")
    test_file_validation()
    print("✓ test_file_validation passed")
    test_txt_report_parsing()
    print("✓ test_txt_report_parsing passed")
    test_demo_pdf_parsing()
    print("✓ test_demo_pdf_parsing passed")
    print("\nALL REPORT PARSER TESTS PASSED!")
