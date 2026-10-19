import React, { useState, useEffect } from 'react';
import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'https://pairhaven.onrender.com';

function MatchingScreen() {
  const [profiles, setProfiles] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const token = localStorage.getItem('token');

  useEffect(() => {
    fetchProfiles();
  }, []);

  const fetchProfiles = async () => {
    try {
      const res = await axios.get(`${API_URL}/api/matches/random`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setProfiles(res.data);
      setCurrentIndex(0);
    } catch (err) {
      console.error("Failed to load matches", err);
    } finally {
      setLoading(false);
    }
  };

  // EXISTING: Handle Like (Heart Button)
  const handleLike = async () => {
    if (currentIndex >= profiles.length) return;
    const profile = profiles[currentIndex];
    
    try {
      await axios.post(`${API_URL}/api/users/like/${profile._id}`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      // Move to next profile after liking
      setCurrentIndex(prev => prev + 1);
    } catch (err) {
      console.error("Like failed", err);
      alert(err.response?.data?.message || "Failed to like");
    }
  };

  // NEW: Handle Follow (Plus/Follow Button)
  const handleFollow = async () => {
    if (currentIndex >= profiles.length) return;
    const profile = profiles[currentIndex];
    
    try {
      await axios.post(`${API_URL}/api/users/follow/${profile._id}`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      alert(`Successfully followed ${profile.name}!`);
      // Optional: Move to next profile or stay on same one
      // setCurrentIndex(prev => prev + 1); 
    } catch (err) {
      console.error("Follow failed", err);
      alert(err.response?.data?.message || "Failed to follow");
    }
  };

  // EXISTING: Handle Pass/Cancel (X Button)
  const handlePass = () => {
    if (currentIndex < profiles.length) {
      setCurrentIndex(prev => prev + 1);
    }
  };

  if (loading) return <div style={{padding:'2rem', textAlign:'center'}}>Loading...</div>;

  // Empty State
  if (profiles.length === 0 || currentIndex >= profiles.length) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <h3>Find Matches</h3>
        <div style={{ background: '#eef2ff', borderRadius: '16px', padding: '4rem 2rem', margin: '1rem 0' }}>
          <p>No more profiles to show right now.</p>
        </div>
        <button onClick={fetchProfiles} style={{marginTop:'1rem', padding:'0.5rem 1rem', background:'#5b72f2', color:'#fff', border:'none', borderRadius:'8px'}}>
          Refresh
        </button>
      </div>
    );
  }

  const currentProfile = profiles[currentIndex];

  return (
    <div style={{ padding: '1rem', textAlign: 'center', paddingBottom: '90px' }}>
      <h3>Find Matches</h3>
      
      {/* Profile Card */}
      <div style={{ 
        background: '#fff', borderRadius: '16px', overflow: 'hidden', 
        boxShadow: '0 4px 12px rgba(0,0,0,0.1)', margin: '1rem auto', maxWidth: '400px'
      }}>
        <img 
          src={currentProfile.photos?.[0]?.url || currentProfile.photos?.[0] || 'https://via.placeholder.com/400'} 
          alt={currentProfile.name}
          style={{ width: '100%', height: '400px', objectFit: 'cover' }}
        />
        <div style={{ padding: '1.5rem', textAlign: 'left' }}>
          <h2 style={{ margin: '0 0 0.5rem' }}>{currentProfile.name}, {currentProfile.age}</h2>
          <p style={{ color: '#666', margin: '0 0 1rem' }}>{currentProfile.bio || 'No bio yet.'}</p>
        </div>
      </div>

      {/* ACTION BUTTONS: Cancel, Follow, Like */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: '1.5rem', marginTop: '1.5rem' }}>
        
        {/* CANCEL / PASS BUTTON */}
        <button 
          onClick={handlePass}
          style={{ 
            width: '60px', height: '60px', borderRadius: '50%', 
            border: '2px solid #ef4444', background: '#fff', 
            fontSize: '1.5rem', cursor: 'pointer', color: '#ef4444',
            display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}
        >
          ✕
        </button>

        {/* NEW: FOLLOW BUTTON */}
        <button 
          onClick={handleFollow}
          style={{ 
            width: '60px', height: '60px', borderRadius: '50%', 
            border: '2px solid #3b82f6', background: '#fff', 
            fontSize: '1.5rem', cursor: 'pointer', color: '#3b82f6',
            display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}
        >
          👤+
        </button>

        {/* LIKE BUTTON */}
        <button 
          onClick={handleLike}
          style={{ 
            width: '60px', height: '60px', borderRadius: '50%', 
            border: '2px solid #10b981', background: '#fff', 
            fontSize: '1.5rem', cursor: 'pointer', color: '#10b981',
            display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}
        >
          ♥
        </button>
      </div>
    </div>
  );
}

export default MatchingScreen;
