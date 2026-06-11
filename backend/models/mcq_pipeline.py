"""
MCQ generation pipeline using Gemini Flash 2.5.
"""

import json
import math
import logging

from .chunker import chunk_text
from .groq_rest import generate_with_groq

logger = logging.getLogger(__name__)


MCQ_PROMPT = """
You are an expert exam question setter and educator.

Your task is to generate high-quality multiple-choice questions (MCQs) from the given text.

Rules:
- Questions must test conceptual understanding, not word memorization
- Do NOT ask grammar-based or definition-only questions
- Do NOT use phrases like "According to the text"
- Each question must be answerable from the text alone
- Each option must be a meaningful phrase, not a single word
- Only ONE option must be correct
- Incorrect options must be plausible but clearly wrong
- Avoid vague subjects like "a", "the", "this", "it"
- Difficulty level: Medium

Return ONLY valid JSON.
Do NOT include markdown or extra text.

The JSON schema must be exactly:

[
  {{
    "question": "string",
    "options": {{
      "A": "string",
      "B": "string",
      "C": "string",
      "D": "string"
    }},
    "correct_answer": "A | B | C | D",
    "explanation": "string"
  }}
]

Generate exactly {n} MCQs.

Text:
<<<
{context}
>>>
"""


def generate_mcqs(
    text: str,
    n: int = 4,
    max_retries: int = 3,
    max_chunks: int = 3
):
    """
    Generate validated MCQs from multiple chunks.
    """
    chunks = chunk_text(text)

    # DEV FALLBACK: if text is valid but chunking fails
    if not chunks and len(text.split()) >= 30:
        chunks = [text]

    if not chunks:
        return []

    chunks = chunks[:max_chunks]
    mcqs_per_chunk = math.ceil(n / len(chunks))

    all_mcqs = []

    for chunk in chunks:
        for attempt in range(max_retries):
            prompt = MCQ_PROMPT.format(
                n=mcqs_per_chunk,
                context=chunk
            )

            try:
                raw_output = generate_with_groq(prompt)
                
                # Strip markdown code blocks if present
                clean_output = raw_output.strip()
                if clean_output.startswith("```"):
                    lines = clean_output.split('\n')
                    if lines[0].startswith("```"):
                        lines = lines[1:]
                    if lines and lines[-1].startswith("```"):
                        lines = lines[:-1]
                    clean_output = '\n'.join(lines).strip()
                
                mcqs = json.loads(clean_output)

                if not isinstance(mcqs, list):
                    logger.warning("Groq returned non-list output, retrying...")
                    continue

                valid_mcqs = [
                    mcq for mcq in mcqs if is_valid_mcq(mcq)
                ]

                logger.info(f"Chunk produced {len(valid_mcqs)} valid MCQs")

                for mcq in valid_mcqs:
                    if len(all_mcqs) < n:
                        all_mcqs.append(mcq)

                break  # move to next chunk

            except json.JSONDecodeError:
                logger.warning(f"JSON parse failed on attempt {attempt + 1}")
                continue
            except Exception as e:
                logger.error(f"MCQ generation error on attempt {attempt + 1}: {e}")
                continue

        if len(all_mcqs) >= n:
            break

    return all_mcqs


def is_valid_mcq(mcq: dict) -> bool:
    try:
        if not isinstance(mcq, dict):
            return False

        required_keys = {"question", "options", "correct_answer", "explanation"}
        if not required_keys.issubset(mcq.keys()):
            return False

        question = mcq["question"]
        options = mcq["options"]
        correct = mcq["correct_answer"]

        if not isinstance(question, str) or len(question.strip()) == 0:
            return False

        if not isinstance(options, dict):
            return False

        if set(options.keys()) != {"A", "B", "C", "D"}:
            return False

        for opt in options.values():
            if not isinstance(opt, str) or len(opt.strip()) == 0:
                return False

        if correct not in {"A", "B", "C", "D"}:
            return False

        return True

    except Exception:
        return False
