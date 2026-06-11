import React from 'react';
import { useNavigate } from 'react-router-dom';
import { FileText, Brain, HelpCircle, CheckSquare } from 'lucide-react';
import './Home.css';

function Home() {
  const navigate = useNavigate();

  const features = [
    {
      icon: <FileText size={22} />,
      title: 'Smart Summarization',
      description: 'AI-powered summaries that extract key points from any document in seconds.',
    },
    {
      icon: <CheckSquare size={22} />,
      title: 'MCQ Generation',
      description: 'Automatically generate quiz questions to test and reinforce your understanding.',
    },
    {
      icon: <HelpCircle size={22} />,
      title: 'Q&A Assistant',
      description: 'Ask questions and get precise, context-aware answers from your documents.',
    },
    {
      icon: <Brain size={22} />,
      title: 'Progress Tracking',
      description: 'Monitor quiz scores over time and identify areas where you need to improve.',
    },
  ];

  return (
    <div className="home">
      {/* Hero */}
      <section className="hero">
        <div className="container">
          <div className="hero-eyebrow">AI-powered document learning</div>
          <h1 className="hero-title">
            Transform documents into<br />
            <span className="gradient-text">active knowledge</span>
          </h1>
          <p className="hero-subtitle">
            Upload any PDF and let SmartDoc Tutor generate summaries, create quizzes, and answer your questions — all powered by AI.
          </p>
          <div className="hero-actions">
            <button className="btn-hero btn-hero-primary" onClick={() => navigate('/signup')}>
              Get started free
            </button>
            <button className="btn-hero btn-hero-ghost" onClick={() => navigate('/login')}>
              Sign in
            </button>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="features">
        <div className="features-header">
          <p className="features-eyebrow">What you get</p>
          <h2>Everything you need to learn faster</h2>
          <p>A complete toolkit to process, understand, and retain knowledge from your documents.</p>
        </div>
        <div className="features-grid">
          {features.map((feature, index) => (
            <div key={index} className="feature-card">
              <div className="feature-icon-wrap">{feature.icon}</div>
              <h3 className="feature-title">{feature.title}</h3>
              <p className="feature-description">{feature.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="cta">
        <div className="container">
          <h2 className="cta-title">Ready to study smarter?</h2>
          <p className="cta-sub">Join thousands of students already using SmartDoc Tutor.</p>
          <button className="btn-hero btn-hero-primary" onClick={() => navigate('/signup')}>
            Create your free account
          </button>
        </div>
      </section>
    </div>
  );
}

export default Home;
