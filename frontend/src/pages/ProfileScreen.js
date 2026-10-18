import React, { useState, useEffect } from 'react';
import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'https://pairhaven.onrender.com';
const PLACEHOLDER = 'https://via.placeholder.com/400?text=No+Image';

function ProfileScreen() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      setLoading(false);
      return;
    }

    axios.get(`${API_URL}/api/users/profile`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(res => {
        const safeUser = res.data?.user || null;
        setUser(safeUser);
        if (safeUser) localStorage.setItem('user', JSON.stringify(safeUser));
      })
      .catch(err => {
        console.error('Failed to fetch profile:', err);
        try {
          const stored = JSON.parse(localStorage.getItem('user') || 'null');
          if (stored) setUser(stored);
        } catch (_) {}
      })
      .finally(() => setLoading(false));
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
    window.location.href = '/login';
  };

  if (loading) return <div style={{ textAlign: 'center', padding: '2rem' }}>Loading profile...</div>;
  if (!user) {
    return (
      <div style={{ textAlign: 'center', padding: '2rem' }}>
        <p>Please log in again.</p>
        <button onClick={() => window.location.href = '/login'} style={buttonStyle}>
          Go to Login
        </button>
      </div>
    );
  }

  const photos = Array.isArray(user.photos) ? user.photos : [];
  const followers = Array.isArray(user.followers) ? user.followers : [];
  const following = Array.isArray(user.following) ? user.following : [];
  const matches = Array.isArray(user.matches) ? user.matches : [];

  return (
    <div style={{ padding: '1rem', paddingBottom: '90px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h2 style={{ margin: 0 }}>{user.name || 'Profile'}</h2>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button style={buttonStyle}>Edit Profile</button>
          <button onClick={handleLogout} style={{ ...buttonStyle, background: '#e53e3e' }}>
            Log out
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1rem' }}>
        <div style={{
          width: '120px',
          height: '120px',
          borderRadius: '50%',
          background: '#5b72f2',
          color: '#fff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '3rem',
          fontWeight: 700
        }}>
          {(user.name || 'U').charAt(0).toUpperCase()}
        </div>
      </div>

      <div style={{ textAlign: 'center', marginBottom: '1rem' }}>
        <h3 style={{ margin: 0 }}>{user.name || 'Unknown user'}</h3>
        <p style={{ margin: '0.6rem 0 0', color: '#666' }}>{user.bio || 'No bio yet.'}</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '0.75rem', background: '#f0f0f0', padding: '1rem', borderRadius: '12px', marginBottom: '1.5rem' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '1.8rem', fontWeight: 700 }}>{followers.length}</div>
          <div style={{ fontSize: '0.8rem', color: '#666' }}>Followers</div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '1.8rem', fontWeight: 700 }}>{following.length}</div>
          <div style={{ fontSize: '0.8rem', color: '#666' }}>Following</div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '1.8rem', fontWeight: 700 }}>{matches.length}</div>
          <div style={{ fontSize: '0.8rem', color: '#666' }}>Matches</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: '8px', marginBottom: '1rem' }}>
        {photos.length > 0 ? (
          photos.map((photo, i) => {
            const src = typeof photo === 'string' ? photo : photo?.url || photo?.secure_url || PLACEHOLDER;
            return (
              <img
                key={i}
                src={src}
                alt={`${user.name || 'User'} ${i + 1}`}
                style={{ width: '100%', aspectRatio: '1', objectFit: 'cover', borderRadius: '10px' }}
                onError={(e) => { e.currentTarget.src = PLACEHOLDER; }}
              />
            );
          })
        ) : (
          <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '2rem', background: '#fff', borderRadius: '10px', color: '#555' }}>
            No photos uploaded yet.
          </div>
        )}
      </div>

      <div style={{ background: '#fff', borderRadius: '12px', padding: '1rem' }}>
        <p><strong>Age:</strong> {user.age ?? '—'}</p>
        <p><strong>Gender:</strong> {user.gender ?? '—'}</p>
        <p><strong>Bio:</strong> {user.bio || 'No bio provided.'}</p>
      </div>
    </div>
  );
}

const buttonStyle = {
  background: '#5b72f2',
  color: '#fff',
  border: 'none',
  borderRadius: '8px',
  padding: '0.55rem 1rem',
  cursor: 'pointer'
};

export default ProfileScreen;
