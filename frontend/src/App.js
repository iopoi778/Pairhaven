import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate, Link } from 'react-router-dom';

// --- Protected Route Wrapper ---
const ProtectedRoute = ({ children }) => {
  const token = localStorage.getItem('token');
  return token ? children : <Navigate to="/login" replace />;
};

// --- Main App Component ---
function App() {
  return (
    <Router>
      <div style={{ fontFamily: 'Arial, sans-serif', minHeight: '100vh', background: '#f5f5f5' }}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          
          {/* Protected Dashboard Routes */}
          <Route path="/" element={
            <ProtectedRoute>
              <DashboardLayout />
            </ProtectedRoute>
          } />
        </Routes>
      </div>
    </Router>
  );
}

// --- Dashboard Layout with Navigation ---
function DashboardLayout() {
  const [activeTab, setActiveTab] = useState('home');
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem('user') || '{}');

  const handleLogout = () => {
    localStorage.clear();
    navigate('/login', { replace: true });
  };

  // Render content based on active tab
  const renderContent = () => {
    switch(activeTab) {
      case 'home': return <HomeFeed userId={user._id} />;
      case 'matching': return <MatchingScreen userId={user._id} />;
      case 'messages': return <MessagesScreen userId={user._id} />;
      case 'notifications': return <NotificationsScreen />;
      case 'profile': return <ProfileScreen user={user} />;
      default: return <HomeFeed userId={user._id} />;
    }
  };

  return (
    <div style={{ maxWidth: '600px', margin: '0 auto', background: 'white', minHeight: '100vh', boxShadow: '0 0 20px rgba(0,0,0,0.1)', position: 'relative' }}>
      {/* Header */}
      <header style={{ padding: '1rem', borderBottom: '1px solid #eee', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ margin: 0, color: '#667eea' }}>PairHaven</h2>
        <button onClick={handleLogout} style={{ background: 'none', border: 'none', color: '#666', cursor: 'pointer' }}>Logout</button>
      </header>

      {/* Main Content Area - Added paddingBottom to prevent overlap with nav */}
      <main style={{ padding: '1rem', paddingBottom: '88px' }}>
        {renderContent()}
      </main>

      {/* Bottom Navigation Bar - Added zIndex and height */}
      <nav style={{ 
        position: 'fixed', 
        bottom: 0, 
        left: '50%', 
        transform: 'translateX(-50%)', 
        width: '100%', 
        maxWidth: '600px', 
        background: 'white', 
        borderTop: '1px solid #eee', 
        display: 'flex', 
        justifyContent: 'space-around', 
        padding: '0.8rem 0',
        zIndex: 1000,
        height: '72px'
      }}>
        {[
          { id: 'home', icon: '', label: 'Home' },
          { id: 'matching', icon: '❤️', label: 'Match' },
          { id: 'messages', icon: '💬', label: 'Chat' },
          { id: 'notifications', icon: '🔔', label: 'Alerts' },
          { id: 'profile', icon: '', label: 'Profile' }
        ].map(tab => (
          <button 
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            style={{ 
              background: 'none', 
              border: 'none', 
              display: 'flex', 
              flexDirection: 'column', 
              alignItems: 'center', 
              color: activeTab === tab.id ? '#667eea' : '#999',
              fontSize: '0.75rem',
              cursor: 'pointer'
            }}
          >
            <span style={{ fontSize: '1.3rem' }}>{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </nav>
    </div>
  );
}

// --- Page Components (Placeholders) ---
function HomeFeed({ userId }) {
  return (
    <div style={{ textAlign: 'center', padding: '2rem' }}>
      <h3>Your Feed</h3>
      <p>Posts from people you follow will appear here.</p>
    </div>
  );
}

function MatchingScreen({ userId }) {
  return (
    <div style={{ textAlign: 'center', padding: '2rem' }}>
      <h3>Find Matches</h3>
      <p>No more profiles to show right now.</p>
    </div>
  );
}

function MessagesScreen({ userId }) {
  return (
    <div style={{ textAlign: 'center', padding: '2rem' }}>
      <h3>Messages</h3>
      <p>Select a match to start chatting.</p>
    </div>
  );
}

function NotificationsScreen() {
  return (
    <div style={{ textAlign: 'center', padding: '2rem' }}>
      <h3>Notifications</h3>
      <p>You have no new notifications.</p>
    </div>
  );
}

function ProfileScreen({ user }) {
  return (
    <div style={{ textAlign: 'center', padding: '2rem' }}>
      <div style={{ width: '100px', height: '100px', borderRadius: '50%', background: '#667eea', margin: '0 auto 1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: '2rem' }}>
        {user?.name?.charAt(0) || 'U'}
      </div>
      <h3>{user?.name || 'User'}</h3>
      <p>{user?.bio || 'No bio yet.'}</p>
    </div>
  );
}

// --- Auth Pages with React Router Navigation ---
function LoginPage() {
  const navigate = useNavigate();
  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch('https://pairhaven.onrender.com/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: e.target.email.value,
          password: e.target.password.value
        })
      });
      const data = await res.json();
      if (res.ok) {
        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));
        navigate('/', { replace: true });
      } else {
        alert(data.message || 'Login failed');
      }
    } catch (err) {
      alert('Server error. Please try again later.');
    }
  };
  return (
    <div style={{ maxWidth: '400px', margin: '2rem auto', padding: '2rem', background: 'white', borderRadius: '16px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
      <h2 style={{ textAlign: 'center', color: '#667eea' }}>Welcome Back</h2>
      <form onSubmit={handleSubmit}>
        <input name="email" type="email" placeholder="Email" required style={{ width: '100%', padding: '0.8rem', marginBottom: '1rem', borderRadius: '8px', border: '1px solid #ddd', boxSizing: 'border-box' }} />
        <input name="password" type="password" placeholder="Password" required style={{ width: '100%', padding: '0.8rem', marginBottom: '1rem', borderRadius: '8px', border: '1px solid #ddd', boxSizing: 'border-box' }} />
        <button type="submit" style={{ width: '100%', padding: '0.8rem', background: '#667eea', color: 'white', border: 'none', borderRadius: '8px', fontSize: '1rem', cursor: 'pointer' }}>Log In</button>
      </form>
      <p style={{ textAlign: 'center', marginTop: '1rem' }}>
        New here?{' '}
        <a href="/register" onClick={(e) => { e.preventDefault(); navigate('/register'); }} style={{ color: '#667eea' }}>
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
    try {
      const formData = new FormData(e.target);
      const res = await fetch('https://pairhaven.onrender.com/api/auth/register', {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      if (res.ok) {
        alert('Registered! Please log in.');
        navigate('/login', { replace: true });
      } else {
        alert(data.message || 'Registration failed');
      }
    } catch (err) {
      alert('Server error. Please try again later.');
    }
  };
  return (
    <div style={{ maxWidth: '400px', margin: '2rem auto', padding: '2rem', background: 'white', borderRadius: '16px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
      <h2 style={{ textAlign: 'center', color: '#667eea' }}>Join PairHaven</h2>
      <form onSubmit={handleSubmit}>
        <input name="name" placeholder="Full Name" required style={{ width: '100%', padding: '0.8rem', marginBottom: '1rem', borderRadius: '8px', border: '1px solid #ddd', boxSizing: 'border-box' }} />
        <input name="email" type="email" placeholder="Email" required style={{ width: '100%', padding: '0.8rem', marginBottom: '1rem', borderRadius: '8px', border: '1px solid #ddd', boxSizing: 'border-box' }} />
        <input name="phone" placeholder="Phone" required style={{ width: '100%', padding: '0.8rem', marginBottom: '1rem', borderRadius: '8px', border: '1px solid #ddd', boxSizing: 'border-box' }} />
        <input name="password" type="password" placeholder="Password" required style={{ width: '100%', padding: '0.8rem', marginBottom: '1rem', borderRadius: '8px', border: '1px solid #ddd', boxSizing: 'border-box' }} />
        <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
          <input name="age" type="number" placeholder="Age" required style={{ flex: 1, padding: '0.8rem', borderRadius: '8px', border: '1px solid #ddd' }} />
          <select name="gender" required style={{ flex: 1, padding: '0.8rem', borderRadius: '8px', border: '1px solid #ddd' }}>
            <option value="">Gender</option>
            <option value="male">Male</option>
            <option value="female">Female</option>
            <option value="other">Other</option>
          </select>
        </div>
        <textarea name="bio" placeholder="Bio" rows="3" style={{ width: '100%', padding: '0.8rem', marginBottom: '1rem', borderRadius: '8px', border: '1px solid #ddd', boxSizing: 'border-box' }} />
        <input name="photos" type="file" multiple accept="image/*" required style={{ width: '100%', marginBottom: '1rem' }} />
        <button type="submit" style={{ width: '100%', padding: '0.8rem', background: '#667eea', color: 'white', border: 'none', borderRadius: '8px', fontSize: '1rem', cursor: 'pointer' }}>Sign Up</button>
      </form>
      <p style={{ textAlign: 'center', marginTop: '1rem' }}>
        Already have an account?{' '}
        <a href="/login" onClick={(e) => { e.preventDefault(); navigate('/login'); }} style={{ color: '#667eea' }}>
          Log In
        </a>
      </p>
    </div>
  );
}

export default App;