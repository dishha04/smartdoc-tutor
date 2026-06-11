import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getDocuments, getQuizScores } from '../services/api';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { FileText, Brain, TrendingUp, Clock, Play } from 'lucide-react';
import './Dashboard.css';

function Dashboard() {
  const navigate = useNavigate();
  const [userName, setUserName] = useState('');
  const [greeting, setGreeting] = useState('');
  const [stats, setStats] = useState({ docs: 0, quizzes: 0, avgScore: 0 });
  const [recentDoc, setRecentDoc] = useState(null);
  const [activity, setActivity] = useState([]);
  const [chartData, setChartData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 1. Get user name from JWT
    const token = localStorage.getItem('token');
    if (token) {
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        if (payload.sub) {
          const emailPrefix = payload.sub.split('@')[0];
          // Capitalize first letter
          setUserName(emailPrefix.charAt(0).toUpperCase() + emailPrefix.slice(1));
        }
      } catch (e) {
        console.error("Failed to parse token", e);
      }
    }

    // 2. Set greeting based on time
    const hour = new Date().getHours();
    if (hour < 12) setGreeting('Good morning');
    else if (hour < 18) setGreeting('Good afternoon');
    else setGreeting('Good evening');

    // 3. Load data
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    setLoading(true);
    try {
      const docs = await getDocuments() || [];
      const scores = await getQuizScores() || [];

      // Calculate stats
      const avgScore = scores.length > 0 
        ? Math.round(scores.reduce((acc, curr) => acc + (curr.score / curr.total_questions), 0) / scores.length * 100)
        : 0;

      setStats({
        docs: docs.length,
        quizzes: scores.length,
        avgScore: avgScore
      });

      // Continue Learning (most recent doc)
      if (docs.length > 0) {
        const sortedDocs = [...docs].sort((a, b) => new Date(b.upload_date) - new Date(a.upload_date));
        setRecentDoc(sortedDocs[0]);
      }

      // Recent Activity Feed
      const activities = [];
      docs.forEach(doc => {
        activities.push({
          id: `doc-${doc.doc_id}`,
          type: 'upload',
          title: `Uploaded ${doc.filename}`,
          timestamp: new Date(doc.upload_date)
        });
      });
      scores.forEach((score, idx) => {
        activities.push({
          id: `score-${idx}`,
          type: 'quiz',
          title: `Scored ${score.score}/${score.total_questions} on quiz`,
          timestamp: new Date(score.timestamp)
        });
      });
      // Sort unified feed
      activities.sort((a, b) => b.timestamp - a.timestamp);
      setActivity(activities.slice(0, 5)); // top 5

      // Chart Data
      if (scores.length > 0) {
        // Reverse to show chronological order (oldest to newest)
        const sortedScores = [...scores].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
        const chart = sortedScores.map((s, i) => ({
          name: `Quiz ${i+1}`,
          score: Math.round((s.score / s.total_questions) * 100)
        }));
        setChartData(chart);
      }

    } catch (err) {
      console.error("Failed to load dashboard data", err);
    } finally {
      setLoading(false);
    }
  };

  const formatTimeAgo = (date) => {
    const seconds = Math.floor((new Date() - date) / 1000);
    let interval = seconds / 31536000;
    if (interval > 1) return Math.floor(interval) + " years ago";
    interval = seconds / 2592000;
    if (interval > 1) return Math.floor(interval) + " months ago";
    interval = seconds / 86400;
    if (interval > 1) {
      const days = Math.floor(interval);
      return days === 1 ? "yesterday" : days + " days ago";
    }
    interval = seconds / 3600;
    if (interval > 1) return Math.floor(interval) + " hrs ago";
    interval = seconds / 60;
    if (interval > 1) return Math.floor(interval) + " mins ago";
    return "just now";
  };

  if (loading) {
    return <div className="loading-page"><div className="spinner"></div></div>;
  }

  return (
    <div className="dashboard-page">
      <div className="dashboard-container">
        
        {/* Header Section */}
        <header className="dashboard-header">
          <h1>{greeting}, {userName || 'there'}</h1>
          <p>Here's a summary of your learning activity.</p>
        </header>

        {/* Stats Row */}
        <div className="stats-row">
          <div className="stat-card">
            <div className="stat-icon docs"><FileText size={24} /></div>
            <div className="stat-details">
              <h3>{stats.docs}</h3>
              <p>Total Documents</p>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon quizzes"><Brain size={24} /></div>
            <div className="stat-details">
              <h3>{stats.quizzes}</h3>
              <p>Quizzes Taken</p>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon score"><TrendingUp size={24} /></div>
            <div className="stat-details">
              <h3>{stats.avgScore}%</h3>
              <p>Average Score</p>
            </div>
          </div>
        </div>

        <div className="dashboard-grid">
          
          {/* Main Column */}
          <div className="main-column">
            
            {/* Continue Learning */}
            <section className="dashboard-section">
              <h2 className="section-title">Continue Learning</h2>
              {recentDoc ? (
                <div className="continue-card card">
                  <div className="continue-info">
                    <FileText size={32} color="var(--primary)" />
                    <div>
                      <h3>{recentDoc.filename}</h3>
                      <p>Last opened {formatTimeAgo(new Date(recentDoc.upload_date))}</p>
                    </div>
                  </div>
                  <button 
                    className="btn btn-primary"
                    onClick={() => navigate(`/analyze/${recentDoc.doc_id}`)}
                  >
                    <Play size={16} style={{marginRight: '8px'}} /> Resume
                  </button>
                </div>
              ) : (
                <div className="card empty-state" style={{padding: '2rem'}}>
                  <p>Upload a document to start learning!</p>
                  <button className="btn btn-secondary" style={{marginTop:'1rem'}} onClick={() => navigate('/documents')}>Go to Documents</button>
                </div>
              )}
            </section>

            {/* Chart */}
            <section className="dashboard-section">
              <h2 className="section-title">Your Progress</h2>
              <div className="chart-card card">
                {chartData.length > 0 ? (
                  <div style={{ width: '100%', height: 300 }}>
                    <ResponsiveContainer>
                      <LineChart data={chartData} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eee" />
                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: 'var(--text-light)'}} />
                        <YAxis domain={[0, 100]} axisLine={false} tickLine={false} tick={{fill: 'var(--text-light)'}} />
                        <Tooltip 
                          contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)'}}
                          formatter={(value) => [`${value}%`, 'Score']}
                        />
                        <Line type="monotone" dataKey="score" stroke="var(--primary)" strokeWidth={3} dot={{r: 4, fill: 'var(--primary)', strokeWidth: 2}} activeDot={{r: 6}} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="empty-state" style={{padding: '3rem 1rem'}}>
                    <p>Take some quizzes to see your progress chart!</p>
                  </div>
                )}
              </div>
            </section>
          </div>

          {/* Sidebar Column */}
          <div className="sidebar-column">
            <section className="dashboard-section">
              <h2 className="section-title">Recent Activity</h2>
              <div className="activity-card card">
                {activity.length > 0 ? (
                  <ul className="activity-list">
                    {activity.map((item) => (
                      <li key={item.id} className="activity-item">
                        <div className={`activity-bullet ${item.type}`}></div>
                        <div className="activity-content">
                          <p className="activity-text">{item.title}</p>
                          <span className="activity-time"><Clock size={12} /> {formatTimeAgo(item.timestamp)}</span>
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p style={{color: 'var(--text-light)', textAlign: 'center'}}>No recent activity.</p>
                )}
              </div>
            </section>
          </div>

        </div>
      </div>
    </div>
  );
}

export default Dashboard;
