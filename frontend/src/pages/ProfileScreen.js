import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom'; // Added for navigation after logout

const API_URL = process.env.REACT_APP_API_URL || 'https://pairhaven.onrender.com';

function ProfileScreen({ userId }) {
  const navigate = useNavigate(); // Initialize navigate
  const [user, setUser] = useState(null);
  const [posts, setPosts] = useState([]);
  const [isEditingBio, setIsEditingBio] = useState(false);
  const [bioText, setBioText] = useState('');
  const [loading, setLoading] = useState(true);
  
  const token = localStorage.getItem('token');
  const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
  const isOwnProfile = userId === currentUser._id || !userId;

  useEffect(() => {
    const fetchData = async () => {
      try {
        const profileRes = await axios.get(`${API_URL}/api/users/profile/${userId || 'me'}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setUser(profileRes.data);
        setBioText(profileRes.data.bio || '');

        const postsRes = await axios.get(`${API_URL}/api/users/profile/${profileRes.data._id}/posts`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setPosts(postsRes.data);
      } catch (err) {
        console.error("Failed to load profile", err);
      } finally {
        setLoading(false);
      }
    };
    if (token) fetchData();
  }, [userId, token]);

  const handleSaveBio = async () => {
    try {
      await axios.patch(`${API_URL}/api/users/profile/me`, { bio: bioText }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setUser(prev => ({ ...prev, bio: bioText }));
      setIsEditingBio(false);
    } catch (err) { alert("Failed to update bio"); }
  };

  const handleTogglePrivacy = async () => {
    try {
      const newStatus = !user.isPrivate;
      await axios.patch(`${API_URL}/api/users/profile/me`, { isPrivate: newStatus }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setUser(prev => ({ ...prev, isPrivate: newStatus }));
    } catch (err) { alert("Failed to update privacy"); }
  };

  const handleDeletePost = async (postId) => {
    if (!window.confirm("Delete this post?")) return;
    try {
      await axios.delete(`${API_URL}/api/posts/${postId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setPosts(prev => prev.filter(p => p._id !== postId));
    } catch (err) { alert("Failed to delete post"); }
  };

  // ✅ NEW: Logout Handler
  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    delete axios.defaults.headers.common['Authorization'];
    navigate('/login', { replace: true });
  };

  if (loading) return <div style={{padding:'2rem', textAlign:'center'}}>Loading...</div>;
  if (!user) return <div style={{padding:'2rem', textAlign:'center'}}>User not found.</div>;

  return (
    <div style={{ padding: '1rem', paddingBottom: '90px', position: 'relative' }}>
      
      {/* ✅ FIXED LOGOUT BUTTON: Only visible on own profile, positioned bottom-right */}
      {isOwnProfile && (
        <button 
          onClick={handleLogout}
          style={{
            position: 'fixed',
            bottom: '90px', // Above the nav bar
            right: '20px',
            background: '#fff',
            color: '#e53e3e',
            border: '1px solid #fee2e2',
            borderRadius: '50px',
            padding: '0.6rem 1.2rem',
            fontSize: '0.9rem',
            fontWeight: 600,
            cursor: 'pointer',
            boxShadow: '0 4px 12px rgba(229, 62, 62, 0.15)',
            zIndex: 100,
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}
        >
          <span>🚪</span> Logout
        </button>
      )}

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h2 style={{ margin: 0 }}>{user.name}</h2>
        {isOwnProfile && (
          <button onClick={handleTogglePrivacy} style={{ 
            background: user.isPrivate ? '#e53e3e' : '#10b981', color: '#fff', 
            border: 'none', borderRadius: '8px', padding: '0.5rem 1rem', cursor: 'pointer' 
          }}>
            {user.isPrivate ? '🔒 Private' : '🌍 Public'}
          </button>
        )}
      </div>

      {/* Stats Row */}
      <div style={{ display: 'flex', gap: '2rem', marginBottom: '1.5rem', borderBottom: '1px solid #eee', paddingBottom: '1rem' }}>
        <div style={{textAlign:'center'}}><strong>{user.followersCount}</strong><br/><span style={{fontSize:'0.8rem',color:'#666'}}>Followers</span></div>
        <div style={{textAlign:'center'}}><strong>{user.matchesCount}</strong><br/><span style={{fontSize:'0.8rem',color:'#666'}}>Matches</span></div>
        {isOwnProfile && (
          <div style={{textAlign:'center'}}><strong>{user.followingCount}</strong><br/><span style={{fontSize:'0.8rem',color:'#666'}}>Following</span></div>
        )}
      </div>

      {/* Bio Section */}
      <div style={{ background: '#f9f9f9', padding: '1rem', borderRadius: '8px', marginBottom: '1.5rem' }}>
        {isEditingBio ? (
          <>
            <textarea value={bioText} onChange={e => setBioText(e.target.value)} rows="3" style={{width:'100%',border:'1px solid #ddd',borderRadius:'8px',padding:'0.5rem'}} />
            <div style={{marginTop:'0.5rem',display:'flex',gap:'0.5rem'}}>
              <button onClick={handleSaveBio} style={{background:'#5b72f2',color:'#fff',border:'none',borderRadius:'6px',padding:'0.4rem 1rem',cursor:'pointer'}}>Save</button>
              <button onClick={() => setIsEditingBio(false)} style={{background:'#ccc',border:'none',borderRadius:'6px',padding:'0.4rem 1rem',cursor:'pointer'}}>Cancel</button>
            </div>
          </>
        ) : (
          <div>
            <p style={{margin:'0 0 0.5rem'}}>{user.bio || 'No bio yet.'}</p>
            {isOwnProfile && <button onClick={() => setIsEditingBio(true)} style={{background:'none',border:'none',color:'#5b72f2',cursor:'pointer',padding:0}}>Edit Bio</button>}
          </div>
        )}
      </div>

      {/* Posts Feed */}
      <h3>Posts</h3>
      {posts.length === 0 ? (
        <p style={{color:'#666',textAlign:'center'}}>No posts to show.</p>
      ) : (
        posts.map(post => (
          <div key={post._id} style={{ background: '#fff', borderRadius: '12px', marginTop: '1rem', padding: '1rem', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'0.5rem'}}>
              <span style={{fontWeight:700}}>{post.author?.name}</span>
              {isOwnProfile && (
                <button onClick={() => handleDeletePost(post._id)} style={{background:'none',border:'none',color:'#e53e3e',cursor:'pointer',fontSize:'0.8rem'}}>Delete</button>
              )}
            </div>
            {post.text && <p style={{margin:'0 0 0.5rem'}}>{post.text}</p>}
            {post.mediaUrl && (
              post.mediaType === 'video' ? 
              <video src={post.mediaUrl} controls style={{width:'100%',borderRadius:'8px'}} /> :
              <img src={post.mediaUrl} alt="" style={{width:'100%',borderRadius:'8px'}} />
            )}
          </div>
        ))
      )}
    </div>
  );
}

export default ProfileScreen;
