import os
import requests
import json
import logging

logger = logging.getLogger(__name__)

GROQ_ENDPOINT = "https://api.groq.com/openai/v1/chat/completions"

def generate_with_groq(prompt: str) -> str:
    api_key = os.getenv("GROQ_API_KEY")
    if not api_key:
        raise RuntimeError("GROQ_API_KEY not set in environment variables")

    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {api_key}"
    }

    payload = {
        "model": "llama-3.3-70b-versatile",  # Using a strong model for complex tasks like MCQs
        "messages": [
            {"role": "user", "content": prompt}
        ],
        "temperature": 0.3
    }

    response = requests.post(
        GROQ_ENDPOINT,
        headers=headers,
        data=json.dumps(payload),
        timeout=60
    )

    if response.status_code != 200:
        logger.error(f"Groq API error {response.status_code}: {response.text[:200]}")
        raise RuntimeError(
            f"Groq API error {response.status_code}: {response.text[:200]}"
        )

    data = response.json()
    return data["choices"][0]["message"]["content"]
