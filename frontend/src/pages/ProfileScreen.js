import React, { useState, useEffect } from 'react';
import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'https://pairhaven.onrender.com';

function ProfileScreen() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isFollowing, setIsFollowing] = useState(false);
  const token = localStorage.getItem('token');

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const res = await axios.get(`${API_URL}/api/users/profile/${user?._id || 'me'}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        // Note: Adjust endpoint if your backend uses /api/users/profile without ID for self
        // For now assuming we fetch current user data via a dedicated 'me' endpoint or similar
        // If your backend only has /profile/:id, you need currentUser._id from localStorage
        const storedUser = JSON.parse(localStorage.getItem('user'));
        if(storedUser && storedUser._id) {
             const res = await axios.get(`${API_URL}/api/users/profile/${storedUser._id}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setUser(res.data);
            setIsFollowing(res.data.isFollowing);
        } else {
             // Fallback if no ID in storage, try generic profile endpoint if exists
             const res = await axios.get(`${API_URL}/api/users/profile`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setUser(res.data.user);
        }
       
      } catch (err) {
        console.error("Failed to fetch profile:", err);
      } finally {
        setLoading(false);
      }
    };

    if (token) fetchProfile();
  }, [token]);

  const handleFollow = async () => {
    try {
      const storedUser = JSON.parse(localStorage.getItem('user'));
      await axios.post(`${API_URL}/api/users/follow/${storedUser._id}`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setIsFollowing(true);
      alert('Followed successfully!');
    } catch (err) {
      console.error("Follow failed:", err);
      alert(err.response?.data?.message || 'Failed to follow');
    }
  };

  if (loading) return <div style={{ padding: '2rem', textAlign: 'center' }}>Loading...</div>;
  if (!user) return <div style={{ padding: '2rem', textAlign: 'center' }}>Please log in.</div>;

  return (
    <div style={{ padding: '1rem', paddingBottom: '90px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h2 style={{ margin: 0 }}>{user.name}</h2>
        {!isFollowing && (
          <button onClick={handleFollow} style={{ background: '#5b72f2', color: 'white', border: 'none', borderRadius: '8px', padding: '0.5rem 1rem', cursor: 'pointer' }}>
            Follow
          </button>
        )}
        {isFollowing && <span style={{ color: '#666', fontSize: '0.9rem' }}>✓ Following</span>}
      </div>

      {/* Photos */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', marginBottom: '1.5rem' }}>
        {user.photos && user.photos.length > 0 ? (
          user.photos.map((photo, i) => (
            <img key={i} src={typeof photo === 'string' ? photo : photo.url} alt="" style={{ width: '100%', aspectRatio: '1', objectFit: 'cover', borderRadius: '8px' }} />
          ))
        ) : (
          <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '2rem', background: '#f5f5f5', borderRadius: '8px' }}>No photos</div>
        )}
      </div>

      {/* Details */}
      <div style={{ background: '#f9f9f9', padding: '1rem', borderRadius: '8px', marginBottom: '1rem' }}>
        <p><strong>Age:</strong> {user.age}</p>
        <p><strong>Bio:</strong> {user.bio || 'No bio yet.'}</p>
      </div>

      {/* Likes Section */}
      <div style={{ marginTop: '2rem' }}>
        <h3>Likes Received ({user.likesReceived?.length || 0})</h3>
        {user.likesReceived && user.likesReceived.length > 0 ? (
          user.likesReceived.map((like, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '0.5rem 0', borderBottom: '1px solid #eee' }}>
              <div style={{ width: 30, height: 30, borderRadius: '50%', background: '#ddd', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {(like.from?.name || 'U')[0]}
              </div>
              <span>{like.from?.name || 'Someone'} liked you</span>
            </div>
          ))
        ) : (
          <p style={{ color: '#666' }}>No likes yet.</p>
        )}
      </div>
    </div>
  );
}

export default ProfileScreen;
