import React, { useState, useEffect } from 'react';
import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'https://pairhaven.onrender.com';

function ProfileScreen({ userId }) { 
  const [user, setUser] = useState(null);
  const [posts, setPosts] = useState([]);
  const [isEditingBio, setIsEditingBio] = useState(false);
  const [bioText, setBioText] = useState('');
  const [loading, setLoading] = useState(true);
  
  const token = localStorage.getItem('token');
  const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
  
  // Determine if viewing self or others
  const targetId = userId || 'me';
  const isOwnProfile = targetId === 'me' || targetId === currentUser._id;

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        // Fetch Profile
        const profileRes = await axios.get(`${API_URL}/api/users/profile/${targetId}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setUser(profileRes.data);
        setBioText(profileRes.data.bio || '');

        // Fetch Posts (respects privacy automatically via backend)
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
  }, [targetId, token]);

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

  if (loading) return <div style={{padding:'2rem', textAlign:'center'}}>Loading...</div>;
  if (!user) return <div style={{padding:'2rem', textAlign:'center'}}>User not found.</div>;

  return (
    <div style={{ padding: '1rem', paddingBottom: '90px', maxWidth: '600px', margin: '0 auto' }}>
      
      {/* HEADER WITH PICTURE, NAME, AGE */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', marginBottom: '1.5rem' }}>
        <img 
          src={user.photos?.[0]?.url || user.photos?.[0] || 'https://via.placeholder.com/100'} 
          alt={user.name}
          style={{ width: 80, height: 80, borderRadius: '50%', objectFit: 'cover', border: '2px solid #eee' }}
        />
        <div style={{ flex: 1 }}>
          <h2 style={{ margin: '0 0 0.3rem' }}>{user.name}</h2>
          <p style={{ margin: 0, color: '#666', fontSize: '0.9rem' }}>
            {user.age ? `${user.age} years old` : ''} 
            {user.location?.address ? ` • ${user.location.address}` : ''}
          </p>
          {isOwnProfile && (
            <button onClick={handleTogglePrivacy} style={{ 
              marginTop: '0.5rem', background: user.isPrivate ? '#e53e3e' : '#10b981', color: '#fff', 
              border: 'none', borderRadius: '6px', padding: '0.3rem 0.8rem', fontSize: '0.8rem', cursor: 'pointer' 
            }}>
              {user.isPrivate ? '🔒 Private' : '🌍 Public'}
            </button>
          )}
        </div>
      </div>

      {/* STATS ROW */}
      <div style={{ display: 'flex', justifyContent: 'space-around', padding: '1rem 0', borderTop: '1px solid #eee', borderBottom: '1px solid #eee', marginBottom: '1.5rem' }}>
        <div style={{textAlign:'center'}}>
          <div style={{fontWeight:700, fontSize:'1.2rem'}}>{posts.length}</div>
          <div style={{fontSize:'0.8rem', color:'#666'}}>Posts</div>
        </div>
        <div style={{textAlign:'center'}}>
          <div style={{fontWeight:700, fontSize:'1.2rem'}}>{user.followersCount}</div>
          <div style={{fontSize:'0.8rem', color:'#666'}}>Followers</div>
        </div>
        <div style={{textAlign:'center'}}>
          <div style={{fontWeight:700, fontSize:'1.2rem'}}>{user.matchesCount}</div>
          <div style={{fontSize:'0.8rem', color:'#666'}}>Matches</div>
        </div>
        {/* HIDE FOLLOWING FOR OTHERS */}
        {isOwnProfile && (
          <div style={{textAlign:'center'}}>
            <div style={{fontWeight:700, fontSize:'1.2rem'}}>{user.followingCount}</div>
            <div style={{fontSize:'0.8rem', color:'#666'}}>Following</div>
          </div>
        )}
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

      {/* POSTS GRID */}
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
