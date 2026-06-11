import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add a request interceptor
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Auth APIs
export const login = async (email, password) => {
  const formData = new FormData();
  formData.append('username', email); // OAuth2 requires 'username'
  formData.append('password', password);
  
  const response = await api.post('/login', formData, {
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    }
  });
  return response.data;
};

export const signup = async (email, password) => {
  const response = await api.post('/signup', { email, password });
  return response.data;
};

export const logout = () => {
  localStorage.removeItem('token');
};

export const isAuthenticated = () => {
  return !!localStorage.getItem('token');
};

// Document APIs
export const uploadDocument = async (file, onProgress) => {
  const formData = new FormData();
  formData.append('file', file);
  
  const token = localStorage.getItem('token');
  
  const response = await fetch(`${API_BASE_URL}/upload`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`
    },
    body: formData,
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.detail || 'Upload failed');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let resultDocId = null;

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    
    const chunk = decoder.decode(value, { stream: true });
    const lines = chunk.split('\n');
    
    for (const line of lines) {
      if (line.startsWith('data: ')) {
        try {
          const data = JSON.parse(line.substring(6));
          if (data.error) {
            throw new Error(data.error);
          }
          if (data.step) {
            if (onProgress) onProgress(data.step);
          }
          if (data.step === 'Complete') {
            resultDocId = data.doc_id;
          }
        } catch (e) {
          // ignore parse errors for partial chunks or non-JSON
        }
      }
    }
  }
  
  return { doc_id: resultDocId };
};

export const getDocuments = async () => {
  const response = await api.get('/documents');
  return response.data.documents || [];
};

export const deleteDocument = async (docId) => {
  const response = await api.delete(`/documents/${docId}`);
  return response.data;
};

// AI Feature APIs
export const summarizeDocument = async (docId) => {
  const response = await api.post('/summarize', { doc_id: docId });
  return response.data;
};

export const generateMCQs = async (docId, numQuestions = 5) => {
  const response = await api.post('/mcqs', {
    doc_id: docId,
    count: numQuestions,
  });
  return response.data;
};

export const askQuestion = async (docId, question) => {
  const response = await api.post('/qa', {
    doc_id: docId,
    question: question,
  });
  return response.data;
};

export const getQaHistory = async (docId) => {
  const response = await api.get(`/qa/history/${docId}`);
  return response.data.history || [];
};

export const saveQuizScore = async (docId, score, totalQuestions, quizData) => {
  const response = await api.post('/scores', {
    doc_id: docId,
    score: score,
    total_questions: totalQuestions,
    quiz_data: quizData ? JSON.stringify(quizData) : null
  });
  return response.data;
};

export const getQuizScores = async () => {
  const response = await api.get('/scores');
  return response.data.scores || [];
};

export const getUserProfile = async () => {
  const response = await api.get('/users/me');
  return response.data;
};

export const updateUserProfile = async (name, email) => {
  const response = await api.put('/users/me', { name, email });
  return response.data;
};

export const changePassword = async (currentPassword, newPassword) => {
  const response = await api.put('/users/password', {
    current_password: currentPassword,
    new_password: newPassword
  });
  return response.data;
};

export default api;
