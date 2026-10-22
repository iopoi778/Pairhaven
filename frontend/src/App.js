import React, { useState, useEffect, useRef } from 'react';
import { HashRouter as Router, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import axios from 'axios';
import io from 'socket.io-client';
import ProfileScreen from './pages/ProfileScreen';
import MatchingScreen from './pages/MatchingScreen';
import ChatScreen from './pages/chat';
import NotificationsScreen from './pages/NotificationsScreen';
import AdminScreen from './pages/AdminScreen';
import VerifiedBadge from './components/VerifiedBadge';
import { AdMob, BannerAdPosition, BannerAdSize } from '@capacitor-community/admob';

const API_URL = process.env.REACT_APP_API_URL || 'https://pairhaven.onrender.com';

// 🔔 60-second Auto-dismiss Pop-up Notification Component
function NotificationPopup({ notification, onClose }) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    // ⏱️ Auto dismiss after 60,000ms (1 minute)
    const timer = setTimeout(() => {
      handleClose();
    }, 60000);

    return () => clearTimeout(timer);
  }, [notification]);

  const handleClose = () => {
    setVisible(false);
    setTimeout(() => {
      if (onClose) onClose();
    }, 300);
  };

  if (!notification || !visible) return null;

  const senderObj = typeof notification.sender === 'object' ? notification.sender : null;

  return (
    <div style={{
      position: 'fixed',
      top: '20px',
      right: '20px',
      zIndex: 9999,
      background: '#ffffff',
      boxShadow: '0 10px 30px rgba(0,0,0,0.18)',
      borderRadius: '16px',
      padding: '1rem 1.2rem',
      maxWidth: '340px',
      width: '90%',
      borderLeft: '5px solid #5b72f2',
      display: 'flex',
      flexDirection: 'column',
      gap: '6px',
      animation: 'slideIn 0.3s ease-out',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
    }}>
      <style>{`
        @keyframes slideIn {
          from { transform: translateY(-20px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        @keyframes shrinkBar {
          from { width: 100%; }
          to { width: 0%; }
        }
      `}</style>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontWeight: 800, fontSize: '0.85rem', color: '#5b72f2', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          {notification.title || '🔔 New Notification'}
        </span>
        <button 
          onClick={handleClose} 
          style={{ background: 'none', border: 'none', fontSize: '1.1rem', cursor: 'pointer', color: '#94a3b8' }}
        >
          ✕
        </button>
      </div>

      <div style={{ fontSize: '0.9rem', color: '#1e293b', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
        <span>{notification.message}</span>
        {senderObj?.verificationStatus === 'verified' && <VerifiedBadge status="verified" size="0.85rem" />}
      </div>

      {/* 60-second animated timer bar */}
      <div style={{ width: '100%', height: '3px', background: '#e2e8f0', borderRadius: '2px', overflow: 'hidden', marginTop: '4px' }}>
        <div style={{
          height: '100%',
          background: '#5b72f2',
          width: '100%',
          animation: 'shrinkBar 60s linear forwards'
        }} />
      </div>
    </div>
  );
}

const ProtectedRoute = ({ children }) => {
  const authToken = localStorage.getItem('token');
  if (!authToken) return <Navigate to="/login" replace />;
  return children;
};

const AdminRoute = ({ children }) => {
  const authToken = localStorage.getItem('token');
  let user = {};
  try {
    user = JSON.parse(localStorage.getItem('user')) || {};
  } catch (e) {}

  if (!authToken) return <Navigate to="/login" replace />;
  if (user.role !== 'admin') return <Navigate to="/" replace />;
  return children;
};

function ProfileRouteWrapper({ onUpdateCounts }) {
  const navigate = useNavigate();
  
  const getStoredUser = () => {
    try {
      return JSON.parse(localStorage.getItem('user')) || {};
    } catch (e) { return {}; }
  };
  
  const storedUserData = getStoredUser();
  const hashPath = window.location.hash.replace('#', '') || '/';
  const pathParts = hashPath.split('/').filter(Boolean);


useEffect(() => {
  const initAdMob = async () => {
    try {
      await AdMob.initialize({
        requestTrackingAuthorization: true,
      });
      
      // Display a banner ad
      await AdMob.showBanner({
        adId: 'ca-app-pub-XXXXXXXXXXXXXXXX/YYYYYYYYYY', // Your AdMob Banner ID
        position: BannerAdPosition.BOTTOM_CENTER,
        size: BannerAdSize.BANNER,
        margin: 0,
        isTesting: true, // Set to false when publishing to production
      });
    } catch (e) {
      console.error("AdMob initialization error:", e);
    }
  };

  initAdMob();
}, []);
  useEffect(() => {
  const queryParams = new URLSearchParams(window.location.search);
  const paymentStatus = queryParams.get('payment');
  const selectedPlan = queryParams.get('plan');

  if (paymentStatus === 'success' && selectedPlan) {
    const token = localStorage.getItem('token');
    axios.post(`${API_URL}/api/payments/verify-success`, 
      { plan: selectedPlan },
      { headers: { Authorization: `Bearer ${token}` } }
    ).then(res => {
      if (res.data.user) {
        localStorage.setItem('user', JSON.stringify(res.data.user));
        alert(`🎉 Success! You are now upgraded to ${selectedPlan.toUpperCase()}!`);
        window.location.href = '#/'; // Clear query params
        window.location.reload();
      }
    }).catch(err => console.error("Verification error", err));
  }
}, []);
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
  const [activePopup, setActivePopup] = useState(null);
  const socketRef = useRef(null);

  // Sync profile on load / refresh
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      axios.get(`${API_URL}/api/users/me`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      .then(res => {
        if (res.data) {
          localStorage.setItem('user', JSON.stringify(res.data));
        }
      })
      .catch(err => {
        console.error("Failed to sync user profile:", err);
      });
    }
  }, []);

  const initialToken = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  if (initialToken) {
    axios.defaults.headers.common['Authorization'] = `Bearer ${initialToken}`;
  }

  const getMyId = () => {
    try {
      const raw = localStorage.getItem('user');
      if (!raw) return null;
      const u = JSON.parse(raw);
      return (u._id || u.id || u.userId)?.toString();
    } catch (e) { return null; }
  };

  const myId = getMyId();

  // 📡 Real-time Socket Listeners for Pop-ups (Messages, Likes, Matches)
  useEffect(() => {
    if (!myId) return;

    socketRef.current = io(API_URL);
    socketRef.current.emit('join', myId);

    // 💬 1. Incoming Message Pop-up
    socketRef.current.on('receive-message', (message) => {
      const senderId = message.sender?._id || message.sender;
      if (senderId && senderId !== myId) {
        setActivePopup({
          title: '💬 New Message',
          message: `${message.sender?.name || 'Someone'}: ${message.content}`,
          sender: message.sender,
          createdAt: new Date()
        });
        fetchNavCounts();
      }
    });

    // ❤️ 2. Incoming Like Pop-up
    socketRef.current.on('receive-like', (data) => {
      setActivePopup({
        title: '❤️ New Like',
        message: `${data.senderName || 'Someone'} liked your profile!`,
        sender: data.sender,
        createdAt: new Date()
      });
      fetchNavCounts();
    });

    // 💖 3. New Match Pop-up
    socketRef.current.on('new-match', (data) => {
      setActivePopup({
        title: "💖 It's a Match!",
        message: `You and ${data.matchedUserName || 'a new user'} matched with each other!`,
        sender: data.sender,
        createdAt: new Date()
      });
      fetchNavCounts();
    });
    
    return () => {
      if (socketRef.current) socketRef.current.disconnect();
    };
  }, [myId]);

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
      } catch (err) {}

      let unreadNotifs = 0;
      try {
        const notifRes = await axios.get(`${API_URL}/api/notifications`, { 
          headers: { Authorization: `Bearer ${authToken}` } 
        });
        unreadNotifs = (notifRes.data || []).filter(n => n.read === false).length;
      } catch (err) {}

      setNavCounts({ chat: totalUnreadMsgs, alerts: unreadNotifs });
    } catch (err) {}
  };

  useEffect(() => {
    fetchNavCounts();
    const interval = setInterval(fetchNavCounts, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <Router>
      <div style={{ fontFamily: 'Arial, sans-serif', minHeight: '100vh', background: '#f2f2f2', position: 'relative' }}>
        
        {/* 🔔 Global Pop-up Notification Banner (Disappears after 1 min) */}
        {activePopup && (
          <NotificationPopup 
            notification={activePopup} 
            onClose={() => setActivePopup(null)} 
          />
        )}

        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/admin" element={<AdminRoute><AdminScreen /></AdminRoute>} />
          <Route path="/profile/*" element={<ProtectedRoute><ProfileRouteWrapper onUpdateCounts={fetchNavCounts} /></ProtectedRoute>} />
          <Route path="/*" element={<ProtectedRoute><DashboardLayout navCounts={navCounts} onUpdateCounts={fetchNavCounts} /></ProtectedRoute>} />
        </Routes>
      </div>
    </Router>
  );
}

function AnimatedBackground() {
  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 0, pointerEvents: 'none' }}>
      <style>{`
        @keyframes fadeSlide { 0% { opacity: 0; } 10% { opacity: 1; } 33% { opacity: 1; } 43% { opacity: 0; } 100% { opacity: 0; } }
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
  );
}

function DashboardLayout({ activeTabOverride, children, showBackButton, onBack, navCounts, onUpdateCounts }) {
  const [activeTab, setActiveTab] = useState('home');
  const currentTab = activeTabOverride || activeTab;

  let currentUser = {};
  try {
    currentUser = JSON.parse(localStorage.getItem('user')) || {};
  } catch (e) {}

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

  const tabsList = [
    { id: 'home', label: 'Home', icon: '🏠' },
    { id: 'matching', label: 'Match', icon: '💖' },
    { id: 'messages', label: 'Chat', icon: '💬', count: navCounts?.chat },
    { id: 'notifications', label: 'Alerts', icon: '🔔', count: navCounts?.alerts },
    { id: 'profile', label: 'Profile', icon: '👤' }
  ];

  if (currentUser.role === 'admin') {
    tabsList.push({ id: 'admin', label: 'Admin', icon: '🛡️' });
  }

  return (
    <div style={{ maxWidth: '600px', margin: '0 auto', background: '#f8f8f8', minHeight: '100vh', boxShadow: '0 0 18px rgba(0,0,0,0.08)', position: 'relative', paddingBottom: '90px' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem 1.2rem', borderBottom: '1px solid #dfe3ea', background: '#fff', boxSizing: 'border-box' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {showBackButton && (
            <button onClick={onBack} style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer', padding: 0 }}>←</button>
          )}
          <h2 style={{ margin: 0, color: '#5b72f2', fontWeight: 700 }}>PairHaven</h2>
        </div>
      </header>

      <main style={{ padding: '1rem', background: '#f6f6f6' }}>
        {renderContent()}
      </main>

      <nav style={{ 
        display: 'flex', justifyContent: 'space-around', alignItems: 'center', 
        padding: '0.8rem 0', borderTop: '1px solid #dfe3ea', background: '#fff', 
        height: '78px', position: 'fixed', bottom: 0, left: 0, right: 0, 
        maxWidth: '600px', margin: '0 auto', zIndex: 1000, boxSizing: 'border-box',
        boxShadow: '0 -4px 12px rgba(0,0,0,0.05)'
      }}>
        {tabsList.map(tab => (
          <button 
            key={tab.id} 
            onClick={() => { 
              if (tab.id === 'admin') {
                window.location.hash = '/admin';
              } else {
                setActiveTab(tab.id); 
                if (tab.id === 'profile') window.location.hash = '/';
              }
            }} 
            style={{ 
              border: (currentTab === tab.id || (tab.id === 'admin' && window.location.hash.includes('/admin'))) ? '1px solid #5b72f2' : '1px solid transparent', 
              background: (currentTab === tab.id || (tab.id === 'admin' && window.location.hash.includes('/admin'))) ? '#eef2ff' : 'transparent', 
              borderRadius: '10px', 
              padding: '0.5rem 0.6rem', 
              minWidth: '60px', 
              textAlign: 'center', 
              color: (currentTab === tab.id || (tab.id === 'admin' && window.location.hash.includes('/admin'))) ? '#5b72f2' : '#666', 
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
      } catch (err) {}
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
                  <div style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px' }}>
                    {post.author?.name || 'User'}
                    <VerifiedBadge status={post.author?.verificationStatus} size="0.85rem" />
                  </div>
                  <div style={{ fontSize: 12, color: '#666' }}>{new Date(post.createdAt).toLocaleString()}</div>
                </div>
              </div>

              {post.text && post.text.trim() !== '' && (
                <div style={{ marginBottom: hasMedia ? 8 : 0, lineHeight: '1.4', whiteSpace: 'pre-wrap' }}>{post.text}</div>
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
      
      if (data.user.role === 'admin') {
        navigate('/admin', { replace: true });
      } else {
        navigate('/', { replace: true });
      }
    } catch (err) { 
      alert('Server error.'); 
    } finally { 
      setLoading(false); 
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#000' }}>
      <AnimatedBackground />

      <div style={{ position: 'relative', zIndex: 1, width: '90%', maxWidth: 400, background: '#fff', padding: '2rem 1.5rem', borderRadius: '16px', boxShadow: '0 10px 40px rgba(0,0,0,0.3)', margin: '1rem', maxHeight: '90vh', overflowY: 'auto' }}>
        <h2 style={{ textAlign: 'center', color: '#5b72f2', marginBottom: '1.5rem', fontSize: '1.8rem' }}>Welcome Back</h2>
        <form onSubmit={handleSubmit}>
          <input name="email" type="email" placeholder="Email" required autoComplete="email" style={inputStyle} />
          <input name="password" type="password" placeholder="Password" required autoComplete="current-password" style={inputStyle} />
          <button type="submit" style={{ ...primaryButtonStyle, opacity: loading ? 0.7 : 1, marginTop: '0.5rem', padding: '1rem' }} disabled={loading}>
            {loading ? 'Logging in...' : 'Log In'}
          </button>
        </form>
        <SocialAuthButtons />
        <p style={{ textAlign: 'center', marginTop: '1.5rem', color: '#666', fontSize: '0.95rem' }}>
          New here? <span onClick={() => navigate('/register')} style={{ color: '#5b72f2', cursor: 'pointer', textDecoration: 'underline', fontWeight: 600 }}>Create Account</span>
        </p>
      </div>
    </div>
  );
}

function RegisterPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0); 
  const [formData, setFormData] = useState({ 
    name: '', email: '', phone: '', password: '', age: '', gender: '', city: '', bio: '' 
  });
  const [selectedPhotos, setSelectedPhotos] = useState([]);
  const [loading, setLoading] = useState(false);

  const handleDetailsSubmit = (e) => {
    e.preventDefault();
    const data = new FormData(e.target);
    const age = Number(data.get('age'));
    if (age < 18) {
      alert("You must be 18 or older to register.");
      return;
    }
    setFormData({
      name: data.get('name'),
      email: data.get('email'),
      phone: data.get('phone'),
      password: data.get('password'),
      age,
      gender: data.get('gender'),
      city: data.get('city'),
      bio: data.get('bio')
    });
    setStep(2);
  };

  const handleFilesChange = (e) => {
    const files = Array.from(e.target.files);
    if (files.length > 0) {
      setSelectedPhotos(prev => [...prev, ...files].slice(0, 6));
    }
  };

  const handleRemovePhoto = (index) => {
    setSelectedPhotos(prev => prev.filter((_, i) => i !== index));
  };

  const handleFinalRegistration = async () => {
    if (selectedPhotos.length < 2) {
      alert("Please upload at least 2 photos to continue.");
      return;
    }
    
    setLoading(true);
    const payload = new FormData();
    
    Object.keys(formData).forEach(key => {
      payload.append(key, formData[key]);
    });

    selectedPhotos.forEach(photo => {
      payload.append('photos', photo);
    });

    try {
      const res = await fetch(`${API_URL}/api/auth/register`, { method: 'POST', body: payload });
      const responseText = await res.text();
      let data;
      try { data = JSON.parse(responseText); } catch (e) { data = { message: responseText || 'Internal Server Error' }; }

      if (!res.ok) { 
        alert(data.message || 'Registration failed'); 
        setLoading(false); 
        return; 
      }

      const loginRes = await fetch(`${API_URL}/api/auth/login`, { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify({ email: formData.email, password: formData.password }) 
      });
      
      const loginText = await loginRes.text();
      let loginData;
      try { loginData = JSON.parse(loginText); } catch(e) { loginData = {}; }

      if (loginRes.ok) {
        localStorage.setItem('token', loginData.token);
        localStorage.setItem('user', JSON.stringify(loginData.user));
        axios.defaults.headers.common['Authorization'] = `Bearer ${loginData.token}`;
        navigate('/', { replace: true });
      } else {
        navigate('/login', { replace: true });
      }
    } catch (err) {
      console.error("Registration error:", err);
      alert('Server connection error. Please check your network.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#000' }}>
      <AnimatedBackground />

      <div style={{ position: 'relative', zIndex: 1, width: '90%', maxWidth: 420, background: '#fff', padding: '2rem', borderRadius: '16px', boxShadow: '0 10px 40px rgba(0,0,0,0.3)', margin: '1rem', maxHeight: '90vh', overflowY: 'auto' }}>
        
        {step === 0 && (
          <div style={{ textAlign: 'center', padding: '1rem 0' }}>
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🔞</div>
            <h2 style={{ color: '#5b72f2', marginBottom: '0.8rem' }}>Are you 18 or older?</h2>
            <p style={{ color: '#666', fontSize: '0.95rem', marginBottom: '2rem', lineHeight: '1.4' }}>
              PairHaven is strictly for adults. By continuing you confirm you are at least 18 and agree to our Community Guidelines and Terms.
            </p>
            <button onClick={() => setStep(1)} style={{ ...primaryButtonStyle, background: 'linear-gradient(135deg, #ff4b4b, #5b72f2)', marginBottom: '1rem', padding: '1rem' }}>
              I'm 18 or older
            </button>
            <button onClick={() => alert("You must be 18 or older to join.")} style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', fontSize: '0.9rem', display: 'block', margin: '0 auto 1.5rem' }}>
              I'm under 18
            </button>

            <div style={{ borderTop: '1px solid #dfe3ea', paddingTop: '1.5rem' }}>
              <p style={{ color: '#666', fontSize: '0.9rem', marginBottom: '1rem' }}>Already have an account?</p>
              <button onClick={() => navigate('/login')} style={{ ...primaryButtonStyle, background: '#fff', color: '#5b72f2', border: '1px solid #5b72f2' }}>
                Log In
              </button>
            </div>
          </div>
        )}

        {step === 1 && (
          <div>
            <h2 style={{ textAlign: 'center', color: '#5b72f2', marginBottom: '1.2rem' }}>Create Account</h2>
            <form onSubmit={handleDetailsSubmit}>
              <input name="name" placeholder="Full Name" required style={inputStyle} />
              <input name="email" type="email" placeholder="Email" required style={inputStyle} />
              <input name="phone" placeholder="Phone Number" required style={inputStyle} />
              <input name="password" type="password" placeholder="Password" required style={inputStyle} />
              <div style={{ display: 'flex', gap: '1rem' }}>
                <input name="age" type="number" min="18" placeholder="Age" required style={{ ...inputStyle, flex: 1 }} />
                <select name="gender" required style={{ ...inputStyle, flex: 1 }}>
                  <option value="">Gender</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <input name="city" placeholder="City (e.g., New York, London)" required style={inputStyle} />
              <textarea name="bio" rows="3" placeholder="Bio" style={inputStyle} />
              <button type="submit" style={primaryButtonStyle}>Next: Add Pictures</button>
            </form>
            <p style={{ textAlign: 'center', marginTop: '1rem' }}>
              Already have an account? <span onClick={() => navigate('/login')} style={{ color: '#5b72f2', cursor: 'pointer', textDecoration: 'underline' }}>Log In</span>
            </p>
          </div>
        )}

        {step === 2 && (
          <div style={{ textAlign: 'center' }}>
            <h2 style={{ color: '#5b72f2', marginBottom: '0.5rem' }}>Upload Profile Pictures</h2>
            <p style={{ color: '#666', fontSize: '0.9rem', marginBottom: '1rem' }}>Please upload at least **2 photos** to continue.</p>
            
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', marginBottom: '1.5rem' }}>
              {selectedPhotos.map((file, idx) => (
                <div key={idx} style={{ aspectRatio: '1', borderRadius: '8px', overflow: 'hidden', background: '#eee', position: 'relative' }}>
                  <img src={URL.createObjectURL(file)} alt="Preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  <button 
                    type="button"
                    onClick={() => handleRemovePhoto(idx)} 
                    style={{ position: 'absolute', top: '4px', right: '4px', background: 'rgba(0,0,0,0.6)', color: '#fff', border: 'none', borderRadius: '50%', width: '20px', height: '20px', fontSize: '10px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  >
                    ✕
                  </button>
                </div>
              ))}
              {selectedPhotos.length < 6 && (
                <label style={{ aspectRatio: '1', borderRadius: '8px', border: '2px dashed #5b72f2', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#5b72f2', background: '#f8fafc' }}>
                  <span style={{ fontSize: '1.5rem' }}>+</span>
                  <span style={{ fontSize: '0.75rem' }}>Add Photo</span>
                  <input type="file" multiple accept="image/*" onChange={handleFilesChange} style={{ display: 'none' }} />
                </label>
              )}
            </div>

            <button onClick={handleFinalRegistration} disabled={loading || selectedPhotos.length < 2} style={{ ...primaryButtonStyle, opacity: (loading || selectedPhotos.length < 2) ? 0.6 : 1 }}>
              {loading ? 'Finalizing...' : `Complete Sign Up (${selectedPhotos.length}/2+ photos)`}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function SocialAuthButtons() {
  const navigate = useNavigate();

  const handleGoogleLogin = async () => {
    try {
      const email = prompt("Enter demo email (e.g., test@gmail.com):");
      if (!email) return;
      
      const payload = {
        email,
        name: "Google User",
        googleId: "google_" + Date.now(),
        photo: "https://via.placeholder.com/150",
        age: 25,
        gender: "other",
        phone: "google_demo_" + Date.now()
      };

      const res = await fetch(`${API_URL}/api/auth/google`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (!res.ok) { alert(data.message || 'Google login failed'); return; }

      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      axios.defaults.headers.common['Authorization'] = `Bearer ${data.token}`;
      navigate('/', { replace: true });
    } catch (err) {
      alert("Google login error.");
    }
  };

  const handleAppleLogin = async () => {
    try {
      const email = prompt("Enter demo email (e.g., test@icloud.com):");
      if (!email) return;

      const payload = {
        email,
        name: "Apple User",
        appleId: "apple_" + Date.now(),
        age: 25,
        gender: "other",
        phone: "apple_demo_" + Date.now()
      };

      const res = await fetch(`${API_URL}/api/auth/apple`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (!res.ok) { alert(data.message || 'Apple login failed'); return; }

      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      axios.defaults.headers.common['Authorization'] = `Bearer ${data.token}`;
      navigate('/', { replace: true });
    } catch (err) {
      alert("Apple login error.");
    }
  };

  return (
    <div style={{ marginTop: '1.5rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', textAlign: 'center', margin: '1rem 0', color: '#888' }}>
        <div style={{ flex: 1, borderBottom: '1px solid #dfe3ea' }}></div>
        <span style={{ padding: '0 10px', fontSize: '0.85rem' }}>OR</span>
        <div style={{ flex: 1, borderBottom: '1px solid #dfe3ea' }}></div>
      </div>

      <button type="button" onClick={handleGoogleLogin} style={{ ...socialButtonStyle, background: '#fff', color: '#444', border: '1px solid #dfe3ea', marginBottom: '0.8rem' }}>
        Continue with Google
      </button>
      <button type="button" onClick={handleAppleLogin} style={{ ...socialButtonStyle, background: '#000', color: '#fff' }}>
        Continue with Apple
      </button>
    </div>
  );
}

const socialButtonStyle = { width: '100%', padding: '0.8rem', borderRadius: '8px', fontWeight: 600, fontSize: '0.95rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxSizing: 'border-box' };
const inputStyle = { width: '100%', boxSizing: 'border-box', padding: '0.8rem', borderRadius: '8px', border: '1px solid #dfe3ea', marginBottom: '1rem', fontSize: '1rem' };
const primaryButtonStyle = { width: '100%', padding: '0.9rem', border: 'none', borderRadius: '8px', background: '#5b72f2', color: '#fff', fontWeight: 700, cursor: 'pointer' };

export default App;
