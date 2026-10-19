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

  // ✅ RESTORED: Change Profile Picture Handler
  const handlePhotoUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setUploadingPhoto(true);
    const formData = new FormData();
    formData.append('photo', file);

    try {
      const res = await axios.patch(`${API_URL}/api/users/profile/me/photo`, formData, {
        headers: { 
          Authorization: `Bearer ${token}`,
          'Content-Type': 'multipart/form-data'
        }
      });
      
      // Update local state with new photo
      setUser(prev => ({
        ...prev,
        photos: [res.data.photoUrl] // Adjust based on your backend response
      }));
      alert("Profile picture updated!");
    } catch (err) {
      console.error("Photo upload failed", err);
      alert(err.response?.data?.message || "Failed to update photo");
    } finally {
      setUploadingPhoto(false);
    }
  };

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

  // ✅ RESTORED: Logout Handler
  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    delete axios.defaults.headers.common['Authorization'];
    navigate('/login', { replace: true });
  };

  // Helper for safe avatar URL
  const getAvatarUrl = () => {
    if (!user?.photos) return 'https://via.placeholder.com/100';
    const photo = user.photos[0];
    return typeof photo === 'string' ? photo : photo.url;
  };

  if (loading) return <div style={{padding:'2rem', textAlign:'center'}}>Loading...</div>;
  if (!user) return <div style={{padding:'2rem', textAlign:'center'}}>User not found.</div>;

  return (
    <div style={{ padding: '1rem', paddingBottom: '90px', position: 'relative' }}>
      
      {/* ✅ FIXED LOGOUT BUTTON: Bottom right, only on own profile */}
      {isOwnProfile && (
        <button 
          onClick={handleLogout}
          style={{
            position: 'fixed',
            bottom: '90px',
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

      {/* ✅ RESTORED: Profile Picture Section */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '1.5rem', position: 'relative' }}>
        <div style={{ position: 'relative' }}>
          <img 
            src={getAvatarUrl()} 
            alt={user.name}
            style={{ 
              width: 100, height: 100, borderRadius: '50%', objectFit: 'cover', 
              border: '3px solid #fff', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' 
            }}
          />
          {/* ✅ Change Photo Button (Only on own profile) */}
          {isOwnProfile && (
            <label 
              style={{
                position: 'absolute', bottom: 0, right: 0,
                background: '#5b72f2', color: '#fff',
                borderRadius: '50%', width: 32, height: 32,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: uploadingPhoto ? 'wait' : 'pointer',
                border: '2px solid #fff', fontSize: '1rem'
              }}
            >
              📷
              <input 
                type="file" 
                accept="image/*" 
                onChange={handlePhotoUpload} 
                disabled={uploadingPhoto}
                style={{ display: 'none' }} 
              />
            </label>
          )}
        </div>
        
        <h2 style={{ margin: '0.8rem 0 0.3rem', textAlign: 'center' }}>{user.name}</h2>
        <p style={{ margin: 0, color: '#666', fontSize: '0.9rem', textAlign: 'center' }}>
          {user.age ? `${user.age} years old` : ''} 
          {user.location?.address ? ` • ${user.location.address}` : ''}
        </p>
        
        {/* Privacy Toggle (Only on own profile) */}
        {isOwnProfile && (
          <button onClick={handleTogglePrivacy} style={{ 
            marginTop: '0.8rem', background: user.isPrivate ? '#e53e3e' : '#10b981', color: '#fff', 
            border: 'none', borderRadius: '20px', padding: '0.4rem 1rem', cursor: 'pointer', fontSize: '0.85rem'
          }}>
            {user.isPrivate ? '🔒 Private' : '🌍 Public'}
          </button>
        )}
      </div>

      {/* Stats Row */}
      <div style={{ display: 'flex', justifyContent: 'space-around', padding: '1rem 0', borderTop: '1px solid #eee', borderBottom: '1px solid #eee', marginBottom: '1.5rem' }}>
        <div style={{textAlign:'center'}}><strong>{posts.length}</strong><br/><span style={{fontSize:'0.8rem',color:'#666'}}>Posts</span></div>
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

      {/* Posts Grid */}
      <h3 style={{ marginBottom: '1rem' }}>Posts</h3>
      {posts.length === 0 ? (
        <div style={{ textAlign: 'center', color: '#999', padding: '2rem' }}>
          {isOwnProfile ? "You haven't posted anything yet." : "No public posts to show."}
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '4px' }}>
          {posts.map(post => (
            <div key={post._id} style={{ aspectRatio: '1', overflow: 'hidden', background: '#f5f5f5', position: 'relative' }}>
              {post.mediaUrl ? (
                post.mediaType === 'video' ? (
                  <video src={post.mediaUrl} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <img src={post.mediaUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                )
              ) : (
                <div style={{ padding: '10px', fontSize: '0.7rem', display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', wordBreak: 'break-word' }}>
                  {post.text?.substring(0, 50)}...
                </div>
              )}
              
              {/* Delete button overlay for own posts */}
              {isOwnProfile && (
                <button 
                  onClick={() => handleDeletePost(post._id)} 
                  style={{ 
                    position: 'absolute', top: '5px', right: '5px', 
                    background: 'rgba(0,0,0,0.6)', color: '#fff', border: 'none', 
                    borderRadius: '50%', width: '24px', height: '24px', 
                    cursor: 'pointer', fontSize: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center'
                  }}
                >
                  ×
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default ProfileScreen;
