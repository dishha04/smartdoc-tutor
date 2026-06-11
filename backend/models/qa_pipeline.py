"""
Question-Answer pipeline using RAG (Retrieval-Augmented Generation).

Flow:
1. Embed the user's question using sentence-transformers
2. Search FAISS index for top-K most relevant chunks
3. Build context from retrieved chunks
4. Send context + question to Gemini for answer generation
"""

import logging
from .embedding_service import get_embedding_service
from .vector_store import get_vector_store
from .groq_rest import generate_with_groq

logger = logging.getLogger(__name__)

QA_PROMPT = """
You are an AI tutor.

Answer the user's question using ONLY the information provided in the context below.
If the answer is not contained in the context, say:
"I cannot find the answer in the provided document."

Rules:
- Be clear and concise
- Do not add external knowledge
- Do not guess or speculate
- Use simple explanations
- If multiple context sections are relevant, synthesize the answer

Context:
<<<
{context}
>>>

Question:
{question}
"""


def answer_question(
    text: str,
    question: str,
    doc_id: str | None = None,
    top_k: int = 5,
) -> str:
    """
    Answer a question using RAG retrieval.
    
    Args:
        text: Full document text (fallback if no FAISS index exists)
        question: User's question
        doc_id: Document ID for FAISS index lookup
        top_k: Number of chunks to retrieve
    
    Returns:
        Answer string from Gemini
    """
    vector_store = get_vector_store()
    embedding_service = get_embedding_service()

    # Try RAG retrieval if doc_id has a FAISS index
    if doc_id and vector_store.has_index(doc_id):
        logger.info(f"Using RAG for doc_id={doc_id}, question='{question[:80]}...'")

        # Embed the question
        query_embedding = embedding_service.embed_text(question)

        # Search for relevant chunks
        relevant_chunks = vector_store.search(doc_id, query_embedding, top_k=top_k)

        if relevant_chunks:
            context = "\n\n---\n\n".join(relevant_chunks)
            logger.info(f"Retrieved {len(relevant_chunks)} chunks for context ({len(context.split())} words)")
        else:
            # Fallback to full text if search returns nothing
            logger.warning(f"RAG search returned no results for doc_id={doc_id}, falling back to full text")
            context = text.strip()[:3000]
    else:
        # No FAISS index — fallback to truncated full text
        logger.warning(f"No FAISS index for doc_id={doc_id}, using truncated text")
        context = text.strip()[:3000]

    if not context:
        return "Document does not contain enough information."

    prompt = QA_PROMPT.format(
        context=context,
        question=question,
    )

    return generate_with_groq(prompt).strip()
