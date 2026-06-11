"""
Text summarization using facebook/bart-large-cnn.
Supports multi-chunk summarization for long documents (map-reduce).
Auto-detects GPU/CPU.
"""

import logging
import torch
from transformers import pipeline

from .chunker import chunk_text

logger = logging.getLogger(__name__)

DEFAULT_MODEL = "facebook/bart-large-cnn"
MAX_INPUT_TOKENS = 1024  # BART model token limit
MAX_OUTPUT_TOKENS = 256  # target summary length (tokens)


class TextSummarizer:
    def __init__(self, model_name: str | None = None):
        self.model_name = model_name or DEFAULT_MODEL
        device = 0 if torch.cuda.is_available() else -1
        device_name = "GPU" if device == 0 else "CPU"
        logger.info(f"Loading summarization model: {self.model_name} on {device_name}")

        self.summarizer = pipeline(
            "summarization",
            model=self.model_name,
            device=device,
        )
        logger.info("Summarization model loaded successfully")

    def _summarize_single(self, text: str) -> str:
        """
        Summarize a single chunk of text that fits within BART's token limit.
        Raises ValueError if text is too short.
        """
        # Normalize whitespace
        text = " ".join(text.split())
        word_count = len(text.split())

        if word_count < 60:
            logger.info("Text too short for summarization, returning original text")
            return text

        # Calculate dynamic length targets
        approx_tokens = int(word_count * 1.3)
        target_tokens = min(int(approx_tokens * 0.3), MAX_OUTPUT_TOKENS)
        max_len = max(80, min(target_tokens, MAX_OUTPUT_TOKENS))
        min_len = max(40, int(max_len * 0.5))

        result = self.summarizer(
            text,
            max_length=max_len,
            min_length=min_len,
            do_sample=False,
            truncation=True,
            num_beams=4,
            no_repeat_ngram_size=3,
        )

        return result[0]["summary_text"].strip()

    def summarize(self, text: str) -> str:
        """
        Multi-chunk map-reduce summarization.
        - Short docs (<1024 tokens): single-pass summarization
        - Long docs: chunk → summarize each → combine summaries → final summary
        """
        text = (text or "").strip()
        if not text:
            raise ValueError("Empty text provided for summarization")

        word_count = len(text.split())
        approx_tokens = int(word_count * 1.3)

        # Short document — single-pass
        if approx_tokens <= MAX_INPUT_TOKENS:
            logger.info(f"Single-pass summarization: {word_count} words (~{approx_tokens} tokens)")
            return self._summarize_single(text)

        # Long document — multi-chunk map-reduce
        logger.info(f"Multi-chunk summarization: {word_count} words (~{approx_tokens} tokens)")

        chunks = chunk_text(text)
        if not chunks:
            # Fallback: truncate to first ~787 words (within token budget)
            max_words = int(MAX_INPUT_TOKENS / 1.3)
            truncated = " ".join(text.split()[:max_words])
            logger.warning(f"Chunking returned empty, truncating to {max_words} words")
            return self._summarize_single(truncated)

        # MAP: summarize each chunk
        chunk_summaries = []
        for i, chunk in enumerate(chunks):
            try:
                summary = self._summarize_single(chunk)
                chunk_summaries.append(summary)
                logger.info(f"Chunk {i + 1}/{len(chunks)}: {len(chunk.split())} words → {len(summary.split())} word summary")
            except ValueError:
                logger.warning(f"Chunk {i + 1}/{len(chunks)} too short, skipping")
                continue
            except Exception as e:
                logger.error(f"Chunk {i + 1}/{len(chunks)} failed: {e}")
                continue

        if not chunk_summaries:
            raise ValueError("All chunks failed during summarization")

        # If only one chunk summary, return it directly
        if len(chunk_summaries) == 1:
            return chunk_summaries[0]

        # REDUCE: combine chunk summaries into a final summary
        combined = " ".join(chunk_summaries)
        combined_words = len(combined.split())

        if combined_words < 60:
            # Combined summaries too short to re-summarize
            return combined

        if int(combined_words * 1.3) > MAX_INPUT_TOKENS:
            # If combined summaries are still too long, truncate
            max_words = int(MAX_INPUT_TOKENS / 1.3)
            combined = " ".join(combined.split()[:max_words])

        logger.info(f"Reduce step: combining {len(chunk_summaries)} chunk summaries ({combined_words} words)")
        return self._summarize_single(combined)


# ---------------------------------------------------------------------------
# Singleton / module-level API
# ---------------------------------------------------------------------------

_summarizer: TextSummarizer | None = None


def get_summarizer() -> TextSummarizer:
    global _summarizer
    if _summarizer is None:
        _summarizer = TextSummarizer()
    return _summarizer


def summarize_text(text: str) -> str:
    """
    Module-level function called by FastAPI endpoints.
    Raises ValueError on invalid input, Exception on model failures.
    """
    return get_summarizer().summarize(text)
