import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, Link, useNavigate } from 'react-router-dom';
import Home from './pages/Home';
import Documents from './pages/Documents';
import Dashboard from './pages/Dashboard';
import Profile from './pages/Profile';
import Analyze from './pages/Analyze';
import Login from './pages/Login';
import Signup from './pages/Signup';
import { isAuthenticated, logout } from './services/api';
import './App.css';

const ProtectedRoute = ({ children }) => {
  if (!isAuthenticated()) {
    return <Navigate to="/login" replace />;
  }
  return children;
};

const Navigation = () => {
  const navigate = useNavigate();
  const loggedIn = isAuthenticated();

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <nav className="navbar">
      <Link to="/" className="navbar-brand">
        SmartDoc<span>Tutor</span>
      </Link>
      <div className="navbar-links">
        {loggedIn ? (
          <>
            <Link to="/dashboard" className="nav-link">Dashboard</Link>
            <Link to="/documents" className="nav-link">Documents</Link>
            <Link to="/profile" className="nav-link">Profile</Link>
            <button onClick={handleLogout} className="btn btn-ghost" style={{ marginLeft: '0.5rem', fontSize: '0.875rem' }}>Sign out</button>
          </>
        ) : (
          <>
            <Link to="/login" className="nav-link">Sign in</Link>
            <Link to="/signup" className="btn btn-primary" style={{ textDecoration: 'none', marginLeft: '0.5rem' }}>Get started</Link>
          </>
        )}
      </div>
    </nav>
  );
};

function App() {
  return (
    <Router>
      <div className="App">
        <Navigation />
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/profile" element={
            <ProtectedRoute>
              <Profile />
            </ProtectedRoute>
          } />
          <Route path="/dashboard" element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          } />
          <Route path="/documents" element={
            <ProtectedRoute>
              <Documents />
            </ProtectedRoute>
          } />
          <Route path="/analyze/:docId" element={
            <ProtectedRoute>
              <Analyze />
            </ProtectedRoute>
          } />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
