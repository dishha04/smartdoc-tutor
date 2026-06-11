import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Upload, FileText, Trash2, Eye, Brain, Search, Filter } from 'lucide-react';
import { uploadDocument, getDocuments, deleteDocument, getQuizScores } from '../services/api';
import './Documents.css';

function Documents() {
  const navigate = useNavigate();
  const [documents, setDocuments] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [selectedFile, setSelectedFile] = useState(null);
  const [error, setError] = useState('');
  const [uploadStep, setUploadStep] = useState('');

  const [scores, setScores] = useState([]);
  const [scoresLoading, setScoresLoading] = useState(true);
  const [reviewQuizData, setReviewQuizData] = useState(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [dateFilter, setDateFilter] = useState('all');

  // Load documents and scores on mount
  useEffect(() => {
    loadDocuments();
    loadScores();
  }, []);

  const loadScores = async () => {
    try {
      setScoresLoading(true);
      const scrs = await getQuizScores();
      setScores(scrs);
    } catch (err) {
      console.error("Failed to load scores:", err);
    } finally {
      setScoresLoading(false);
    }
  };

  const loadDocuments = async () => {
    try {
      setLoading(true);
      const docs = await getDocuments();
      setDocuments(docs);
    } catch (err) {
      setError('Failed to load documents');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      setSelectedFile(file);
      setError('');
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      setError('Please select a file first');
      return;
    }

    try {
      setUploading(true);
      setUploadStep('Connecting to server...');
      setError('');
      const result = await uploadDocument(selectedFile, (step) => {
        setUploadStep(step);
      });
      alert(`✅ Document uploaded successfully!\nDoc ID: ${result.doc_id}`);
      setSelectedFile(null);
      loadDocuments();
    } catch (err) {
      setError(err.message || err.response?.data?.detail || 'Upload failed');
    } finally {
      setUploading(false);
      setUploadStep('');
    }
  };

  const handleDelete = async (docId) => {
    if (window.confirm('Are you sure you want to delete this document?')) {
      try {
        await deleteDocument(docId);
        loadDocuments();
      } catch (err) {
        alert('Failed to delete document');
      }
    }
  };

  const handleAnalyze = (docId) => {
    navigate(`/analyze/${docId}`);
  };

  const filteredDocuments = documents.filter(doc => {
    const matchesSearch = doc.filename.toLowerCase().includes(searchQuery.toLowerCase());
    
    if (!matchesSearch) return false;

    if (dateFilter === 'all') return true;
    
    const docDate = new Date(doc.upload_date);
    const now = new Date();
    const diffTime = Math.abs(now - docDate);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 

    if (dateFilter === 'today') return diffDays <= 1;
    if (dateFilter === 'week') return diffDays <= 7;
    if (dateFilter === 'month') return diffDays <= 30;
    
    return true;
  });

  return (
    <div className="documents-page">
      <div className="container">
        <h1 className="page-title">My Documents</h1>

        {/* Upload Section */}
        <div className="upload-section card">
          <div className="upload-icon">
            <Upload size={48} />
          </div>
          <h2>Upload Document</h2>
          <p className="upload-subtitle">
            Supports PDF, DOCX, and TXT files
          </p>

          <div className="upload-controls">
            <input
              type="file"
              id="file-input"
              accept=".pdf,.docx,.txt"
              onChange={handleFileSelect}
              className="file-input"
            />
            <label htmlFor="file-input" className="btn btn-secondary">
              Choose File
            </label>
            {selectedFile && (
              <span className="selected-file">{selectedFile.name}</span>
            )}
          </div>

          {error && <div className="error-message">{error}</div>}

          <button
            className="btn btn-primary"
            onClick={handleUpload}
            disabled={!selectedFile || uploading}
          >
            {uploading ? (
              <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div className="spinner" style={{ width: '16px', height: '16px', borderWidth: '2px' }}></div>
                {uploadStep || 'Uploading...'}
              </span>
            ) : 'Upload & Analyze'}
          </button>
        </div>

        {/* Documents List */}
        <div className="documents-list">
          <div className="documents-list-header">
            <h2 className="list-title">Your Documents</h2>
            <div className="documents-controls">
              <div className="search-bar">
                <Search size={18} />
                <input 
                  type="text" 
                  placeholder="Search documents..." 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <div className="filter-dropdown">
                <Filter size={18} />
                <select value={dateFilter} onChange={(e) => setDateFilter(e.target.value)}>
                  <option value="all">All Time</option>
                  <option value="today">Today</option>
                  <option value="week">Last 7 Days</option>
                  <option value="month">Last 30 Days</option>
                </select>
              </div>
            </div>
          </div>

          {loading ? (
            <div className="loading">
              <div className="spinner"></div>
              <p>Loading documents...</p>
            </div>
          ) : filteredDocuments.length === 0 ? (
            <div className="empty-state">
              <svg width="120" height="120" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" style={{opacity: 0.5, marginBottom: '1rem'}}>
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                <polyline points="14 2 14 8 20 8"></polyline>
                <line x1="12" y1="18" x2="12" y2="12"></line>
                <line x1="9" y1="15" x2="15" y2="15"></line>
              </svg>
              <h3 style={{color: 'var(--text)', marginBottom: '0.5rem'}}>No Documents Found</h3>
              <p>Upload a new document to get started with AI analysis.</p>
            </div>
          ) : (
            <div className="documents-grid">
              {filteredDocuments.map((doc) => {
                // Calculate Badges
                const docDate = new Date(doc.upload_date);
                const isNew = Math.ceil(Math.abs(new Date() - docDate) / (1000 * 60 * 60 * 24)) <= 1;
                const hasQuiz = scores.some(s => s.doc_id === doc.doc_id);

                return (
                  <div key={doc.doc_id} className="document-card">
                    <div className="doc-badges">
                      {isNew && <span className="badge badge-new">New</span>}
                      <span className="badge badge-summarized">Summarized</span>
                      {hasQuiz && <span className="badge badge-quiz">Quiz Done</span>}
                    </div>
                    <div className="doc-header">
                      <FileText size={24} />
                      <span className="doc-type">{doc.file_type}</span>
                    </div>
                  <h3 className="doc-name">{doc.filename}</h3>
                  <p className="doc-info">{doc.word_count} words</p>
                  <p className="doc-date">
                    {new Date(doc.upload_date).toLocaleDateString()}
                  </p>
                  <div className="doc-actions">
                    <button
                      className="btn-icon btn-primary-outline"
                      onClick={() => handleAnalyze(doc.doc_id)}
                      title="Analyze with AI"
                    >
                      <Brain size={20} />
                    </button>
                    <button
                      className="btn-icon btn-danger-outline"
                      onClick={() => handleDelete(doc.doc_id)}
                      title="Delete"
                    >
                      <Trash2 size={20} />
                    </button>
                  </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Quiz Scores List */}
        <div className="scores-list" style={{ marginTop: '4rem' }}>
          <h2 className="list-title">Your Quiz Scores</h2>

          {scoresLoading ? (
            <div className="loading">
              <div className="spinner"></div>
              <p>Loading scores...</p>
            </div>
          ) : scores.length === 0 ? (
            <div className="empty-state">
              <Brain size={64} />
              <p>No quiz scores yet. Analyze a document and take a quiz!</p>
            </div>
          ) : (
            <div className="documents-grid">
              {scores.map((score, idx) => (
                <div key={idx} className="document-card">
                  <div className="doc-header">
                    <Brain size={24} />
                    <span className="doc-type">Quiz</span>
                  </div>
                  <h3 className="doc-name">{score.filename}</h3>
                  <p className="doc-info" style={{ fontWeight: 'bold', color: 'var(--primary)', fontSize: '1.25rem' }}>
                    Score: {score.score} / {score.total_questions}
                  </p>
                  <p className="doc-date">
                    {new Date(score.timestamp).toLocaleString()}
                  </p>
                  {score.quiz_data && (
                    <div className="doc-actions" style={{ marginTop: '1rem' }}>
                      <button
                        className="btn btn-secondary"
                        onClick={() => {
                          try {
                            const parsedData = typeof score.quiz_data === 'string' ? JSON.parse(score.quiz_data) : score.quiz_data;
                            setReviewQuizData(parsedData);
                          } catch (e) {
                            console.error("Failed to parse quiz_data", e);
                          }
                        }}
                      >
                        Review Quiz
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Review Modal */}
        {reviewQuizData && (
          <div className="modal-overlay" onClick={() => setReviewQuizData(null)}>
            <div className="modal-content" onClick={e => e.stopPropagation()}>
              <div className="modal-header">
                <h2>Quiz Review</h2>
                <button className="btn-icon" onClick={() => setReviewQuizData(null)}>✕</button>
              </div>
              <div className="modal-body">
                {reviewQuizData.map((q, i) => (
                  <div key={i} className="review-question card" style={{ marginBottom: '1.5rem', padding: '1rem' }}>
                    <h4 style={{ color: 'var(--primary)', marginBottom: '0.5rem' }}>Question {i + 1}</h4>
                    <p style={{ fontWeight: 'bold', marginBottom: '1rem' }}>{q.question}</p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      {Object.entries(q.options).map(([key, val]) => {
                        let isCorrect = key === q.correct_answer;
                        let isUserSelected = key === q.user_answer;
                        
                        let bgColor = 'transparent';
                        let borderColor = 'var(--border)';
                        if (isCorrect) {
                          bgColor = '#ecfdf5';
                          borderColor = 'var(--success)';
                        } else if (isUserSelected && !isCorrect) {
                          bgColor = '#fee';
                          borderColor = 'var(--error)';
                        }

                        return (
                          <div key={key} style={{ 
                            padding: '0.5rem 1rem', 
                            borderRadius: '0.5rem', 
                            border: `2px solid ${borderColor}`,
                            background: bgColor,
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem'
                          }}>
                            <strong>{key}.</strong> {val}
                            {isCorrect && <span style={{marginLeft: 'auto'}}>✅</span>}
                            {isUserSelected && !isCorrect && <span style={{marginLeft: 'auto'}}>❌ (Your Answer)</span>}
                          </div>
                        )
                      })}
                    </div>
                    {q.explanation && (
                      <div style={{ marginTop: '1rem', padding: '1rem', background: '#f8fafc', borderRadius: '0.5rem', borderLeft: '4px solid var(--primary)' }}>
                        <strong>Explanation:</strong>
                        <p style={{ marginTop: '0.5rem' }}>{q.explanation}</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default Documents;
