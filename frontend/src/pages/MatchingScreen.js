import React, { useEffect, useState } from 'react';
import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'https://pairhaven.onrender.com';

function MatchingScreen() {
  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchProfiles = async () => {
    const token = localStorage.getItem('token');
    if (!token) {
      setLoading(false);
      return;
    }

    try {
      const res = await axios.get(`${API_URL}/api/matches/random`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      setProfiles(res.data || []);
    } catch (error) {
      console.error('Failed to load matches:', error);
      setProfiles([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfiles();
  }, []);

  const handleAction = async (profileId, action) => {
    const token = localStorage.getItem('token');
    if (!token) return;

    // optimistic UI
    setProfiles(prev => prev.filter(profile => profile._id !== profileId));

    try {
      await axios.post(
        `${API_URL}/api/swipes`,
        { toUserId: profileId, action },
        { headers: { Authorization: `Bearer ${token}` } }
      );
    } catch (error) {
      console.error('Swipe failed:', error);
    }
  };

  if (loading) {
    return <div style={{ textAlign: 'center', padding: '2rem' }}>Loading profiles...</div>;
  }

  if (!profiles.length) {
    return (
      <div style={{ textAlign: 'center', paddingTop: '3rem' }}>
        <h2 style={{ marginBottom: '1rem' }}>Find Matches</h2>
        <div style={{ background: '#e9efff', borderRadius: '16px', padding: '3rem 1rem', minHeight: '280px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <p style={{ margin: 0, fontSize: '1.1rem', color: '#333' }}>No more profiles to show right now.</p>
        </div>

        <div style={{ display: 'flex', justifyContent: 'center', gap: '2rem', marginTop: '2rem' }}>
          <button
            onClick={() => fetchProfiles()}
            style={{ border: '2px solid #f66', borderRadius: '50%', width: '72px', height: '72px', fontSize: '2rem', background: 'transparent', color: '#f66', cursor: 'pointer' }}
          >
            ✕
          </button>
          <button
            onClick={() => fetchProfiles()}
            style={{ border: '2px solid #39c27a', borderRadius: '50%', width: '72px', height: '72px', fontSize: '2rem', background: 'transparent', color: '#39c27a', cursor: 'pointer' }}
          >
            ❤
          </button>
        </div>
      </div>
    );
  }

  const profile = profiles[0];

  return (
    <div style={{ textAlign: 'center', paddingTop: '2rem' }}>
      <h2 style={{ marginBottom: '1.5rem' }}>Find Matches</h2>

      <div style={{ background: '#e9efff', borderRadius: '16px', padding: '1rem', minHeight: '300px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        <img
          src={profile.photos?.[0]?.url || profile.photos?.[0] || 'https://via.placeholder.com/600x700?text=Profile'}
          alt={profile.name}
          style={{ width: '100%', maxHeight: '420px', objectFit: 'cover', borderRadius: '14px', marginBottom: '1rem' }}
        />
        <h3 style={{ margin: 0 }}>{profile.name}, {profile.age}</h3>
        <p style={{ margin: '0.5rem 0 0', color: '#444' }}>{profile.bio || 'No bio provided.'}</p>
      </div>

      <div style={{ display: 'flex', justifyContent: 'center', gap: '2rem', marginTop: '2rem' }}>
        <button
          onClick={() => handleAction(profile._id, 'pass')}
          style={{ border: '2px solid #f66', borderRadius: '50%', width: '80px', height: '80px', fontSize: '2.4rem', background: 'transparent', color: '#f66', cursor: 'pointer' }}
        >
          ✕
        </button>
        <button
          onClick={() => handleAction(profile._id, 'like')}
          style={{ border: '2px solid #39c27a', borderRadius: '50%', width: '80px', height: '80px', fontSize: '2.2rem', background: 'transparent', color: '#39c27a', cursor: 'pointer' }}
        >
          ❤
        </button>
      </div>
    </div>
  );
}

export default MatchingScreen;