# SmartDoc Tutor

An AI-powered document learning platform. Upload a PDF, get an instant summary, ask questions about its content, and take auto-generated quizzes — all backed by a full-stack web application with user accounts and persistent history.

---

## Features

**Document Management**
- Upload PDF documents with real-time processing progress streamed to the browser
- Duplicate detection — the same filename cannot be uploaded twice per account
- Search and filter documents by name and upload date
- Status badges indicating whether a document has been summarized or quizzed

**AI Summarization**
- Automatic AI-generated summary on every upload using a local transformer model (BART-large-CNN)
- Multi-chunk map-reduce strategy for long documents that exceed the model's token limit

**Retrieval-Augmented Q&A**
- Ask any question about an uploaded document
- Answers are grounded in the actual document content via FAISS vector search (RAG)
- Full Q&A chat history stored per document per user

**Quiz System**
- Auto-generated multiple-choice questions from document content via Groq LLM
- Timed quizzes with auto-submission
- Correct and incorrect answers shown with explanations after submission
- Full quiz history stored — review every question, your answer, and the correct answer at any time

**Dashboard**
- Personalized landing page after login with a time-based greeting
- At-a-glance stats: total documents, quizzes taken, average score
- Continue learning card linking to the most recently uploaded document
- Unified recent activity feed combining uploads and quiz attempts
- Quiz score progression chart over time

**User Accounts**
- JWT-based authentication (7-day tokens)
- Secure bcrypt password hashing
- Profile page to update display name, email address, and password
- Account creation timestamp and joined date displayed on profile

---

## Tech Stack

### Backend
| Technology | Purpose |
|-----------|---------|
| Python 3.11+ | Runtime |
| FastAPI | REST API framework with async support |
| SQLAlchemy (async) | ORM for PostgreSQL |
| asyncpg | Async PostgreSQL driver |
| PostgreSQL | Primary database |
| PyJWT + bcrypt | Authentication and password hashing |
| Hugging Face Transformers | Local BART-large-CNN summarization model |
| sentence-transformers | Local MiniLM-L6-v2 embedding model for RAG |
| FAISS (CPU) | Vector similarity search |
| Groq API | LLM for Q&A and MCQ generation |
| pdfplumber | PDF text extraction |

### Frontend
| Technology | Purpose |
|-----------|---------|
| React 19 | UI framework |
| React Router v7 | Client-side routing |
| Axios | HTTP client |
| Recharts | Quiz score progression chart |
| Lucide React | Icon library |
| Inter (Google Fonts) | Typography |
| Vanilla CSS | Styling with CSS custom properties |

---

## Project Structure

```
smartdoc-tutor/
├── backend/
│   ├── main.py                  # FastAPI app, all API endpoints
│   ├── auth.py                  # JWT authentication logic
│   ├── db.py                    # Async SQLAlchemy engine and session
│   ├── migrate_db.py            # Database migration helper
│   ├── models/
│   │   ├── database.py          # SQLAlchemy table definitions
│   │   ├── summarizer.py        # BART-based summarization pipeline
│   │   ├── embedding_service.py # MiniLM sentence embeddings
│   │   ├── vector_store.py      # FAISS index management (disk + memory)
│   │   ├── qa_pipeline.py       # RAG-based Q&A via Groq
│   │   ├── mcq_pipeline.py      # MCQ generation via Groq
│   │   ├── chunker.py           # Text chunking for long documents
│   │   ├── pdf_extractor.py     # PDF text extraction via pdfplumber
│   │   └── user.py              # Pydantic request/response schemas
│   └── Procfile                 # Production server start command
├── frontend/
│   ├── public/
│   └── src/
│       ├── App.js               # Root component, routing, navbar
│       ├── App.css              # Global design system and CSS variables
│       ├── index.css            # Google Fonts import and base reset
│       ├── services/
│       │   └── api.js           # Axios client and all API call functions
│       └── pages/
│           ├── Home.js          # Landing page
│           ├── Login.js         # Sign in
│           ├── Signup.js        # Register
│           ├── Dashboard.js     # Post-login overview
│           ├── Documents.js     # Upload and manage documents
│           ├── Analyze.js       # Summary, Q&A, and quiz for a document
│           └── Profile.js       # Account settings and stats
├── .env.example                 # Environment variable reference
├── requirements.txt             # Python dependencies
└── vector_stores/               # FAISS index files (gitignored)
```

---

## Data Storage

**PostgreSQL (server-side, persistent)**

| Table | Stores |
|-------|--------|
| `users` | ID, email, bcrypt-hashed password, display name, joined date |
| `documents` | Document metadata, extracted text, AI summary, raw PDF bytes |
| `chat_history` | Every Q&A question and answer per document per user |
| `quiz_scores` | Score, question count, full quiz JSON (questions, options, answers) |

**Server filesystem**
- `vector_stores/{doc_id}/index.faiss` — FAISS binary index
- `vector_stores/{doc_id}/chunks.json` — Text chunk mapping

**Browser localStorage**
- `token` — JWT access token (cleared on sign out)

---

## Local Setup

### Prerequisites
- Python 3.11+
- Node.js 18+
- PostgreSQL running locally
- A [Groq API key](https://console.groq.com)

### 1. Clone the repository

```bash
git clone https://github.com/dishha04/smartdoc-tutor.git
cd smartdoc-tutor
```

### 2. Backend setup

```bash
cd backend
pip install -r ../requirements.txt
```

Create a `.env` file in the project root (copy from `.env.example`):

```env
GROQ_API_KEY=your_groq_api_key
POSTGRES_URL=postgresql+asyncpg://postgres:postgres@localhost:5432/smartdoc_tutor
SECRET_KEY=any_random_string_for_development
```

Start the backend:

```bash
uvicorn main:app --reload
```

The API will be available at `http://localhost:8000`. Database tables are created automatically on first startup.

### 3. Frontend setup

```bash
cd frontend
npm install
npm start
```

The app will open at `http://localhost:3000`.

---

## Environment Variables

### Backend (`.env`)

| Variable | Required | Description |
|----------|----------|-------------|
| `GROQ_API_KEY` | Yes | API key for Groq LLM (Q&A and MCQ generation) |
| `POSTGRES_URL` | Yes | Async PostgreSQL connection string |
| `SECRET_KEY` | Yes | Secret used to sign JWT tokens |
| `ALLOWED_ORIGINS` | No | Comma-separated list of allowed frontend URLs (defaults to localhost) |

### Frontend (`.env.production`)

| Variable | Required | Description |
|----------|----------|-------------|
| `REACT_APP_API_URL` | Yes (production) | Backend API base URL (defaults to `http://localhost:8000`) |

---

## API Overview

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/signup` | Create a new user account |
| POST | `/login` | Authenticate and receive a JWT token |
| GET | `/users/me` | Get the current user's profile |
| PUT | `/users/me` | Update name or email |
| PUT | `/users/password` | Change password (requires current password) |
| POST | `/upload` | Upload and process a PDF (streaming SSE response) |
| GET | `/documents` | List all documents for the authenticated user |
| DELETE | `/documents/{doc_id}` | Delete a document and its vector index |
| POST | `/summarize` | Get the summary for a document |
| POST | `/qa` | Ask a question about a document |
| GET | `/qa/history/{doc_id}` | Get Q&A history for a document |
| POST | `/mcq` | Generate multiple-choice questions from a document |
| POST | `/scores` | Save a quiz score |
| GET | `/scores` | Get all quiz scores for the authenticated user |

---

## License

MIT
