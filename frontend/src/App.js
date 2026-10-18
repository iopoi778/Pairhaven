import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import ProfileScreen from './pages/ProfileScreen';
import MatchingScreen from './pages/MatchingScreen';
import ChatScreen from './pages/chat';

const API_URL = process.env.REACT_APP_API_URL || 'https://pairhaven.onrender.com';

const ProtectedRoute = ({ children }) => {
  const token = localStorage.getItem('token');
  return token ? children : <Navigate to="/login" replace />;
};

function App() {
  return (
    <Router>
      <div style={{ fontFamily: 'Arial, sans-serif', minHeight: '100vh', background: '#f2f2f2' }}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <DashboardLayout />
              </ProtectedRoute>
            }
          />
        </Routes>
      </div>
    </Router>
  );
}

function DashboardLayout() {
  const [activeTab, setActiveTab] = useState('home');
  const navigate = useNavigate();

  const renderContent = () => {
    switch (activeTab) {
      case 'home':
        return <HomeFeed />;
      case 'matching':
        return <MatchingScreen />;
      case 'messages':
        return <ChatScreen />;
      case 'notifications':
        return <NotificationsScreen />;
      case 'profile':
        return <ProfileScreen />;
      default:
        return <HomeFeed />;
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/login', { replace: true });
  };

  return (
    <div style={{ maxWidth: '600px', margin: '0 auto', background: '#f8f8f8', minHeight: '100vh', boxShadow: '0 0 18px rgba(0,0,0,0.08)' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem 1.2rem', borderBottom: '1px solid #dfe3ea', background: '#fff', boxSizing: 'border-box' }}>
        <h2 style={{ margin: 0, color: '#5b72f2', fontWeight: 700 }}>PairHaven</h2>
        <button
          onClick={handleLogout}
          style={{ background: 'none', border: 'none', color: '#5b72f2', cursor: 'pointer', fontSize: '1rem' }}
        >
          Logout
        </button>
      </header>

      <main style={{ padding: '1rem', minHeight: 'calc(100vh - 120px)', background: '#f6f6f6' }}>
        {renderContent()}
      </main>

      <nav style={{ display: 'flex', justifyContent: 'space-around', alignItems: 'center', padding: '0.8rem 0', borderTop: '1px solid #dfe3ea', background: '#fff', height: '78px' }}>
        {[
          { id: 'home', label: 'Home', icon: '🏠' },
          { id: 'matching', label: 'Match', icon: '💖' },
          { id: 'messages', label: 'Chat', icon: '💬' },
          { id: 'notifications', label: 'Alerts', icon: '🔔' },
          { id: 'profile', label: 'Profile', icon: '👤' }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              border: activeTab === tab.id ? '1px solid #5b72f2' : '1px solid transparent',
              background: activeTab === tab.id ? '#eef2ff' : 'transparent',
              borderRadius: '10px',
              padding: '0.5rem 0.8rem',
              minWidth: '70px',
              textAlign: 'center',
              color: activeTab === tab.id ? '#5b72f2' : '#666',
              cursor: 'pointer'
            }}
          >
            <div style={{ fontSize: '1.3rem' }}>{tab.icon}</div>
            <div style={{ fontSize: '0.72rem', marginTop: '0.15rem' }}>{tab.label}</div>
          </button>
        ))}
      </nav>
    </div>
  );
}

function HomeFeed() {
  return (
    <div style={{ textAlign: 'center', paddingTop: '3rem' }}>
      <h2 style={{ marginBottom: '1rem' }}>Your Feed</h2>
      <p style={{ fontSize: '1.05rem', color: '#555' }}>Posts from people you follow will appear here.</p>

      <div style={{ marginTop: '2rem', background: '#fff', borderRadius: '12px', padding: '1.2rem', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
        <h3 style={{ margin: 0, marginBottom: '0.7rem' }}>Sample Post</h3>
        <p style={{ margin: 0 }}>Hello world! This is a sample feed item.</p>
      </div>
    </div>
  );
}

function NotificationsScreen() {
  return (
    <div style={{ textAlign: 'center', paddingTop: '3rem' }}>
      <h2 style={{ marginBottom: '1rem' }}>Notifications</h2>
      <p style={{ fontSize: '1.05rem', color: '#555' }}>You have no new notifications.</p>
    </div>
  );
}

// Auth screens
function LoginPage() {
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();

    const email = e.target.email.value;
    const password = e.target.password.value;

    try {
      const res = await fetch(`${API_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });

      const data = await res.json();

      if (!res.ok) {
        alert(data.message || 'Login failed');
        return;
      }

      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      navigate('/', { replace: true });
    } catch (err) {
      console.error(err);
      alert('Server error. Please try again later.');
    }
  };

  return (
    <div style={{ maxWidth: 400, margin: '2rem auto', background: '#fff', padding: '2rem', borderRadius: '12px', boxShadow: '0 2px 10px rgba(0,0,0,0.08)' }}>
      <h2 style={{ textAlign: 'center', color: '#5b72f2' }}>Welcome Back</h2>
      <form onSubmit={handleSubmit}>
        <input name="email" type="email" placeholder="Email" required style={inputStyle} />
        <input name="password" type="password" placeholder="Password" required style={inputStyle} />
        <button type="submit" style={primaryButtonStyle}>Log In</button>
      </form>
      <p style={{ textAlign: 'center', marginTop: '1rem' }}>
        New here?{' '}
        <a href="/register" onClick={(e) => { e.preventDefault(); navigate('/register'); }} style={{ color: '#5b72f2' }}>
          Create Account
        </a>
      </p>
    </div>
  );
}

function RegisterPage() {
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();

    const formData = new FormData(e.target);

    try {
      const res = await fetch(`${API_URL}/api/auth/register`, {
        method: 'POST',
        body: formData
      });

      const data = await res.json();

      if (!res.ok) {
        alert(data.message || 'Registration failed');
        return;
      }

      alert('Registered! Please log in.');
      navigate('/login', { replace: true });
    } catch (err) {
      console.error(err);
      alert('Server error. Please try again later.');
    }
  };

  return (
    <div style={{ maxWidth: 420, margin: '2rem auto', background: '#fff', padding: '2rem', borderRadius: '12px', boxShadow: '0 2px 10px rgba(0,0,0,0.08)' }}>
      <h2 style={{ textAlign: 'center', color: '#5b72f2' }}>Join PairHaven</h2>
      <form onSubmit={handleSubmit}>
        <input name="name" placeholder="Full Name" required style={inputStyle} />
        <input name="email" type="email" placeholder="Email" required style={inputStyle} />
        <input name="phone" placeholder="Phone" required style={inputStyle} />
        <input name="password" type="password" placeholder="Password" required style={inputStyle} />
        <div style={{ display: 'flex', gap: '1rem' }}>
          <input name="age" type="number" placeholder="Age" required style={{ ...inputStyle, flex: 1 }} />
          <select name="gender" required style={{ ...inputStyle, flex: 1 }}>
            <option value="">Gender</option>
            <option value="male">Male</option>
            <option value="female">Female</option>
            <option value="other">Other</option>
          </select>
        </div>
        <textarea name="bio" rows="3" placeholder="Bio" style={inputStyle} />
        <input name="photos" type="file" multiple accept="image/*" required style={{ marginBottom: '1rem', width: '100%' }} />
        <button type="submit" style={primaryButtonStyle}>Sign Up</button>
      </form>
      <p style={{ textAlign: 'center', marginTop: '1rem' }}>
        Already have an account?{' '}
        <a href="/login" onClick={(e) => { e.preventDefault(); navigate('/login'); }} style={{ color: '#5b72f2' }}>
          Log In
        </a>
      </p>
    </div>
  );
}

const inputStyle = {
  width: '100%',
  boxSizing: 'border-box',
  padding: '0.8rem',
  borderRadius: '8px',
  border: '1px solid #dfe3ea',
  marginBottom: '1rem',
  fontSize: '1rem'
};

const primaryButtonStyle = {
  width: '100%',
  padding: '0.9rem',
  border: 'none',
  borderRadius: '8px',
  background: '#5b72f2',
  color: '#fff',
  fontWeight: 700,
  cursor: 'pointer'
};

export default App;