import React, { useState, useEffect } from 'react';
import { HashRouter as Router, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import axios from 'axios';
import ProfileScreen from './pages/ProfileScreen';
import MatchingScreen from './pages/MatchingScreen';
import ChatScreen from './pages/chat';
import NotificationsScreen from './pages/NotificationsScreen';

const API_URL = process.env.REACT_APP_API_URL || 'https://pairhaven.onrender.com';

// ✅ SAFE TOKEN INITIALIZATION (Only runs once at module load)
const initialToken = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
if (initialToken) {
  axios.defaults.headers.common['Authorization'] = `Bearer ${initialToken}`;
}

const ProtectedRoute = ({ children }) => {
  const authToken = localStorage.getItem('token');
  return authToken ? children : <Navigate to="/login" replace />;
};

function ProfileRouteWrapper({ onUpdateCounts }) {
  const navigate = useNavigate();
  
  // ✅ SAFE USER PARSING FUNCTION (Never crashes)
  const getStoredUser = () => {
    try {
      return JSON.parse(localStorage.getItem('user')) || {};
    } catch (e) { 
      console.error("Failed to parse user", e);
      return {}; 
    }
  };
  
  const storedUserData = getStoredUser();
  const hashPath = window.location.hash.replace('#', '') || '/';
  const pathParts = hashPath.split('/').filter(Boolean);
  
  useEffect(() => {
    if (pathParts[0] === 'profile' && pathParts[1] && pathParts[1] !== storedUserData._id) {
      if (onUpdateCounts) onUpdateCounts();
    }
  }, [hashPath, storedUserData._id]); 

  if (pathParts[0] === 'profile' && !pathParts[1]) return <Navigate to="/" replace />;
  if (pathParts[0] !== 'profile') return <Navigate to="/" replace />;

  const targetUserId = pathParts[1];
  if (targetUserId === storedUserData._id) return <Navigate to="/" replace />;

  return (
    <DashboardLayout 
      activeTabOverride="profile" 
      showBackButton={true}
      onBack={() => navigate(-1)}
    >
      <ProfileScreen userId={targetUserId} />
    </DashboardLayout>
  );
}

function App() {
  const [navCounts, setNavCounts] = useState({ chat: 0, alerts: 0 });

  const fetchNavCounts = async () => {
    const authToken = localStorage.getItem('token');
    if (!authToken) return;
    
    try {
      let totalUnreadMsgs = 0;
      try {
        const msgRes = await axios.get(`${API_URL}/api/messages/conversations`, { 
          headers: { Authorization: `Bearer ${authToken}` } 
        });
        totalUnreadMsgs = (msgRes.data || []).reduce((sum, c) => {
          const count = c.unreadCount ?? (c.messages?.filter(m => !m.read).length ?? 0);
          return sum + (count || 0);
        }, 0);
      } catch (err) { /* Silent fail for counts */ }

      let unreadNotifs = 0;
      try {
        const notifRes = await axios.get(`${API_URL}/api/notifications`, { 
          headers: { Authorization: `Bearer ${authToken}` } 
        });
        unreadNotifs = (notifRes.data || []).filter(n => n.read === false).length;
      } catch (err) { /* Silent fail for counts */ }

      setNavCounts({ chat: totalUnreadMsgs, alerts: unreadNotifs });
    } catch (err) { console.error("Nav counts failed:", err); }
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
      <span style={{ 
        position: 'absolute', top: '-5px', right: '-5px', 
        background: '#e53e3e', color: '#fff', fontSize: '0.65rem', 
        borderRadius: '50%', width: '16px', height: '16px', 
        display: 'flex', alignItems: 'center', justifyContent: 'center', 
        fontWeight: 700, border: '2px solid #fff' 
      }}>
        {count > 9 ? '9+' : count}
      </span>
    );
  };

  return (
    <div style={{ maxWidth: '600px', margin: '0 auto', background: '#f8f8f8', minHeight: '100vh', boxShadow: '0 0 18px rgba(0,0,0,0.08)' }}>
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

      <nav style={{ display: 'flex', justifyContent: 'space-around', alignItems: 'center', padding: '0.8rem 0', borderTop: '1px solid #dfe3ea', background: '#fff', height: '78px', position: 'relative' }}>
        {[
          { id: 'home', label: 'Home', icon: '🏠' },
          { id: 'matching', label: 'Match', icon: '' },
          { id: 'messages', label: 'Chat', icon: '💬', count: navCounts?.chat },
          { id: 'notifications', label: 'Alerts', icon: '', count: navCounts?.alerts },
          { id: 'profile', label: 'Profile', icon: '' }
        ].map(tab => (
          <button 
            key={tab.id} 
            onClick={() => { setActiveTab(tab.id); if (tab.id === 'profile') window.location.hash = '/'; }} 
            style={{ 
              border: currentTab === tab.id ? '1px solid #5b72f2' : '1px solid transparent', 
              background: currentTab === tab.id ? '#eef2ff' : 'transparent', 
              borderRadius: '10px', 
              padding: '0.5rem 0.8rem', 
              minWidth: '70px', 
              textAlign: 'center', 
              color: currentTab === tab.id ? '#5b72f2' : '#666', 
              cursor: 'pointer', 
              position: 'relative' 
            }}
          >
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
  const authToken = localStorage.getItem('token');
  
  useEffect(() => {
    const fetchPosts = async () => {
      if (!authToken) return;
      try {
        const res = await axios.get(`${API_URL}/api/posts`, { 
          headers: { Authorization: `Bearer ${authToken}` } 
        });
        
        const safePosts = (res.data || []).map(post => ({
          ...post,
          text: post.text || '',
          mediaUrl: post.mediaUrl || null,
          mediaType: post.mediaType || null,
          likesCount: post.likesCount || 0,
          lovesCount: post.lovesCount || 0,
          userLiked: !!post.userLiked,
          userLoved: !!post.userLoved
        }));
        
        setPosts(safePosts);
      } catch (err) { console.warn('Failed to load feed posts', err); }
    };
    fetchPosts();
  }, [authToken]);

  const handleReact = async (postId, type) => {
    try {
      const res = await axios.post(`${API_URL}/api/posts/${postId}/react`, 
        { type }, 
        { headers: { Authorization: `Bearer ${authToken}` } }
      );
      
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
          const hasMedia = post.mediaUrl && post.mediaUrl !== 'null' && post.mediaUrl !== '';
          const isVideo = hasMedia && (post.mediaType === 'video' || post.mediaUrl.includes('/video/upload'));
          const avatarSrc = getAvatarUrl(post.author);

          return (
            <div key={post._id} style={{ background: '#fff', borderRadius: '12px', marginTop: '1rem', padding: '1rem', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
              
              <div onClick={() => onNavigateToProfile && onNavigateToProfile(post.author?._id)} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10, cursor: 'pointer' }}>
                <img src={avatarSrc} alt={post.author?.name} style={{ width: 36, height: 36, borderRadius: '50%', objectFit: 'cover', background: '#eee' }} onError={(e) => { e.target.src = 'https://via.placeholder.com/36'; }} />
                <div>
                  <div style={{ fontWeight: 700 }}>{post.author?.name || 'User'}</div>
                  <div style={{ fontSize: 12, color: '#666' }}>{new Date(post.createdAt).toLocaleString()}</div>
                </div>
              </div>

              {post.text && post.text.trim() !== '' && (
                <div style={{ marginBottom: hasMedia ? 8 : 0, lineHeight: '1.4', whiteSpace: 'pre-wrap' }}>
                  {post.text}
                </div>
              )}

              {hasMedia && (
                isVideo ? (
                  <video src={post.mediaUrl} controls style={{ width: '100%', maxHeight: 420, borderRadius: 10, background: '#000', marginTop: 8 }} />
                ) : (
                  <img src={post.mediaUrl} alt="Post media" style={{ width: '100%', borderRadius: 10, marginTop: 8 }} onError={(e) => { e.target.style.display = 'none'; }} />
                )
              )}

              <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginTop: '12px', paddingTop: '12px', borderTop: '1px solid #f5f5f5' }}>
                <button onClick={() => handleReact(post._id, 'like')} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', gap: '6px', color: post.userLiked ? '#e53e3e' : '#666' }}>
                  <span style={{ fontSize: '1.4rem' }}>{post.userLiked ? '❤️' : '🤍'}</span>
                  <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>{post.likesCount}</span>
                </button>
                <button onClick={() => handleReact(post._id, 'love')} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', gap: '6px', color: post.userLoved ? '#ff6b6b' : '#666' }}>
                  <span style={{ fontSize: '1.4rem' }}>{post.userLoved ? '💖' : ''}</span>
                  <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>{post.lovesCount}</span>
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
      const res = await fetch(`${API_URL}/api/auth/login`, { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify({ email: e.target.email.value, password: e.target.password.value }) 
      });
      const data = await res.json();
      if (!res.ok) { alert(data.message || 'Login failed'); return; }
      
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      axios.defaults.headers.common['Authorization'] = `Bearer ${data.token}`;
      navigate('/', { replace: true });
    } catch (err) { 
      console.error(err); 
      alert('Server error.'); 
    } finally { 
      setLoading(false); 
    }
  };

  return (
    <div style={{ 
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, 
      overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: '#000'
    }}>
      <div style={{ position: 'absolute', inset: 0, zIndex: 0 }}>
        <style>{`
          @keyframes fadeSlide {
            0% { opacity: 0; } 10% { opacity: 1; } 33% { opacity: 1; } 43% { opacity: 0; } 100% { opacity: 0; }
          }
          .bg-slide { position: absolute; inset: 0; background-size: cover; background-position: center; opacity: 0; animation: fadeSlide 18s infinite; }
          .bg-1 { animation-delay: 0s; background-image: url('https://images.unsplash.com/photo-1516589178581-6cd7833ae3b2?q=80&w=1080&auto=format&fit=crop'); }
          .bg-2 { animation-delay: 6s; background-image: url('https://images.unsplash.com/photo-1529634806980-85c3dd6d34ac?q=80&w=1080&auto=format&fit=crop'); }
          .bg-3 { animation-delay: 12s; background-image: url('https://images.unsplash.com/photo-1519741497674-611481863552?q=80&w=1080&auto=format&fit=crop'); }
        `}</style>
        <div className="bg-slide bg-1"></div>
        <div className="bg-slide bg-2"></div>
        <div className="bg-slide bg-3"></div>
        <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)' }}></div>
      </div>

      <div style={{ 
        position: 'relative', zIndex: 1, width: '90%', maxWidth: 400, 
        background: '#fff', padding: '2rem 1.5rem', borderRadius: '16px', 
        boxShadow: '0 10px 40px rgba(0,0,0,0.3)', margin: '1rem',
        maxHeight: '90vh', overflowY: 'auto'
      }}>
        <h2 style={{ textAlign: 'center', color: '#5b72f2', marginBottom: '1.5rem', fontSize: '1.8rem' }}>Welcome Back</h2>
        <form onSubmit={handleSubmit}>
          <input name="email" type="email" placeholder="Email" required autoComplete="email" style={inputStyle} />
          <input name="password" type="password" placeholder="Password" required autoComplete="current-password" style={inputStyle} />
          <button type="submit" style={{ ...primaryButtonStyle, opacity: loading ? 0.7 : 1, marginTop: '0.5rem', padding: '1rem' }} disabled={loading}>
            {loading ? 'Logging in...' : 'Log In'}
          </button>
        </form>
        <p style={{ textAlign: 'center', marginTop: '1.5rem', color: '#666', fontSize: '0.95rem' }}>
          New here? <span onClick={() => navigate('/register')} style={{ color: '#5b72f2', cursor: 'pointer', textDecoration: 'underline', fontWeight: 600 }}>Create Account</span>
        </p>
      </div>
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
          const pos = await new Promise((resolve, reject) => 
            navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: false, timeout: 5000 })
          );
          formData.append('location', JSON.stringify({ type: 'Point', coordinates: [pos.coords.longitude, pos.coords.latitude] }));
        } catch (geoErr) { 
          formData.append('location', JSON.stringify({ type: 'Point', coordinates: [0, 0] })); 
        }
      }
      
      const res = await fetch(`${API_URL}/api/auth/register`, { method: 'POST', body: formData });
      const data = await res.json();
      
      if (!res.ok) { 
        alert(data.message || 'Registration failed'); 
        return; 
      }
      
      // Auto-login after successful registration
      try {
        const loginRes = await fetch(`${API_URL}/api/auth/login`, { 
          method: 'POST', 
          headers: { 'Content-Type': 'application/json' }, 
          body: JSON.stringify({ email: formData.get('email'), password: formData.get('password') }) 
        });
        const loginData = await loginRes.json();
        
        if (loginRes.ok) {
          localStorage.setItem('token', loginData.token);
          localStorage.setItem('user', JSON.stringify(loginData.user));
          axios.defaults.headers.common['Authorization'] = `Bearer ${loginData.token}`;
          navigate('/', { replace: true });
          return;
        }
      } catch (err) {
        console.error("Auto-login failed:", err);
      }
      
      alert('Registered! Please log in.');
      navigate('/login', { replace: true });
      
    } catch (err) { 
      console.error("Registration error:", err);
      alert('Server error.'); 
    } finally { 
      setLoading(false); 
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
        <button type="submit" style={{ ...primaryButtonStyle, opacity: loading ? 0.7 : 1 }} disabled={loading}>
          {loading ? 'Signing up...' : 'Sign Up'}
        </button>
      </form>
      <p style={{ textAlign: 'center', marginTop: '1rem' }}>
        Already have an account? <span onClick={() => navigate('/login')} style={{ color: '#5b72f2', cursor: 'pointer', textDecoration: 'underline' }}>Log In</span>
      </p>
    </div>
  );
}
function SocialAuthButtons() {
  const navigate = useNavigate();

  // Placeholder handlers — connect these to Firebase, Google/Apple SDKs, or OAuth popups
  const handleGoogleLogin = async () => {
    try {
      // Example: Integrating with Firebase or custom Google OAuth popup
      // const googleUser = ... 
      alert("Google Sign-In integration hook goes here.");
    } catch (err) {
      console.error("Google sign-in error", err);
    }
  };

  const handleAppleLogin = async () => {
    try {
      // Example: Integrating with Apple Sign-In SDK
      alert("Apple Sign-In integration hook goes here.");
    } catch (err) {
      console.error("Apple sign-in error", err);
    }
  };

  return (
    <div style={{ marginTop: '1.5rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', textAlign: 'center', margin: '1rem 0', color: '#888' }}>
        <div style={{ flex: 1, borderBottom: '1px solid #dfe3ea' }}></div>
        <span style={{ padding: '0 10px', fontSize: '0.85rem' }}>OR</span>
        <div style={{ flex: 1, borderBottom: '1px solid #dfe3ea' }}></div>
      </div>

      <button 
        type="button" 
        onClick={handleGoogleLogin} 
        style={{ ...socialButtonStyle, background: '#fff', color: '#444', border: '1px solid #dfe3ea', marginBottom: '0.8rem' }}
      >
        <span style={{ marginRight: '10px' }}>🌐</span> Continue with Google
      </button>

      <button 
        type="button" 
        onClick={handleAppleLogin} 
        style={{ ...socialButtonStyle, background: '#000', color: '#fff' }}
      >
        <span style={{ marginRight: '10px' }}>🍎</span> Continue with Apple
      </button>
    </div>
  );
}

const socialButtonStyle = {
  width: '100%',
  padding: '0.8rem',
  borderRadius: '8px',
  fontWeight: 600,
  fontSize: '0.95rem',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  boxSizing: 'border-box'
};
const inputStyle = { width: '100%', boxSizing: 'border-box', padding: '0.8rem', borderRadius: '8px', border: '1px solid #dfe3ea', marginBottom: '1rem', fontSize: '1rem' };
const primaryButtonStyle = { width: '100%', padding: '0.9rem', border: 'none', borderRadius: '8px', background: '#5b72f2', color: '#fff', fontWeight: 700, cursor: 'pointer' };

export default App;
