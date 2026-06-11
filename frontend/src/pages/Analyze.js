import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { FileText, Sparkles, Brain, MessageCircle, ArrowLeft } from 'lucide-react';
import { summarizeDocument, generateMCQs, askQuestion, getDocuments, getQaHistory, saveQuizScore } from '../services/api';
import './Analyze.css';
// import Analyze from './pages/Analyze';  // 

function Analyze() {
  const { docId } = useParams();
  const navigate = useNavigate();
  
  const [document, setDocument] = useState(null);
  const [activeTab, setActiveTab] = useState('summary');
  const [loading, setLoading] = useState(false);
  
  // Summary state
  const [summary, setSummary] = useState(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  
  // MCQ state
  const [mcqs, setMcqs] = useState([]);
  const [mcqLoading, setMcqLoading] = useState(false);
  const [selectedAnswers, setSelectedAnswers] = useState({});
  const [showResults, setShowResults] = useState(false);
  const [timeLeft, setTimeLeft] = useState(0);
  
  // Q&A state
  const [question, setQuestion] = useState('');
  const [qaHistory, setQaHistory] = useState([]);
  const [qaLoading, setQaLoading] = useState(false);

  useEffect(() => {
    loadDocument();
  }, [docId]);

  useEffect(() => {
    if (activeTab === 'mcq' && mcqs.length > 0 && !showResults && timeLeft > 0) {
      const timerId = setTimeout(() => setTimeLeft(timeLeft - 1), 1000);
      return () => clearTimeout(timerId);
    } else if (timeLeft === 0 && mcqs.length > 0 && !showResults) {
      handleSubmitQuiz();
    }
  }, [timeLeft, activeTab, mcqs, showResults]);

  const loadDocument = async () => {
    try {
      const docs = await getDocuments();
      const doc = docs.find(d => d.doc_id === docId);
      if (doc) {
        setDocument(doc);
        // Load QA history
        try {
          const history = await getQaHistory(docId);
          if (history && history.length > 0) {
            const formattedHistory = [];
            history.forEach(h => {
              formattedHistory.push({ type: 'question', text: h.question });
              formattedHistory.push({ type: 'answer', text: h.answer });
            });
            setQaHistory(formattedHistory);
          }
        } catch (e) {
          console.error("Failed to load QA history", e);
        }
        // Automatically fetch summary on load
        handleGenerateSummary(docId);
      } else {
        alert('Document not found');
        navigate('/documents');
      }
    } catch (err) {
      console.error(err);
      alert('Failed to load document');
    }
  };

  // SUMMARY
  const handleGenerateSummary = async (id = docId) => {
    try {
      setSummaryLoading(true);
      const result = await summarizeDocument(id);
      setSummary(result);
    } catch (err) {
      alert('Failed to generate summary');
      console.error(err);
    } finally {
      setSummaryLoading(false);
    }
  };

  // MCQ
  const handleGenerateMCQs = async () => {
    try {
      setMcqLoading(true);
      const result = await generateMCQs(docId, 5);
      setMcqs(result.mcqs || []);
      setTimeLeft((result.mcqs || []).length * 60);
      setSelectedAnswers({});
      setShowResults(false);
    } catch (err) {
      alert('Failed to generate MCQs');
      console.error(err);
    } finally {
      setMcqLoading(false);
    }
  };

  const handleAnswerSelect = (questionIndex, answer) => {
    setSelectedAnswers({ ...selectedAnswers, [questionIndex]: answer });
  };

  const handleSubmitQuiz = async () => {
    setShowResults(true);
    const { correct, total } = calculateScore();
    try {
      const quizData = mcqs.map((mcq, idx) => ({
        ...mcq,
        user_answer: selectedAnswers[idx] || null
      }));
      await saveQuizScore(docId, correct, total, quizData);
    } catch (err) {
      console.error("Failed to save quiz score", err);
    }
  };

  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const calculateScore = () => {
    let correct = 0;
    mcqs.forEach((mcq, index) => {
      if (selectedAnswers[index] === mcq.correct_answer) {
        correct++;
      }
    });
    return { correct, total: mcqs.length };
  };

  // Q&A
  const handleAskQuestion = async () => {
    if (!question.trim()) return;

    const userQuestion = question;
    setQuestion('');
    setQaLoading(true);

    try {
      const result = await askQuestion(docId, userQuestion);
      setQaHistory([
        ...qaHistory,
        { type: 'question', text: userQuestion },
        { type: 'answer', text: result.answer, confidence: result.confidence }
      ]);
    } catch (err) {
      setQaHistory([
        ...qaHistory,
        { type: 'question', text: userQuestion },
        { type: 'answer', text: 'Failed to get answer', error: true }
      ]);
    } finally {
      setQaLoading(false);
    }
  };

  if (!document) {
    return <div className="loading-page"><div className="spinner"></div></div>;
  }

  return (
    <div className="analyze-page">
      <div className="container">
        {/* Header */}
        <div className="analyze-header">
          <button className="btn-back" onClick={() => navigate('/documents')}>
            <ArrowLeft size={20} />
            Back to Documents
          </button>
          <h1 className="page-title">{document.filename}</h1>
          <p className="doc-meta">{document.word_count} words</p>
        </div>

        {/* Tabs */}
        <div className="tabs">
          <button
            className={`tab ${activeTab === 'summary' ? 'active' : ''}`}
            onClick={() => setActiveTab('summary')}
          >
            <Sparkles size={20} />
            Summary
          </button>
          <button
            className={`tab ${activeTab === 'mcq' ? 'active' : ''}`}
            onClick={() => setActiveTab('mcq')}
          >
            <Brain size={20} />
            MCQ Quiz
          </button>
          <button
            className={`tab ${activeTab === 'qa' ? 'active' : ''}`}
            onClick={() => setActiveTab('qa')}
          >
            <MessageCircle size={20} />
            Q&A
          </button>
        </div>

        {/* Content */}
        <div className="tab-content">
          {/* SUMMARY TAB */}
          {activeTab === 'summary' && (
            <div className="summary-section">
              {!summary ? (
                <div className="empty-state">
                  <Sparkles size={64} />
                  <h3>Generate AI Summary</h3>
                  <p>Get a concise summary of your document</p>
                  <button
                    className="btn btn-primary"
                    onClick={handleGenerateSummary}
                    disabled={summaryLoading}
                  >
                    {summaryLoading ? 'Generating...' : 'Generate Summary'}
                  </button>
                </div>
              ) : (
                <div className="summary-result card">
                  <h3>Summary</h3>
                  <p className="summary-text">{summary.summary}</p>
                  <div className="summary-stats">
                    <div className="stat">
                      <strong>Original:</strong> {summary.original_word_count} words
                    </div>
                    <div className="stat">
                      <strong>Summary:</strong> {summary.summary_word_count} words
                    </div>
                    <div className="stat">
                      <strong>Compression:</strong> {summary.compression_ratio}%
                    </div>
                  </div>
                  <button className="btn btn-secondary" onClick={handleGenerateSummary}>
                    Regenerate
                  </button>
                </div>
              )}
            </div>
          )}

          {/* MCQ TAB */}
          {activeTab === 'mcq' && (
            <div className="mcq-section">
              {mcqs.length === 0 ? (
                <div className="empty-state">
                  <Brain size={64} />
                  <h3>Generate Quiz Questions</h3>
                  <p>Test your understanding with AI-generated MCQs</p>
                  <button
                    className="btn btn-primary"
                    onClick={handleGenerateMCQs}
                    disabled={mcqLoading}
                  >
                    {mcqLoading ? 'Generating...' : 'Generate 5 Questions'}
                  </button>
                </div>
              ) : (
                <div className="mcq-quiz">
                  {!showResults && (
                    <div className="quiz-header">
                      <span>Answer all questions before time runs out!</span>
                      <div className="quiz-timer">⏱ {formatTime(timeLeft)}</div>
                    </div>
                  )}
                  {mcqs.map((mcq, index) => (
                    <div key={index} className="mcq-question card">
                      <h4>Question {index + 1}</h4>
                      <p className="question-text">{mcq.question}</p>
                      <div className="options">
                        {Object.entries(mcq.options).map(([key, value]) => (
                          <label
                            key={key}
                            className={`option ${
                              selectedAnswers[index] === key ? 'selected' : ''
                            } ${
                              showResults && key === mcq.correct_answer ? 'correct' : ''
                            } ${
                              showResults && selectedAnswers[index] === key && key !== mcq.correct_answer ? 'wrong' : ''
                            }`}
                          >
                            <input
                              type="radio"
                              name={`question-${index}`}
                              value={key}
                              checked={selectedAnswers[index] === key}
                              onChange={() => handleAnswerSelect(index, key)}
                              disabled={showResults}
                            />
                            <span>{key}. {value}</span>
                          </label>
                        ))}
                      </div>
                      {showResults && (
                        <div className={`explanation ${selectedAnswers[index] === mcq.correct_answer ? 'correct-bg' : 'wrong-bg'}`}>
                          <strong>{selectedAnswers[index] === mcq.correct_answer ? '✅ Correct!' : `❌ Incorrect (Correct answer: ${mcq.correct_answer})`}</strong>
                          <p>{mcq.explanation}</p>
                        </div>
                      )}
                    </div>
                  ))}
                  
                  {!showResults ? (
                    <button className="btn btn-primary" onClick={handleSubmitQuiz}>
                      Submit Quiz
                    </button>
                  ) : (
                   <div className="quiz-results card">
                        <h3>Results</h3>
                         <p className="score">
                          Score: {calculateScore().correct} / {calculateScore().total}
                        </p>
                             <button 
                                 className="btn btn-secondary" 
                             onClick={handleGenerateMCQs}
                                         disabled={mcqLoading}
                                                 >
                          {mcqLoading ? 'Generating New Questions...' : 'Try New Questions'}
                            </button>
                                </div>

                  )}
                </div>
              )}
            </div>
          )}

          {/* Q&A TAB */}
          {activeTab === 'qa' && (
            <div className="qa-section">
              <div className="qa-chat">
                {qaHistory.length === 0 && (
                  <div className="empty-chat">
                    <MessageCircle size={64} />
                    <p>Ask questions about your document!</p>
                  </div>
                )}
                
                {qaHistory.map((item, index) => (
                  <div key={index} className={`chat-message ${item.type}`}>
                    {item.type === 'question' ? (
                      <div className="message-content user">
                        <strong>You:</strong>
                        <p>{item.text}</p>
                      </div>
                    ) : (
                      <div className="message-content ai">
                        <strong>AI:</strong>
                        <p>{item.text}</p>
                        {item.confidence && (
                          <span className="confidence">
                            Confidence: {(item.confidence * 100).toFixed(0)}%
                          </span>
                        )}
                        {/* Debug info */}
                           <small style={{display: 'block', marginTop: '0.5rem', color: 'gray'}}>
                                 Raw answer: {JSON.stringify(item)}
                                </small>
                      </div>
                    )}
                  </div>
                ))}
                
                {qaLoading && (
                  <div className="chat-message answer">
                    <div className="message-content ai">
                      <div className="spinner"></div>
                    </div>
                  </div>
                )}
              </div>
              
              <div className="qa-input">
                <input
                  type="text"
                  placeholder="Ask a question about the document..."
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleAskQuestion()}
                  disabled={qaLoading}
                />
                <button
                  className="btn btn-primary"
                  onClick={handleAskQuestion}
                  disabled={!question.trim() || qaLoading}
                >
                  Ask
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default Analyze;
