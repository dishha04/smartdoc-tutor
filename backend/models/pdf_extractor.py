"""
Simple and reliable PDF text extractor.
Used by the /upload endpoint.
"""

import pdfplumber
import re


def extract_text_from_pdf(file_path: str) -> str:
    """
    Extract text from a PDF using pdfplumber.
    Returns clean, normalized text.
    Raises ValueError if extraction fails.
    """

    pages_text = []

    try:
        with pdfplumber.open(file_path) as pdf:
            for page in pdf.pages:
                text = page.extract_text()
                if text:
                    pages_text.append(text)
    except Exception as e:
        raise ValueError(f"Failed to read PDF: {e}")

    if not pages_text:
        raise ValueError("No extractable text found in PDF.")

    raw_text = "\n\n".join(pages_text)

    return _clean_text(raw_text)


def _clean_text(text: str) -> str:
    """
    Clean extracted PDF text:
    - normalize whitespace
    - remove excessive blank lines
    - remove page numbers
    """

    text = text.replace("\r", "\n")

    # remove page numbers like "Page 1", "page 12"
    text = re.sub(r"\b[Pp]age\s+\d+\b", "", text)

    # collapse multiple newlines
    text = re.sub(r"\n\s*\n+", "\n\n", text)

    # normalize spaces
    text = re.sub(r"[ \t]+", " ", text)

    return text.strip()
