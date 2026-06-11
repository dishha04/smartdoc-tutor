"""
SmartDoc Tutor — FastAPI Backend
AI-powered document summarization, Q&A (RAG), and MCQ generation.
"""

import os
import sys
import asyncio

if sys.platform == 'win32':
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())

import uuid
import logging
import json
import tempfile
from datetime import timedelta, datetime

from fastapi import FastAPI, HTTPException, UploadFile, File, Depends, status
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordRequestForm
from pydantic import BaseModel, Field
from dotenv import load_dotenv

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger(__name__)

# Local imports
from models.pdf_extractor import extract_text_from_pdf
from models.summarizer import summarize_text
from models.mcq_pipeline import generate_mcqs
from models.qa_pipeline import answer_question
from models.chunker import chunk_text_for_rag
from models.embedding_service import get_embedding_service
from models.vector_store import get_vector_store
from db import get_db, close_db, engine
from models.database import Base, UserDB, DocumentDB, ChatHistoryDB, QuizScoreDB
from models.user import UserCreate, UserResponse, Token
from auth import (
    get_password_hash,
    verify_password,
    create_access_token,
    get_current_user,
    ACCESS_TOKEN_EXPIRE_MINUTES
)

# ---------------------------------------------------------------------------
# Pydantic models for endpoints
# ---------------------------------------------------------------------------

class UserUpdate(BaseModel):
    name: str
    email: str

class PasswordUpdate(BaseModel):
    current_password: str
    new_password: str

class SummarizeRequest(BaseModel):
    doc_id: str

class QARequest(BaseModel):
    doc_id: str
    question: str = Field(..., min_length=5)

class QAResponse(BaseModel):
    answer: str

class MCQRequest(BaseModel):
    doc_id: str
    count: int = Field(ge=1, le=10, default=5)

class MCQResponse(BaseModel):
    mcqs: list

class ScoreRequest(BaseModel):
    doc_id: str
    score: int
    total_questions: int
    quiz_data: str = None

class DocumentResponse(BaseModel):
    doc_id: str
    filename: str
    word_count: int

# ---------------------------------------------------------------------------
# Application
# ---------------------------------------------------------------------------

app = FastAPI(
    title="SmartDoc Tutor API",
    description="AI-powered document QA and MCQ generation",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=os.getenv(
        "ALLOWED_ORIGINS",
        "http://localhost:3000,http://localhost:5173,http://127.0.0.1:5173"
    ).split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
async def startup_db_client():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    logger.info("PostgreSQL tables initialized")

@app.on_event("shutdown")
async def shutdown_db_client():
    await close_db()

# ---------------------------------------------------------------------------
# Auth Endpoints
# ---------------------------------------------------------------------------

@app.post("/signup", response_model=UserResponse)
async def signup(user: UserCreate, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(UserDB).where(UserDB.email == user.email))
    existing_user = result.scalars().first()
    
    if existing_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    hashed_password = get_password_hash(user.password)
    user_id = str(uuid.uuid4())
    
    new_user = UserDB(
        id=user_id,
        email=user.email,
        hashed_password=hashed_password
    )
    
    db.add(new_user)
    await db.commit()
    await db.refresh(new_user)
    
    return UserResponse(id=new_user.id, email=new_user.email)

@app.post("/login", response_model=Token)
async def login(form_data: OAuth2PasswordRequestForm = Depends(), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(UserDB).where(UserDB.email == form_data.username))
    user = result.scalars().first()
    
    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user.email, "user_id": user.id}, expires_delta=access_token_expires
    )
    return {"access_token": access_token, "token_type": "bearer"}

@app.get("/users/me")
async def read_users_me(current_user: dict = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(UserDB).where(UserDB.id == current_user["user_id"]))
    user = result.scalars().first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return {
        "id": user.id,
        "email": user.email,
        "name": user.name,
        "created_at": user.created_at.isoformat() if user.created_at else None
    }

@app.put("/users/me")
async def update_users_me(payload: UserUpdate, current_user: dict = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(UserDB).where(UserDB.id == current_user["user_id"]))
    user = result.scalars().first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
        
    # If email changed, check if new email exists
    if user.email != payload.email:
        email_check = await db.execute(select(UserDB).where(UserDB.email == payload.email))
        if email_check.scalars().first():
            raise HTTPException(status_code=400, detail="Email already taken")
            
    user.name = payload.name
    user.email = payload.email
    await db.commit()
    await db.refresh(user)
    return {"message": "Profile updated successfully"}

@app.put("/users/password")
async def update_password(payload: PasswordUpdate, current_user: dict = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(UserDB).where(UserDB.id == current_user["user_id"]))
    user = result.scalars().first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
        
    if not verify_password(payload.current_password, user.hashed_password):
        raise HTTPException(status_code=400, detail="Incorrect current password")
        
    user.hashed_password = get_password_hash(payload.new_password)
    await db.commit()
    return {"message": "Password updated successfully"}

# ---------------------------------------------------------------------------
# Document Endpoints
# ---------------------------------------------------------------------------

@app.post("/upload")
async def upload_pdf(file: UploadFile = File(...), current_user: dict = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    """Upload a PDF document, extract text, and generate a summary with streaming progress."""

    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are supported.")

    # Read contents upfront so it is not lost
    try:
        contents = await file.read()
    except Exception as e:
        logger.error(f"Failed to read uploaded file: {e}")
        raise HTTPException(status_code=500, detail="Failed to read uploaded file.")

    filename = file.filename
    user_id = current_user["user_id"]
    
    # Check for duplicate
    result = await db.execute(
        select(DocumentDB).where(DocumentDB.user_id == user_id, DocumentDB.filename == filename)
    )
    if result.scalars().first():
        async def duplicate_stream():
            yield f"data: {json.dumps({'error': 'A document with this name already exists.'})}\n\n"
        return StreamingResponse(duplicate_stream(), media_type="text/event-stream")

    async def process_document():
        tmp_path = ""
        try:
            yield f"data: {json.dumps({'step': 'Saving uploaded file...'})}\n\n"
            await asyncio.sleep(0.1)
            
            with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as tmp:
                tmp.write(contents)
                tmp_path = tmp.name

            yield f"data: {json.dumps({'step': 'Extracting text from PDF...'})}\n\n"
            await asyncio.sleep(0.1)
            extracted_text = extract_text_from_pdf(tmp_path)
            logger.info(f"Extracted {len(extracted_text.split())} words from '{filename}'")

            yield f"data: {json.dumps({'step': 'Generating AI summary...'})}\n\n"
            await asyncio.sleep(0.1)
            summary = summarize_text(extracted_text)

            yield f"data: {json.dumps({'step': 'Saving to database...'})}\n\n"
            await asyncio.sleep(0.1)
            doc_id = str(uuid.uuid4())
            new_doc = DocumentDB(
                doc_id=doc_id,
                user_id=user_id,
                filename=filename,
                file_type="PDF",
                text=extracted_text,
                word_count=len(extracted_text.split()),
                summary=summary,
                file_data=contents
            )
            db.add(new_doc)
            await db.commit()

            yield f"data: {json.dumps({'step': 'Chunking for AI search...'})}\n\n"
            await asyncio.sleep(0.1)
            rag_chunks = chunk_text_for_rag(extracted_text)
            
            if rag_chunks:
                yield f"data: {json.dumps({'step': 'Generating Embeddings...'})}\n\n"
                await asyncio.sleep(0.1)
                embedding_service = get_embedding_service()
                embeddings = embedding_service.embed_chunks(rag_chunks)
                
                yield f"data: {json.dumps({'step': 'Building FAISS Index...'})}\n\n"
                await asyncio.sleep(0.1)
                vector_store = get_vector_store()
                vector_store.create_index(doc_id, rag_chunks, embeddings)
                logger.info(f"RAG index built: {len(rag_chunks)} chunks for doc_id={doc_id}")

            logger.info(f"Document stored: doc_id={doc_id}, filename={filename}")
            yield f"data: {json.dumps({'step': 'Complete', 'doc_id': doc_id})}\n\n"

        except ValueError as e:
            yield f"data: {json.dumps({'error': str(e)})}\n\n"
        except Exception as e:
            logger.error(f"Failed to process PDF: {e}")
            yield f"data: {json.dumps({'error': 'Failed to process PDF'})}\n\n"
        finally:
            if os.path.exists(tmp_path):
                os.remove(tmp_path)

    return StreamingResponse(process_document(), media_type="text/event-stream")


@app.post("/summarize")
async def summarize_document(payload: SummarizeRequest, current_user: dict = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    """Generate a summary for an already uploaded document."""
    result = await db.execute(
        select(DocumentDB).where(DocumentDB.doc_id == payload.doc_id, DocumentDB.user_id == current_user["user_id"])
    )
    document = result.scalars().first()
    
    if not document:
        raise HTTPException(status_code=404, detail="Document not found or unauthorized.")
    
    text = document.text
    original_word_count = len(text.split())

    try:
        # Use existing summary if available
        if document.summary:
            summary_content = document.summary
        else:
            summary_content = summarize_text(text)
            document.summary = summary_content
            await db.commit()

        summary_word_count = len(summary_content.split())
        compression_ratio = round((1 - (summary_word_count / original_word_count)) * 100, 1) if original_word_count > 0 else 0
        
        return {
            "summary": summary_content,
            "original_word_count": original_word_count,
            "summary_word_count": summary_word_count,
            "compression_ratio": compression_ratio
        }
    except Exception as e:
        logger.error(f"Summarization failed for doc_id={payload.doc_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to generate summary.")


@app.post("/qa", response_model=QAResponse)
async def qa_endpoint(payload: QARequest, current_user: dict = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    """Answer a question using RAG against the uploaded document."""
    result = await db.execute(
        select(DocumentDB).where(DocumentDB.doc_id == payload.doc_id, DocumentDB.user_id == current_user["user_id"])
    )
    document = result.scalars().first()
    
    if not document:
        raise HTTPException(status_code=404, detail="Document not found or unauthorized.")
    
    text = document.text
    try:
        answer = answer_question(text=text, question=payload.question, doc_id=payload.doc_id)
    except Exception as e:
        logger.error(f"QA failed for doc_id={payload.doc_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to generate answer.")

    if not answer:
        raise HTTPException(status_code=400, detail="Unable to answer the question.")

    chat_id = str(uuid.uuid4())
    chat_entry = ChatHistoryDB(
        id=chat_id,
        doc_id=payload.doc_id,
        user_id=current_user["user_id"],
        question=payload.question,
        answer=answer
    )
    db.add(chat_entry)
    await db.commit()

    return {"answer": answer}


@app.post("/mcqs", response_model=MCQResponse)
async def generate_mcqs_endpoint(payload: MCQRequest, current_user: dict = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    """Generate MCQs from the uploaded document."""
    result = await db.execute(
        select(DocumentDB).where(DocumentDB.doc_id == payload.doc_id, DocumentDB.user_id == current_user["user_id"])
    )
    document = result.scalars().first()
    
    if not document:
        raise HTTPException(status_code=404, detail="Document not found or unauthorized.")
    
    text = document.text
    try:
        mcqs = generate_mcqs(text=text, n=payload.count)
    except Exception as e:
        logger.error(f"MCQ generation failed for doc_id={payload.doc_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to generate MCQs.")

    if not mcqs:
        raise HTTPException(status_code=400, detail="Unable to generate MCQs from the document.")

    return {"mcqs": mcqs}


@app.get("/documents")
async def list_documents(current_user: dict = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    """List all documents for the current user."""
    result = await db.execute(select(DocumentDB).where(DocumentDB.user_id == current_user["user_id"]))
    documents = result.scalars().all()
    
    docs = [
        {
            "doc_id": doc.doc_id, 
            "filename": doc.filename,
            "file_type": doc.file_type,
            "upload_date": doc.upload_date.isoformat() if doc.upload_date else datetime.utcnow().isoformat(),
            "word_count": doc.word_count
        }
        for doc in documents
    ]
    return {"documents": docs}

@app.delete("/documents/{doc_id}")
async def delete_document(doc_id: str, current_user: dict = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    """Delete a document for the current user."""
    result = await db.execute(select(DocumentDB).where(DocumentDB.doc_id == doc_id, DocumentDB.user_id == current_user["user_id"]))
    document = result.scalars().first()
    
    if not document:
        raise HTTPException(status_code=404, detail="Document not found or unauthorized.")
        
    await db.delete(document)
    await db.commit()
    return {"message": "Document deleted successfully."}

@app.get("/qa/history/{doc_id}")
async def get_qa_history(doc_id: str, current_user: dict = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(ChatHistoryDB)
        .where(ChatHistoryDB.doc_id == doc_id, ChatHistoryDB.user_id == current_user["user_id"])
        .order_by(ChatHistoryDB.timestamp.asc())
    )
    history = result.scalars().all()
    return {"history": [{"question": h.question, "answer": h.answer, "timestamp": h.timestamp.isoformat()} for h in history]}

@app.post("/scores")
async def save_score(payload: ScoreRequest, current_user: dict = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    score_id = str(uuid.uuid4())
    score_entry = QuizScoreDB(
        id=score_id,
        doc_id=payload.doc_id,
        user_id=current_user["user_id"],
        score=payload.score,
        total_questions=payload.total_questions,
        quiz_data=payload.quiz_data
    )
    db.add(score_entry)
    await db.commit()
    return {"message": "Score saved successfully"}

@app.get("/scores")
async def get_scores(current_user: dict = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(QuizScoreDB, DocumentDB.filename)
        .join(DocumentDB, QuizScoreDB.doc_id == DocumentDB.doc_id)
        .where(QuizScoreDB.user_id == current_user["user_id"])
        .order_by(QuizScoreDB.timestamp.desc())
    )
    
    scores = []
    for score_entry, filename in result.all():
        scores.append({
            "doc_id": score_entry.doc_id,
            "filename": filename,
            "score": score_entry.score,
            "total_questions": score_entry.total_questions,
            "quiz_data": score_entry.quiz_data,
            "timestamp": score_entry.timestamp.isoformat()
        })
    return {"scores": scores}
