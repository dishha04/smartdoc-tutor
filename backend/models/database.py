import datetime
from sqlalchemy import Column, String, Integer, DateTime, LargeBinary, Text
from sqlalchemy.orm import declarative_base

Base = declarative_base()

class UserDB(Base):
    __tablename__ = "users"
    
    id = Column(String, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    name = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

class DocumentDB(Base):
    __tablename__ = "documents"
    
    doc_id = Column(String, primary_key=True, index=True)
    user_id = Column(String, index=True, nullable=False)
    filename = Column(String, nullable=False)
    file_type = Column(String, nullable=False, default="PDF")
    upload_date = Column(DateTime, default=datetime.datetime.utcnow)
    text = Column(Text, nullable=False)
    word_count = Column(Integer, default=0)
    summary = Column(Text, nullable=True)
    file_data = Column(LargeBinary, nullable=True)  # To store the raw PDF bytes

class ChatHistoryDB(Base):
    __tablename__ = "chat_history"
    
    id = Column(String, primary_key=True, index=True)
    doc_id = Column(String, index=True, nullable=False)
    user_id = Column(String, index=True, nullable=False)
    question = Column(Text, nullable=False)
    answer = Column(Text, nullable=False)
    timestamp = Column(DateTime, default=datetime.datetime.utcnow)

class QuizScoreDB(Base):
    __tablename__ = "quiz_scores"
    
    id = Column(String, primary_key=True, index=True)
    doc_id = Column(String, index=True, nullable=False)
    user_id = Column(String, index=True, nullable=False)
    score = Column(Integer, nullable=False)
    total_questions = Column(Integer, nullable=False)
    quiz_data = Column(Text, nullable=True) # Store JSON string of questions, options, user answers
    timestamp = Column(DateTime, default=datetime.datetime.utcnow)
