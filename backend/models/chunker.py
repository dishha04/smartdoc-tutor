"""
Shared text cleaning and chunking utilities.
Used by: Summarization, Q&A (RAG), MCQ generation
"""

import re
from typing import List


def clean_text(text: str) -> str:
    """
    Clean raw extracted text for LLM reasoning.
    """
    if not text:
        return ""

    text = text.replace("\r", "\n")
    text = "\n".join(line.strip() for line in text.split("\n"))
    text = re.sub(r"\n\s*\n+", "\n\n", text)
    text = re.sub(r"[ \t]+", " ", text)

    return text.strip()


def chunk_text(
    text: str,
    max_words: int = 450,
    min_words: int = 150,
) -> List[str]:
    """
    Split cleaned text into semantic chunks for summarization / MCQ generation.
    Larger chunks (~450 words), no overlap.
    """
    cleaned = clean_text(text)
    if not cleaned:
        return []

    paragraphs = cleaned.split("\n\n")

    chunks = []
    current_chunk = []
    current_word_count = 0

    for para in paragraphs:
        words = para.split()
        para_len = len(words)

        if para_len < 20:
            continue

        if current_word_count + para_len > max_words:
            if current_word_count >= min_words:
                chunks.append(" ".join(current_chunk))
                current_chunk = []
                current_word_count = 0

        current_chunk.append(para)
        current_word_count += para_len

    if current_chunk and current_word_count >= min_words:
        chunks.append(" ".join(current_chunk))

    return chunks


def chunk_text_for_rag(
    text: str,
    max_words: int = 250,
    min_words: int = 50,
    overlap_words: int = 50,
) -> List[str]:
    """
    Split text into smaller overlapping chunks optimized for RAG retrieval.
    Smaller chunks (~250 words) with overlap for better semantic search.
    """
    cleaned = clean_text(text)
    if not cleaned:
        return []

    # Split into sentences for finer granularity
    sentences = re.split(r'(?<=[.!?])\s+', cleaned)

    chunks = []
    current_words = []

    for sentence in sentences:
        words = sentence.split()
        if not words:
            continue

        current_words.extend(words)

        if len(current_words) >= max_words:
            chunk_text_str = " ".join(current_words)
            if len(current_words) >= min_words:
                chunks.append(chunk_text_str)

            # Keep last overlap_words for the next chunk
            current_words = current_words[-overlap_words:] if overlap_words > 0 else []

    # Add remaining words
    if current_words and len(current_words) >= min_words:
        chunks.append(" ".join(current_words))

    return chunks
