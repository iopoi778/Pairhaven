import React, { useState, useEffect } from 'react';
import { HashRouter as Router, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import axios from 'axios';
import ProfileScreen from './pages/ProfileScreen';
import MatchingScreen from './pages/MatchingScreen';
import ChatScreen from './pages/chat';
import NotificationsScreen from './pages/NotificationsScreen';
import PostComposer from './components/PostComposer';

const API_URL = process.env.REACT_APP_API_URL || 'https://pairhaven.onrender.com';

const tokenAtStart = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
if (tokenAtStart) {
  axios.defaults.headers.common['Authorization'] = `Bearer ${tokenAtStart}`;
}

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
    delete axios.defaults.headers.common['Authorization'];
    navigate('/login', { replace: true });
  };

  return (
    <div style={{ maxWidth: '600px', margin: '0 auto', background: '#f8f8f8', minHeight: '100vh', boxShadow: '0 0 18px rgba(0,0,0,0.08)' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem 1.2rem', borderBottom: '1px solid #dfe3ea', background: '#fff', boxSizing: 'border-box' }}>
        <h2 style={{ margin: 0, color: '#5b72f2', fontWeight: 700 }}>PairHaven</h2>
        <button onClick={handleLogout} style={{ background: 'none', border: 'none', color: '#5b72f2', cursor: 'pointer', fontSize: '1rem' }}>
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
  const [posts, setPosts] = useState([]);

  useEffect(() => {
    const fetchPosts = async () => {
      const token = localStorage.getItem('token');
      if (!token) return;
      try {
        const res = await axios.get(`${API_URL}/api/posts`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setPosts(res.data || []);
      } catch (err) {
        console.warn('Failed to load feed posts', err);
      }
    };
    fetchPosts();
  }, []);

  const handleNewPost = (newPost) => {
    setPosts(prev => [newPost, ...prev]);
  };

  return (
    <div style={{ padding: '0.5rem 0 3rem' }}>
      <h2 style={{ margin: '0 0 1rem' }}>Your Feed</h2>
      <PostComposer onPosted={handleNewPost} />
      {posts.length === 0 ? (
        <div style={{ background: '#fff', borderRadius: '12px', padding: '1.2rem', textAlign: 'center', color: '#666' }}>
          No posts yet.
        </div>
      ) : (
        posts.map(post => (
          <div key={post._id} style={{ background: '#fff', borderRadius: '12px', marginTop: '1rem', padding: '1rem', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
              <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#5b72f2', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>
                {(post.author?.name || 'U').charAt(0).toUpperCase()}
              </div>
              <div>
                <div style={{ fontWeight: 700 }}>{post.author?.name || 'User'}</div>
                <div style={{ fontSize: 12, color: '#666' }}>{new Date(post.createdAt).toLocaleString()}</div>
              </div>
            </div>

            {post.text ? <div style={{ marginBottom: 8 }}>{post.text}</div> : null}

            {post.mediaType === 'video' && post.mediaUrl ? (
              <video src={post.mediaUrl} controls style={{ width: '100%', maxHeight: 420, borderRadius: 10, background: '#000' }} />
            ) : post.mediaUrl ? (
              <img src={post.mediaUrl} alt="" style={{ width: '100%', borderRadius: 10 }} />
            ) : null}
          </div>
        ))
      )}
    </div>
  );
}
// BEFORE (Blocks registration if GPS fails)
const pos = await new Promise((resolve, reject) => {
  navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 8000 });
});
formData.append('location', JSON.stringify({ type: 'Point', coordinates: [pos.coords.longitude, pos.coords.latitude] }));

// AFTER (Continues even if GPS fails)
try {
  const pos = await new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(resolve, reject, { 
      enableHighAccuracy: false, // Less strict
      timeout: 5000,             // Shorter timeout
      maximumAge: 0 
    });
  });
  formData.append('location', JSON.stringify({ 
    type: 'Point', 
    coordinates: [pos.coords.longitude, pos.coords.latitude] 
  }));
} catch (geoErr) {
  console.warn('Location skipped:', geoErr.message);
  // DO NOT throw error - allow registration without location
  // Optionally append a default location or null
  formData.append('location', JSON.stringify({ 
    type: 'Point', 
    coordinates: [0, 0] // Default fallback
  }));
}
// Login screen
function LoginPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

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
      axios.defaults.headers.common['Authorization'] = `Bearer ${data.token}`;
      navigate('/', { replace: true });
    } catch (err) {
      console.error(err);
      alert('Server error. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: 400, margin: '2rem auto', background: '#fff', padding: '2rem', borderRadius: '12px', boxShadow: '0 2px 10px rgba(0,0,0,0.08)' }}>
      <h2 style={{ textAlign: 'center', color: '#5b72f2' }}>Welcome Back</h2>
      <form onSubmit={handleSubmit}>
        <input name="email" type="email" placeholder="Email" required autoComplete="email" style={inputStyle} />
        <input name="password" type="password" placeholder="Password" required autoComplete="current-password" style={inputStyle} />
        <button type="submit" style={{ ...primaryButtonStyle, opacity: loading ? 0.7 : 1 }} disabled={loading}>
          {loading ? 'Logging in...' : 'Log In'}
        </button>
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

// Register screen
function RegisterPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    const formData = new FormData(e.target);

    // REPLACE LINES 207-220 IN YOUR CURRENT FILE WITH THIS:
try {
  if (navigator.geolocation) {
    const pos = await new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(resolve, reject, { 
        enableHighAccuracy: false, // Less strict for faster response
        timeout: 5000,             // Shorter timeout prevents hanging
        maximumAge: 0 
      });
    });
    formData.append('location', JSON.stringify({ 
      type: 'Point', 
      coordinates: [pos.coords.longitude, pos.coords.latitude] 
    }));
  } else {
    throw new Error('Geolocation not supported');
  }
} catch (geoErr) {
  console.warn('Location skipped:', geoErr.message);
  // CRITICAL: Always append a fallback so backend doesn't reject
  formData.append('location', JSON.stringify({ 
    type: 'Point', 
    coordinates: [0, 0] 
  }));
}

      const res = await fetch(`${API_URL}/api/auth/register`, {
        method: 'POST',
        body: formData
      });

      const data = await res.json();

      if (!res.ok) {
        alert(data.message || 'Registration failed');
        return;
      }

      try {
        const loginRes = await fetch(`${API_URL}/api/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: formData.get('email'),
            password: formData.get('password')
          })
        });

        const loginData = await loginRes.json();

        if (loginRes.ok) {
          localStorage.setItem('token', loginData.token);
          localStorage.setItem('user', JSON.stringify(loginData.user));
          axios.defaults.headers.common['Authorization'] = `Bearer ${loginData.token}`;
          navigate('/', { replace: true });
          return;
        }
      } catch (loginErr) {
        console.warn('Auto-login failed', loginErr);
      }

      alert('Registered! Please log in.');
      navigate('/login', { replace: true });
    } catch (err) {
      console.error(err);
      alert('Server error. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: 420, margin: '2rem auto', background: '#fff', padding: '2rem', borderRadius: '12px', boxShadow: '0 2px 10px rgba(0,0,0,0.08)' }}>
      <h2 style={{ textAlign: 'center', color: '#5b72f2' }}>Join PairHaven</h2>
      <form onSubmit={handleSubmit}>
        <input name="name" placeholder="Full Name" required autoComplete="name" style={inputStyle} />
        <input name="email" type="email" placeholder="Email" required autoComplete="email" style={inputStyle} />
        <input name="phone" placeholder="Phone" required autoComplete="tel" style={inputStyle} />
        <input name="password" type="password" placeholder="Password" required autoComplete="new-password" style={inputStyle} />
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
        <button type="submit" style={{ ...primaryButtonStyle, opacity: loading ? 0.7 : 1 }} disabled={loading}>
          {loading ? 'Signing up...' : 'Sign Up'}
        </button>
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
