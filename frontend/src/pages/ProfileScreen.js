import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

const API_URL = process.env.REACT_APP_API_URL || 'https://pairhaven.onrender.com';

function ProfileScreen({ userId }) {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [posts, setPosts] = useState([]);
  const [isEditingBio, setIsEditingBio] = useState(false);
  const [bioText, setBioText] = useState('');
  const [loading, setLoading] = useState(true);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  
  // Post Creation State
  const [showPostModal, setShowPostModal] = useState(false);
  const [newPostText, setNewPostText] = useState('');
  const [newPostMedia, setNewPostMedia] = useState(null);
  const [posting, setPosting] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

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

  // Match Request Handlers
  const handleSendRequest = async () => {
    setActionLoading(true);
    try {
      await axios.post(`${API_URL}/api/users/request/${user._id}`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setUser(prev => ({ 
        ...prev, 
        requestsSent: [...(prev.requestsSent || []), currentUser._id] 
      }));
      alert("Match request sent!");
    } catch (err) { 
      alert(err.response?.data?.message || "Failed to send request"); 
    } finally {
      setActionLoading(false);
    }
  };

  const handleAcceptRequest = async () => {
    setActionLoading(true);
    try {
      await axios.post(`${API_URL}/api/users/accept-request/${user._id}`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setUser(prev => ({ 
        ...prev, 
        matches: [...(prev.matches || []), currentUser._id],
        requestsReceived: (prev.requestsReceived || []).filter(id => id !== currentUser._id)
      }));
      alert("Match accepted! You can now chat.");
    } catch (err) { 
      alert(err.response?.data?.message || "Failed to accept request"); 
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeclineRequest = async () => {
    setActionLoading(true);
    try {
      await axios.delete(`${API_URL}/api/users/request/${user._id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setUser(prev => ({ 
        ...prev, 
        requestsReceived: (prev.requestsReceived || []).filter(id => id !== currentUser._id)
      }));
    } catch (err) { 
      alert("Failed to decline request"); 
    } finally {
      setActionLoading(false);
    }
  };

  const handleOpenChat = () => {
    localStorage.setItem('activeTab', 'messages');
    window.location.hash = '/';
  };

  const handleCreatePost = async () => {
  if (!newPostText.trim() && !newPostMedia) return;
  setPosting(true);
  
  const formData = new FormData();
  formData.append('text', newPostText);
  if (newPostMedia) {
    formData.append('media', newPostMedia); // Send File object directly
  }
  
  try {
    const res = await axios.post(`${API_URL}/api/posts`, formData, {
      headers: { 
        Authorization: `Bearer ${token}`,
        'Content-Type': 'multipart/form-data' // Required for file uploads
      }
    });
    
    setPosts(prev => [res.data, ...prev]);
    setNewPostText('');
    setNewPostMedia(null);
    setShowPostModal(false);
  } catch (err) {
    alert(err.response?.data?.message || "Failed to create post");
  } finally {
    setPosting(false);
  }
};

  const handlePhotoUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploadingPhoto(true);
    const formData = new FormData();
    formData.append('photo', file);
    try {
      const res = await axios.patch(`${API_URL}/api/users/profile/me/photo`, formData, {
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'multipart/form-data' }
      });
      setUser(prev => ({ ...prev, photos: [res.data.photoUrl] }));
      alert("Profile picture updated!");
    } catch (err) {
      alert(err.response?.data?.message || "Failed to update photo");
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleSaveBio = async () => {
    try {
      await axios.patch(`${API_URL}/api/users/profile/me`, { bio: bioText }, { headers: { Authorization: `Bearer ${token}` } });
      setUser(prev => ({ ...prev, bio: bioText }));
      setIsEditingBio(false);
    } catch (err) { alert("Failed to update bio"); }
  };

  const handleTogglePrivacy = async () => {
    try {
      const newStatus = !user.isPrivate;
      await axios.patch(`${API_URL}/api/users/profile/me`, { isPrivate: newStatus }, { headers: { Authorization: `Bearer ${token}` } });
      setUser(prev => ({ ...prev, isPrivate: newStatus }));
    } catch (err) { alert("Failed to update privacy"); }
  };

  const handleDeletePost = async (postId) => {
    if (!window.confirm("Delete this post?")) return;
    try {
      await axios.delete(`${API_URL}/api/posts/${postId}`, { headers: { Authorization: `Bearer ${token}` } });
      setPosts(prev => prev.filter(p => p._id !== postId));
    } catch (err) { alert("Failed to delete post"); }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    delete axios.defaults.headers.common['Authorization'];
    navigate('/login', { replace: true });
  };

  const getAvatarUrl = () => {
    if (!user?.photos) return 'https://via.placeholder.com/100';
    const photo = user.photos[0];
    return typeof photo === 'string' ? photo : photo.url;
  };

  if (loading) return <div style={{padding:'2rem', textAlign:'center'}}>Loading...</div>;
  if (!user) return <div style={{padding:'2rem', textAlign:'center'}}>User not found.</div>;

  return (
    <div style={{ padding: '1rem', paddingBottom: '90px', position: 'relative' }}>
      
      {/* POST MODAL */}
      {showPostModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div style={{ background: '#fff', borderRadius: '16px', width: '100%', maxWidth: '400px', maxHeight: '80vh', overflowY: 'auto', padding: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ margin: 0 }}>New Post</h3>
              <button onClick={() => setShowPostModal(false)} style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer' }}></button>
            </div>
            <textarea value={newPostText} onChange={e => setNewPostText(e.target.value)} placeholder="What's on your mind?" rows="4" style={{ width: '100%', border: '1px solid #ddd', borderRadius: '8px', padding: '0.8rem', resize: 'none', fontSize: '1rem', boxSizing: 'border-box' }} />
            {newPostMedia && (
              <div style={{ marginTop: '1rem', position: 'relative' }}>
                <img src={URL.createObjectURL(newPostMedia)} alt="Preview" style={{ width: '100%', borderRadius: '8px', maxHeight: '200px', objectFit: 'cover' }} />
                <button onClick={() => setNewPostMedia(null)} style={{ position: 'absolute', top: '-8px', right: '-8px', background: '#fff', border: '1px solid #ddd', borderRadius: '50%', width: '24px', height: '24px', cursor: 'pointer' }}>×</button>
              </div>
            )}
            <div style={{ marginTop: '1rem', display: 'flex', gap: '1rem', alignItems: 'center' }}>
              <label style={{ cursor: 'pointer', color: '#5b72f2', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
                📷 Add Photo
                <input type="file" accept="image/*" onChange={e => setNewPostMedia(e.target.files[0])} style={{ display: 'none' }} />
              </label>
              <button onClick={handleCreatePost} disabled={posting || (!newPostText.trim() && !newPostMedia)} style={{ marginLeft: 'auto', background: '#5b72f2', color: '#fff', border: 'none', borderRadius: '20px', padding: '0.6rem 1.5rem', fontWeight: 600, cursor: posting ? 'wait' : 'pointer', opacity: posting ? 0.7 : 1 }}>
                {posting ? 'Posting...' : 'Share'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* FLOATING "+" BUTTON */}
      {isOwnProfile && (
        <button onClick={() => setShowPostModal(true)} style={{ position: 'fixed', bottom: '90px', left: '20px', background: '#5b72f2', color: '#fff', border: 'none', borderRadius: '50%', width: '56px', height: '56px', fontSize: '2rem', cursor: 'pointer', boxShadow: '0 4px 12px rgba(91, 114, 242, 0.4)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'transform 0.2s' }} onMouseOver={e => e.target.style.transform = 'scale(1.1)'} onMouseOut={e => e.target.style.transform = 'scale(1)'}>+</button>
      )}

      {/* LOGOUT BUTTON */}
      {isOwnProfile && (
        <button onClick={handleLogout} style={{ position: 'fixed', bottom: '90px', right: '20px', background: '#fff', color: '#e53e3e', border: '1px solid #fee2e2', borderRadius: '50px', padding: '0.6rem 1.2rem', fontSize: '0.9rem', fontWeight: 600, cursor: 'pointer', boxShadow: '0 4px 12px rgba(229, 62, 62, 0.15)', zIndex: 100, display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span>🚪</span> Logout
        </button>
      )}

      {/* PROFILE PICTURE SECTION */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '1.5rem', position: 'relative' }}>
        <div style={{ position: 'relative' }}>
          <img src={getAvatarUrl()} alt={user.name} style={{ width: 100, height: 100, borderRadius: '50%', objectFit: 'cover', border: '3px solid #fff', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }} />
          {isOwnProfile && (
            <label style={{ position: 'absolute', bottom: 0, right: 0, background: '#5b72f2', color: '#fff', borderRadius: '50%', width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: uploadingPhoto ? 'wait' : 'pointer', border: '2px solid #fff', fontSize: '1rem' }}>
              📷
              <input type="file" accept="image/*" onChange={handlePhotoUpload} disabled={uploadingPhoto} style={{ display: 'none' }} />
            </label>
          )}
        </div>
        <h2 style={{ margin: '0.8rem 0 0.3rem', textAlign: 'center' }}>{user.name}</h2>
        <p style={{ margin: 0, color: '#666', fontSize: '0.9rem', textAlign: 'center' }}>
          {user.age ? `${user.age} years old` : ''} 
          {user.location?.address ? ` • ${user.location.address}` : ''}
        </p>
        
        {/* MATCH ACTION BUTTONS */}
        {!isOwnProfile && (
          <div style={{ display: 'flex', gap: '10px', marginTop: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
            {currentUser.requestsSent?.includes(user._id) && (
              <button disabled style={{ background: '#ccc', color: '#fff', border: 'none', borderRadius: '20px', padding: '0.6rem 1.5rem', cursor: 'not-allowed', fontSize: '0.9rem' }}>⏳ Request Sent</button>
            )}

            {currentUser.requestsReceived?.includes(user._id) && (
              <>
                <button onClick={handleAcceptRequest} disabled={actionLoading} style={{ background: '#10b981', color: '#fff', border: 'none', borderRadius: '20px', padding: '0.6rem 1.5rem', cursor: actionLoading ? 'wait' : 'pointer', fontSize: '0.9rem' }}>✅ Accept Match</button>
                <button onClick={handleDeclineRequest} disabled={actionLoading} style={{ background: '#e53e3e', color: '#fff', border: 'none', borderRadius: '20px', padding: '0.6rem 1.5rem', cursor: actionLoading ? 'wait' : 'pointer', fontSize: '0.9rem' }}>❌ Decline</button>
              </>
            )}

            {currentUser.matches?.includes(user._id) && (
              <button onClick={handleOpenChat} style={{ background: '#5b72f2', color: '#fff', border: 'none', borderRadius: '20px', padding: '0.6rem 1.5rem', cursor: 'pointer', fontSize: '0.9rem' }}>💬 Message</button>
            )}

            {!currentUser.requestsSent?.includes(user._id) && 
             !currentUser.requestsReceived?.includes(user._id) && 
             !currentUser.matches?.includes(user._id) && (
              <button onClick={handleSendRequest} disabled={actionLoading} style={{ background: '#5b72f2', color: '#fff', border: 'none', borderRadius: '20px', padding: '0.6rem 1.5rem', cursor: actionLoading ? 'wait' : 'pointer', fontSize: '0.9rem' }}>❤️ Send Match Request</button>
            )}
          </div>
        )}

        {isOwnProfile && (
          <button onClick={handleTogglePrivacy} style={{ marginTop: '0.8rem', background: user.isPrivate ? '#e53e3e' : '#10b981', color: '#fff', border: 'none', borderRadius: '20px', padding: '0.4rem 1rem', cursor: 'pointer', fontSize: '0.85rem' }}>
            {user.isPrivate ? '🔒 Private' : ' Public'}
          </button>
        )}
      </div>

      {/* STATS ROW */}
      <div style={{ display: 'flex', justifyContent: 'space-around', padding: '1rem 0', borderTop: '1px solid #eee', borderBottom: '1px solid #eee', marginBottom: '1.5rem' }}>
        <div style={{textAlign:'center'}}><strong>{posts.length}</strong><br/><span style={{fontSize:'0.8rem',color:'#666'}}>Posts</span></div>
        <div style={{textAlign:'center'}}><strong>{user.matchesCount || 0}</strong><br/><span style={{fontSize:'0.8rem',color:'#666'}}>Matches</span></div>
      </div>

      {/* BIO SECTION */}
      <div style={{ background: '#f9f9f9', padding: '1rem', borderRadius: '8px', marginBottom: '1.5rem' }}>
        {isEditingBio ? (
          <>
            <textarea value={bioText} onChange={e => setBioText(e.target.value)} rows="3" style={{width:'100%',border:'1px solid #ddd',borderRadius:'8px',padding:'0.5rem', boxSizing: 'border-box'}} />
            <div style={{marginTop:'0.5rem',display:'flex',gap:'0.5rem'}}>
              <button onClick={handleSaveBio} style={{background:'#5b72f2',color:'#fff',border:'none',borderRadius:'6px',padding:'0.4rem 1rem',cursor:'pointer'}}>Save</button>
              <button onClick={() => setIsEditingBio(false)} style={{background:'#ccc',border:'none',borderRadius:'6px',padding:'0.4rem 1rem',cursor:'pointer'}}>Cancel</button>
            </div>
          </>
        ) : (
          <div>
            <p style={{margin:'0 0 0.5rem', lineHeight: '1.5'}}>{user.bio || 'No bio yet.'}</p>
            {isOwnProfile && <button onClick={() => setIsEditingBio(true)} style={{background:'none',border:'none',color:'#5b72f2',cursor:'pointer',padding:0, fontWeight: 600}}>Edit Bio</button>}
          </div>
        )}
      </div>

      {/* ✅ CLEAN POSTS GRID - SYNTAX VERIFIED */}
      <h3 style={{ marginBottom: '1rem' }}>Posts</h3>
      {posts.length === 0 ? (
        <div style={{ textAlign: 'center', color: '#999', padding: '2rem' }}>
          {isOwnProfile ? "You haven't posted anything yet." : "No public posts to show."}
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '4px' }}>
          {posts.map(post => {
            const hasText = post.text && post.text.trim().length > 0;
            const hasMedia = post.mediaUrl && post.mediaUrl !== 'null';
            const isVideo = hasMedia && (post.mediaType === 'video' || post.mediaUrl.includes('/video/upload'));

            return (
              <div key={post._id} style={{ aspectRatio: '1', overflow: 'hidden', background: '#f5f5f5', position: 'relative' }}>
                {hasText && !hasMedia && (
                  <div style={{ padding: '10px', fontSize: '0.7rem', display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', wordBreak: 'break-word', height: '100%', background: '#fff' }}>
                    {post.text.substring(0, 50)}{post.text.length > 50 ? '...' : ''}
                  </div>
                )}
                {hasMedia && (
                  isVideo ? (
                    <video src={post.mediaUrl} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <img src={post.mediaUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                      onError={(e) => { e.target.style.display = 'none'; }} 
                    />
                  )
                )}
                {isOwnProfile && (
                  <button onClick={() => handleDeletePost(post._id)} style={{ 
                    position: 'absolute', top: '5px', right: '5px', background: 'rgba(0,0,0,0.6)', color: '#fff', border: 'none', borderRadius: '50%', width: '24px', height: '24px', cursor: 'pointer', fontSize: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' 
                  }}>×</button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default ProfileScreen;
