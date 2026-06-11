import React, { useState, useEffect } from 'react';
import { getUserProfile, updateUserProfile, changePassword, getDocuments, getQuizScores } from '../services/api';
import { User, Mail, Calendar, Key, FileText, Brain, TrendingUp } from 'lucide-react';
import './Profile.css';

function Profile() {
  const [profile, setProfile] = useState({ name: '', email: '', created_at: '' });
  const [stats, setStats] = useState({ docs: 0, quizzes: 0, avgScore: 0 });
  const [loading, setLoading] = useState(true);

  // Edit Mode States
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({ name: '', email: '' });
  const [updateMsg, setUpdateMsg] = useState('');

  // Password States
  const [passForm, setPassForm] = useState({ current: '', newPass: '', confirm: '' });
  const [passMsg, setPassMsg] = useState({ text: '', type: '' });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const user = await getUserProfile();
      setProfile({
        name: user.name || '',
        email: user.email || '',
        created_at: user.created_at || new Date().toISOString()
      });
      setEditForm({ name: user.name || '', email: user.email || '' });

      const docs = await getDocuments() || [];
      const scores = await getQuizScores() || [];

      const avgScore = scores.length > 0 
        ? Math.round(scores.reduce((acc, curr) => acc + (curr.score / curr.total_questions), 0) / scores.length * 100)
        : 0;

      setStats({
        docs: docs.length,
        quizzes: scores.length,
        avgScore: avgScore
      });
    } catch (err) {
      console.error("Failed to load profile data", err);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    setUpdateMsg('');
    try {
      await updateUserProfile(editForm.name, editForm.email);
      setProfile({ ...profile, name: editForm.name, email: editForm.email });
      setIsEditing(false);
      setUpdateMsg('Profile updated successfully!');
      setTimeout(() => setUpdateMsg(''), 3000);
    } catch (err) {
      setUpdateMsg(err.response?.data?.detail || 'Failed to update profile');
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setPassMsg({ text: '', type: '' });

    if (passForm.newPass !== passForm.confirm) {
      setPassMsg({ text: 'New passwords do not match', type: 'error' });
      return;
    }

    try {
      await changePassword(passForm.current, passForm.newPass);
      setPassMsg({ text: 'Password changed successfully!', type: 'success' });
      setPassForm({ current: '', newPass: '', confirm: '' });
    } catch (err) {
      setPassMsg({ text: err.response?.data?.detail || 'Failed to change password', type: 'error' });
    }
  };

  if (loading) return <div className="loading-page"><div className="spinner"></div></div>;

  const joinedDate = new Date(profile.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

  return (
    <div className="profile-page">
      <div className="profile-container">
        <h1 className="page-title">Profile Settings</h1>

        <div className="profile-grid">
          {/* Personal Information */}
          <div className="card profile-card">
            <h2 className="card-title">Personal Information</h2>
            
            {updateMsg && <div className={`alert ${updateMsg.includes('success') ? 'success' : 'error'}`}>{updateMsg}</div>}

            {isEditing ? (
              <form onSubmit={handleUpdateProfile} className="profile-form">
                <div className="form-group">
                  <label>Name</label>
                  <input type="text" value={editForm.name} onChange={e => setEditForm({...editForm, name: e.target.value})} placeholder="Your Name" />
                </div>
                <div className="form-group">
                  <label>Email</label>
                  <input type="email" value={editForm.email} onChange={e => setEditForm({...editForm, email: e.target.value})} required />
                </div>
                <div className="form-actions">
                  <button type="button" className="btn btn-secondary" onClick={() => {setIsEditing(false); setEditForm({name: profile.name, email: profile.email})}}>Cancel</button>
                  <button type="submit" className="btn btn-primary">Save Changes</button>
                </div>
              </form>
            ) : (
              <div className="profile-details">
                <div className="detail-item">
                  <User className="detail-icon" />
                  <div>
                    <label>Name</label>
                    <p>{profile.name || 'Not set'}</p>
                  </div>
                </div>
                <div className="detail-item">
                  <Mail className="detail-icon" />
                  <div>
                    <label>Email</label>
                    <p>{profile.email}</p>
                  </div>
                </div>
                <div className="detail-item">
                  <Calendar className="detail-icon" />
                  <div>
                    <label>Joined Date</label>
                    <p>{joinedDate}</p>
                  </div>
                </div>
                <button className="btn btn-primary-outline" style={{marginTop: '1rem'}} onClick={() => setIsEditing(true)}>Edit Profile</button>
              </div>
            )}
          </div>

          {/* Your Statistics */}
          <div className="card profile-card">
            <h2 className="card-title">Your Statistics</h2>
            <div className="stats-list">
              <div className="stat-row">
                <div className="stat-icon-wrap docs"><FileText size={20}/></div>
                <div className="stat-text">Total Documents</div>
                <div className="stat-value">{stats.docs}</div>
              </div>
              <div className="stat-row">
                <div className="stat-icon-wrap quizzes"><Brain size={20}/></div>
                <div className="stat-text">Quizzes Taken</div>
                <div className="stat-value">{stats.quizzes}</div>
              </div>
              <div className="stat-row">
                <div className="stat-icon-wrap score"><TrendingUp size={20}/></div>
                <div className="stat-text">Average Score</div>
                <div className="stat-value">{stats.avgScore}%</div>
              </div>
            </div>
          </div>

          {/* Change Password */}
          <div className="card profile-card">
            <h2 className="card-title">Security</h2>
            
            {passMsg.text && <div className={`alert ${passMsg.type}`}>{passMsg.text}</div>}

            <form onSubmit={handleChangePassword} className="profile-form">
              <div className="form-group">
                <label>Current Password</label>
                <div className="input-with-icon">
                  <Key size={18} className="input-icon" />
                  <input type="password" value={passForm.current} onChange={e => setPassForm({...passForm, current: e.target.value})} required />
                </div>
              </div>
              <div className="form-group">
                <label>New Password</label>
                <div className="input-with-icon">
                  <Key size={18} className="input-icon" />
                  <input type="password" value={passForm.newPass} onChange={e => setPassForm({...passForm, newPass: e.target.value})} required />
                </div>
              </div>
              <div className="form-group">
                <label>Confirm New Password</label>
                <div className="input-with-icon">
                  <Key size={18} className="input-icon" />
                  <input type="password" value={passForm.confirm} onChange={e => setPassForm({...passForm, confirm: e.target.value})} required />
                </div>
              </div>
              <button type="submit" className="btn btn-primary" style={{marginTop: '0.5rem'}}>Update Password</button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Profile;
