import React, { useState, useEffect } from 'react';
import axios from 'axios';

const API_URL = "https://pairhaven.onrender.com";

function ProfileScreen() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const token = localStorage.getItem('token');

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const res = await axios.get(`${API_URL}/api/users/profile`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setUser(res.data.user);
      } catch (err) {
        console.error("Failed to fetch profile:", err);
        // Fallback to localStorage if API fails
        setUser(JSON.parse(localStorage.getItem('user')));
      } finally {
        setLoading(false);
      }
    };

    if (token) fetchProfile();
  }, [token]);

  if (loading) return <div style={{ textAlign: 'center', padding: '2rem' }}>Loading profile...</div>;
  if (!user) return <div style={{ textAlign: 'center', padding: '2rem' }}>Please log in again.</div>;

  return (
    <div style={{ padding: '1rem', paddingBottom: '90px' }}>
      {/* Profile Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h2 style={{ margin: 0 }}>{user.name}</h2>
        <button 
          onClick={() => alert("Edit Profile feature coming next!")}
          style={{ 
            background: '#667eea', color: 'white', border: 'none', 
            borderRadius: '8px', padding: '0.5rem 1rem', cursor: 'pointer' 
          }}
        >
          Edit Profile
        </button>
      </div>

      {/* Photo Gallery */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', marginBottom: '1.5rem' }}>
        {user.photos && user.photos.length > 0 ? (
          user.photos.map((photo, i) => (
            <img 
              key={i} 
              src={typeof photo === 'string' ? photo : photo.url} 
              alt={`${user.name}'s photo ${i + 1}`}
              style={{ width: '100%', aspectRatio: '1', objectFit: 'cover', borderRadius: '8px' }}
            />
          ))
        ) : (
          <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '2rem', background: '#f5f5f5', borderRadius: '8px' }}>
            No photos uploaded yet.
          </div>
        )}
      </div>

      {/* User Details */}
      <div style={{ background: '#f9f9f9', padding: '1rem', borderRadius: '8px', marginBottom: '1rem' }}>
        <p><strong>Age:</strong> {user.age}</p>
        <p><strong>Gender:</strong> {user.gender}</p>
        <p><strong>Bio:</strong> {user.bio || "No bio provided."}</p>
      </div>

      {/* Stats */}
      <div style={{ display: 'flex', justifyContent: 'space-around', background: '#f9f9f9', padding: '1rem', borderRadius: '8px' }}>
        <div style={{ textAlign: 'center' }}><strong>{user.followers?.length || 0}</strong><br/>Followers</div>
        <div style={{ textAlign: 'center' }}><strong>{user.following?.length || 0}</strong><br/>Following</div>
        <div style={{ textAlign: 'center' }}><strong>{user.matches?.length || 0}</strong><br/>Matches</div>
      </div>
    </div>
  );
}

export default ProfileScreen;