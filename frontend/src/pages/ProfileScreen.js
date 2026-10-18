import React, { useState, useEffect } from 'react';
import axios from 'axios';

const API_URL = "https://pairhaven.onrender.com";
const PLACEHOLDER = "https://via.placeholder.com/400?text=No+Image";

function ProfileScreen() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Read token inside effect so we don't depend on an external token variable
    const token = localStorage.getItem('token');
    if (!token) {
      setLoading(false);
      return;
    }

    const controller = new AbortController();

    const fetchProfile = async () => {
      try {
        const res = await axios.get(`${API_URL}/api/users/profile`, {
          headers: { Authorization: `Bearer ${token}` },
          signal: controller.signal, // supports AbortController
        });
        setUser(res.data?.user ?? null);
        // Optionally cache a minimal user snapshot for offline fallback
        try {
          const snapshot = JSON.stringify(res.data?.user ?? {});
          localStorage.setItem('user', snapshot);
        } catch (_) { /* ignore storage errors */ }
      } catch (err) {
        // If request was aborted, do nothing
        if (err.name === "CanceledError" || err.name === "AbortError") return;

        console.error("Failed to fetch profile:", err);

        // Fallback: try reading a saved user snapshot safely
        try {
          const stored = localStorage.getItem('user');
          if (stored) setUser(JSON.parse(stored));
        } catch (parseErr) {
          console.warn("No valid user in localStorage", parseErr);
        }
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();

    return () => controller.abort();
  }, []); // run once on mount

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
    // If you use react-router, redirect to login here; fallback:
    window.location.href = '/login';
  };

  if (loading) return <div style={{ textAlign: 'center', padding: '2rem' }}>Loading profile...</div>;
  if (!user) return (
    <div style={{ textAlign: 'center', padding: '2rem' }}>
      Please log in again.
      <div style={{ marginTop: '1rem' }}>
        <button onClick={() => window.location.href = '/login'} style={buttonStyle}>Go to Login</button>
      </div>
    </div>
  );

  const photos = Array.isArray(user.photos) ? user.photos : [];

  return (
    <div style={{ padding: '1rem', paddingBottom: '90px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h2 style={{ margin: 0 }}>{user.name}</h2>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            onClick={() => alert("Edit Profile coming soon!")}
            style={buttonStyle}
            aria-label="Edit profile"
          >
            Edit Profile
          </button>
          <button
            onClick={handleLogout}
            style={{ ...buttonStyle, background: '#e53e3e' }}
            aria-label="Log out"
          >
            Log out
          </button>
        </div>
      </div>

      {/* PHOTO GALLERY - responsive */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))',
          gap: '8px',
          marginBottom: '1.5rem'
        }}
        role="list"
        aria-label="User photos"
      >
        {photos.length > 0 ? (
          photos.map((photo, i) => {
            const src = (typeof photo === 'string') ? photo : (photo?.url || photo?.secure_url || photo?.location);
            return (
              <img
                key={i}
                src={src || PLACEHOLDER}
                alt={`${user.name}'s photo ${i + 1}`}
                style={{ width: '100%', aspectRatio: '1', objectFit: 'cover', borderRadius: '8px' }}
                onError={(e) => { e.currentTarget.src = PLACEHOLDER; }}
                role="listitem"
              />
            );
          })
        ) : (
          <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '2rem', background: '#f5f5f5', borderRadius: '8px' }}>
            No photos uploaded yet.
          </div>
        )}
      </div>

      {/* User Details */}
      <div style={{ background: '#f9f9f9', padding: '1rem', borderRadius: '8px', marginBottom: '1rem' }}>
        <p><strong>Age:</strong> {user.age ?? '—'}</p>
        <p><strong>Gender:</strong> {user.gender ?? '—'}</p>
        <p><strong>Bio:</strong> {user.bio || "No bio provided."}</p>
      </div>

      {/* Stats */}
      <div style={{ display: 'flex', justifyContent: 'space-around', background: '#f9f9f9', padding: '1rem', borderRadius: '8px' }}>
        <div style={{ textAlign: 'center' }}><strong>{user.followers?.length ?? 0}</strong><br />Followers</div>
        <div style={{ textAlign: 'center' }}><strong>{user.following?.length ?? 0}</strong><br />Following</div>
        <div style={{ textAlign: 'center' }}><strong>{user.matches?.length ?? 0}</strong><br />Matches</div>
      </div>
    </div>
  );
}

const buttonStyle = {
  background: '#667eea',
  color: 'white',
  border: 'none',
  borderRadius: '8px',
  padding: '0.5rem 1rem',
  cursor: 'pointer'
};

export default ProfileScreen;