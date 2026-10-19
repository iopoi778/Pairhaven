import React, { useState, useEffect } from 'react';
import { HashRouter as Router, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import axios from 'axios';
import ProfileScreen from './pages/ProfileScreen';
import MatchingScreen from './pages/MatchingScreen';
import ChatScreen from './pages/chat';
import NotificationsScreen from './pages/NotificationsScreen';
// PostComposer import kept for safety, but component removed from UI

const API_URL = process.env.REACT_APP_API_URL || 'https://pairhaven.onrender.com';

const tokenAtStart = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
if (tokenAtStart) {
  axios.defaults.headers.common['Authorization'] = `Bearer ${tokenAtStart}`;
}

const ProtectedRoute = ({ children }) => {
  const token = localStorage.getItem('token');
  return token ? children : <Navigate to="/login" replace />;
};

function ProfileRouteWrapper({ onUpdateCounts }) {
  const navigate = useNavigate();
  const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
  
  const hashPath = window.location.hash.replace('#', '') || '/';
  const parts = hashPath.split('/').filter(Boolean);
  
  useEffect(() => {
    if (parts[0] === 'profile' && parts[1] && parts[1] !== currentUser._id) {
      if (onUpdateCounts) onUpdateCounts();
    }
  }, [hashPath]); 

  if (parts[0] === 'profile' && !parts[1]) return <Navigate to="/" replace />;
  if (parts[0] !== 'profile') return <Navigate to="/" replace />;

  const userId = parts[1];
  if (userId === currentUser._id) return <Navigate to="/" replace />;

  return (
    <DashboardLayout 
      activeTabOverride="profile" 
      showBackButton={true}
      onBack={() => navigate(-1)}
    >
      <ProfileScreen userId={userId} />
    </DashboardLayout>
  );
}

function App() {
  const [navCounts, setNavCounts] = useState({ chat: 0, alerts: 0 });

  const fetchNavCounts = async () => {
    const token = localStorage.getItem('token');
    if (!token) return;
    try {
      const msgRes = await axios.get(`${API_URL}/api/messages/conversations`, { headers: { Authorization: `Bearer ${token}` } });
      const totalUnreadMsgs = (msgRes.data || []).reduce((sum, c) => sum + (c.unreadCount || 0), 0);
      const notifRes = await axios.get(`${API_URL}/api/notifications`, { headers: { Authorization: `Bearer ${token}` } });
      const unreadNotifs = (notifRes.data || []).filter(n => !n.read).length;
      setNavCounts({ chat: totalUnreadMsgs, alerts: unreadNotifs });
    } catch (err) { console.error("Failed to fetch nav counts", err); }
  };

  useEffect(() => {
    fetchNavCounts();
    const interval = setInterval(fetchNavCounts, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <Router>
      <div style={{ fontFamily: 'Arial, sans-serif', minHeight: '100vh', background: '#f2f2f2' }}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/profile/*" element={<ProtectedRoute><ProfileRouteWrapper onUpdateCounts={fetchNavCounts} /></ProtectedRoute>} />
          <Route path="/*" element={<ProtectedRoute><DashboardLayout navCounts={navCounts} onUpdateCounts={fetchNavCounts} /></ProtectedRoute>} />
        </Routes>
      </div>
    </Router>
  );
}

function DashboardLayout({ activeTabOverride, children, showBackButton, onBack, navCounts, onUpdateCounts }) {
  const [activeTab, setActiveTab] = useState('home');
  const currentTab = activeTabOverride || activeTab;

  useEffect(() => {
    if (onUpdateCounts) onUpdateCounts();
    const savedTab = localStorage.getItem('activeTab');
    if (savedTab) { setActiveTab(savedTab); localStorage.removeItem('activeTab'); }
  }, [currentTab]);

  useEffect(() => { if (activeTabOverride) setActiveTab(activeTabOverride); }, [activeTabOverride]);

  const renderContent = () => {
    if (children) return children;
    switch (currentTab) {
      case 'home': return <HomeFeed onNavigateToProfile={(id) => window.location.hash = `/profile/${id}`} />;
      case 'matching': return <MatchingScreen />;
      case 'messages': return <ChatScreen />;
      case 'notifications': return <NotificationsScreen />;
      case 'profile': return <ProfileScreen />;
      default: return <HomeFeed onNavigateToProfile={(id) => window.location.hash = `/profile/${id}`} />;
    }
  };

  const renderBadge = (count) => {
    if (!count || count <= 0) return null;
    return (
      <span style={{ position: 'absolute', top: '-5px', right: '-5px', background: '#e53e3e', color: '#fff', fontSize: '0.65rem', borderRadius: '50%', width: '16px', height: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>
        {count > 9 ? '9+' : count}
      </span>
    );
  };

  return (
    <div style={{ maxWidth: '600px', margin: '0 auto', background: '#f8f8f8', minHeight: '100vh', boxShadow: '0 0 18px rgba(0,0,0,0.08)' }}>
      {/* ✅ CLEAN HEADER */}
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem 1.2rem', borderBottom: '1px solid #dfe3ea', background: '#fff', boxSizing: 'border-box' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {showBackButton && (
            <button onClick={onBack} style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer', padding: 0 }}>←</button>
          )}
          <h2 style={{ margin: 0, color: '#5b72f2', fontWeight: 700 }}>PairHaven</h2>
        </div>
      </header>

      <main style={{ padding: '1rem', minHeight: 'calc(100vh - 120px)', background: '#f6f6f6' }}>
        {renderContent()}
      </main>

      {/* ✅ NAV BAR WITH ICONS & BADGES */}
      <nav style={{ display: 'flex', justifyContent: 'space-around', alignItems: 'center', padding: '0.8rem 0', borderTop: '1px solid #dfe3ea', background: '#fff', height: '78px', position: 'relative' }}>
        {[
          { id: 'home', label: 'Home', icon: '' },
          { id: 'matching', label: 'Match', icon: '' },
          { id: 'messages', label: 'Chat', icon: '💬', count: navCounts?.chat },
          { id: 'notifications', label: 'Alerts', icon: '', count: navCounts?.alerts },
          { id: 'profile', label: 'Profile', icon: '👤' }
        ].map(tab => (
          <button key={tab.id} onClick={() => { setActiveTab(tab.id); if (tab.id === 'profile') window.location.hash = '/'; }} style={{ border: currentTab === tab.id ? '1px solid #5b72f2' : '1px solid transparent', background: currentTab === tab.id ? '#eef2ff' : 'transparent', borderRadius: '10px', padding: '0.5rem 0.8rem', minWidth: '70px', textAlign: 'center', color: currentTab === tab.id ? '#5b72f2' : '#666', cursor: 'pointer', position: 'relative' }}>
            <div style={{ fontSize: '1.3rem' }}>{tab.icon}</div>
            <div style={{ fontSize: '0.72rem', marginTop: '0.15rem' }}>{tab.label}</div>
            {renderBadge(tab.count)}
          </button>
        ))}
      </nav>
    </div>
  );
}

function HomeFeed({ onNavigateToProfile }) {
  const [posts, setPosts] = useState([]);
  const token = localStorage.getItem('token');
  const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
  
  useEffect(() => {
    const fetchPosts = async () => {
      if (!token) return;
      try {
        const res = await axios.get(`${API_URL}/api/posts`, { headers: { Authorization: `Bearer ${token}` } });
        setPosts(res.data || []);
      } catch (err) { console.warn('Failed to load feed posts', err); }
    };
    fetchPosts();
  }, [token]);

  // ✅ REACTION HANDLER
  const handleReact = async (postId, type) => {
    try {
      const res = await axios.post(`${API_URL}/api/posts/${postId}/react`, 
        { type }, // 'like' or 'love'
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      // Update local state instantly
      setPosts(prev => prev.map(post => {
        if (post._id === postId) {
          return {
            ...post,
            likesCount: res.data.likesCount,
            lovesCount: res.data.lovesCount,
            userLiked: res.data.userLiked,
            userLoved: res.data.userLoved
          };
        }
        return post;
      }));
    } catch (err) {
      console.error("Reaction failed", err);
      // Fallback: Toggle locally if API fails
      setPosts(prev => prev.map(post => {
        if (post._id === postId) {
          if (type === 'like') return { ...post, userLiked: !post.userLiked, likesCount: post.userLiked ? post.likesCount - 1 : post.likesCount + 1 };
          if (type === 'love') return { ...post, userLoved: !post.userLoved, lovesCount: post.userLoved ? post.lovesCount - 1 : post.lovesCount + 1 };
        }
        return post;
      }));
    }
  };

  const getAvatarUrl = (author) => {
    if (!author) return 'https://via.placeholder.com/36';
    if (author.photos && Array.isArray(author.photos) && author.photos[0]) {
      return typeof author.photos[0] === 'string' ? author.photos[0] : author.photos[0].url;
    }
    return 'https://via.placeholder.com/36';
  };

  return (
    <div style={{ padding: '0.5rem 0 3rem' }}>
      <h2 style={{ margin: '0 0 1rem' }}>Your Feed</h2>
      
      {posts.length === 0 ? (
        <div style={{ background: '#fff', borderRadius: '12px', padding: '1.2rem', textAlign: 'center', color: '#666' }}>No posts yet.</div>
      ) : (
        posts.map(post => {
          const isVideo = post.mediaType === 'video' || (post.mediaUrl && post.mediaUrl.includes('/video/upload'));
          const avatarSrc = getAvatarUrl(post.author);
          
          // Safe defaults for counts
          const likes = post.likesCount || 0;
          const loves = post.lovesCount || 0;
          const hasLikes = likes > 0 || loves > 0;

          return (
            <div key={post._id} style={{ background: '#fff', borderRadius: '12px', marginTop: '1rem', padding: '1rem', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
              
              {/* Author Header */}
              <div onClick={() => onNavigateToProfile && onNavigateToProfile(post.author?._id)} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10, cursor: 'pointer' }}>
                <img src={avatarSrc} alt={post.author?.name} style={{ width: 36, height: 36, borderRadius: '50%', objectFit: 'cover', background: '#eee' }} onError={(e) => { e.target.src = 'https://via.placeholder.com/36'; }} />
                <div>
                  <div style={{ fontWeight: 700 }}>{post.author?.name || 'User'}</div>
                  <div style={{ fontSize: 12, color: '#666' }}>{new Date(post.createdAt).toLocaleString()}</div>
                </div>
              </div>

              {/* Content */}
              {post.text && <div style={{ marginBottom: 8, lineHeight: '1.4' }}>{post.text}</div>}
              {post.mediaUrl && (isVideo ? <video src={post.mediaUrl} controls style={{ width: '100%', maxHeight: 420, borderRadius: 10, background: '#000' }} /> : <img src={post.mediaUrl} alt="" style={{ width: '100%', borderRadius: 10 }} />)}

              {/* ✅ REACTION BAR */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginTop: '12px', paddingTop: '12px', borderTop: '1px solid #f5f5f5' }}>
                
                {/* LIKE BUTTON */}
                <button 
                  onClick={() => handleReact(post._id, 'like')}
                  style={{ 
                    background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                    display: 'flex', alignItems: 'center', gap: '6px',
                    color: post.userLiked ? '#e53e3e' : '#666',
                    transition: 'transform 0.2s'
                  }}
                >
                  <span style={{ fontSize: '1.4rem' }}>{post.userLiked ? '👍' : '🤍'}</span>
                  <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>{likes}</span>
                </button>

                {/* LOVE BUTTON */}
                <button 
                  onClick={() => handleReact(post._id, 'love')}
                  style={{ 
                    background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                    display: 'flex', alignItems: 'center', gap: '6px',
                    color: post.userLoved ? '#ff6b6b' : '#666',
                    transition: 'transform 0.2s'
                  }}
                >
                  <span style={{ fontSize: '1.4rem' }}>{post.userLoved ? '💖' : '👍'}</span>
                  <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>{loves}</span>
                </button>

              </div>
            </div>
          );
        })
      )}
    </div>
  );
}

function LoginPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: e.target.email.value, password: e.target.password.value }) });
      const data = await res.json();
      if (!res.ok) { alert(data.message || 'Login failed'); return; }
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      axios.defaults.headers.common['Authorization'] = `Bearer ${data.token}`;
      navigate('/', { replace: true });
    } catch (err) { console.error(err); alert('Server error.'); } finally { setLoading(false); }
  };
  return (
    <div style={{ maxWidth: 400, margin: '2rem auto', background: '#fff', padding: '2rem', borderRadius: '12px', boxShadow: '0 2px 10px rgba(0,0,0,0.08)' }}>
      <h2 style={{ textAlign: 'center', color: '#5b72f2' }}>Welcome Back</h2>
      <form onSubmit={handleSubmit}>
        <input name="email" type="email" placeholder="Email" required style={inputStyle} />
        <input name="password" type="password" placeholder="Password" required style={inputStyle} />
        <button type="submit" style={{ ...primaryButtonStyle, opacity: loading ? 0.7 : 1 }} disabled={loading}>{loading ? 'Logging in...' : 'Log In'}</button>
      </form>
      <p style={{ textAlign: 'center', marginTop: '1rem' }}>New here? <span onClick={() => navigate('/register')} style={{ color: '#5b72f2', cursor: 'pointer', textDecoration: 'underline' }}>Create Account</span></p>
    </div>
  );
}

function RegisterPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    const formData = new FormData(e.target);
    try {
      if (navigator.geolocation) {
        try {
          const pos = await new Promise((resolve, reject) => navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: false, timeout: 5000 }));
          formData.append('location', JSON.stringify({ type: 'Point', coordinates: [pos.coords.longitude, pos.coords.latitude] }));
        } catch (geoErr) { formData.append('location', JSON.stringify({ type: 'Point', coordinates: [0, 0] })); }
      }
      const res = await fetch(`${API_URL}/api/auth/register`, { method: 'POST', body: formData });
      const data = await res.json();
      if (!res.ok) { alert(data.message || 'Registration failed'); return; }
      try {
        const loginRes = await fetch(`${API_URL}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: formData.get('email'), password: formData.get('password') }) });
        const loginData = await loginRes.json();
        if (loginRes.ok) {
          localStorage.setItem('token', loginData.token);
          localStorage.setItem('user', JSON.stringify(loginData.user));
          axios.defaults.headers.common['Authorization'] = `Bearer ${loginData.token}`;
          navigate('/', { replace: true });
          return;
        }
      } catch (err) {}
      alert('Registered! Please log in.');
      navigate('/login', { replace: true });
    } catch (err) { alert('Server error.'); } finally { setLoading(false); }
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
          <select name="gender" required style={{ ...inputStyle, flex: 1 }}><option value="">Gender</option><option value="male">Male</option><option value="female">Female</option><option value="other">Other</option></select>
        </div>
        <textarea name="bio" rows="3" placeholder="Bio" style={inputStyle} />
        <input name="photos" type="file" multiple accept="image/*" required style={{ marginBottom: '1rem', width: '100%' }} />
        <button type="submit" style={{ ...primaryButtonStyle, opacity: loading ? 0.7 : 1 }} disabled={loading}>{loading ? 'Signing up...' : 'Sign Up'}</button>
      </form>
      <p style={{ textAlign: 'center', marginTop: '1rem' }}>Already have an account? <span onClick={() => navigate('/login')} style={{ color: '#5b72f2', cursor: 'pointer', textDecoration: 'underline' }}>Log In</span></p>
    </div>
  );
}

const inputStyle = { width: '100%', boxSizing: 'border-box', padding: '0.8rem', borderRadius: '8px', border: '1px solid #dfe3ea', marginBottom: '1rem', fontSize: '1rem' };
const primaryButtonStyle = { width: '100%', padding: '0.9rem', border: 'none', borderRadius: '8px', background: '#5b72f2', color: '#fff', fontWeight: 700, cursor: 'pointer' };

export default App;
