import os
import requests
import json
import logging

logger = logging.getLogger(__name__)

GEMINI_ENDPOINT = (
    "https://generativelanguage.googleapis.com/v1beta/models/"
    "gemini-2.5-flash:generateContent"
)

def generate_with_gemini(prompt: str) -> str:
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        raise RuntimeError("GEMINI_API_KEY not set in environment variables")

    headers = {
        "Content-Type": "application/json",
        "x-goog-api-key": api_key,
    }

    payload = {
        "contents": [
            {
                "parts": [
                    {"text": prompt}
                ]
            }
        ]
    }

    response = requests.post(
        GEMINI_ENDPOINT,
        headers=headers,
        data=json.dumps(payload),
        timeout=60
    )

    if response.status_code != 200:
        logger.error(f"Gemini API error {response.status_code}: {response.text[:200]}")
        raise RuntimeError(
            f"Gemini API error {response.status_code}: {response.text[:200]}"
        )

    data = response.json()
    return data["candidates"][0]["content"]["parts"][0]["text"]

