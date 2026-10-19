import React, { useState, useEffect } from 'react';
import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'https://pairhaven.onrender.com';

function MatchingScreen() {
  const [profiles, setProfiles] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  
  // Track actions for the CURRENT profile only
  const [hasFollowed, setHasFollowed] = useState(false);
  const [hasLiked, setHasLiked] = useState(false);
  
  const token = localStorage.getItem('token');

  // Reset action states whenever we move to a new profile
  useEffect(() => {
    setHasFollowed(false);
    setHasLiked(false);
  }, [currentIndex]);

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

  // Handle Follow -> Transforms to Checkmark
  const handleFollow = async () => {
    if (currentIndex >= profiles.length || hasFollowed) return;
    const profile = profiles[currentIndex];
    
    try {
      await axios.post(`${API_URL}/api/users/follow/${profile._id}`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setHasFollowed(true); // Instantly update UI
    } catch (err) {
      console.error("Follow failed", err);
      alert(err.response?.data?.message || "Failed to follow");
    }
  };

  // Handle Like -> Transforms to Match/Filled Heart
  const handleLike = async () => {
    if (currentIndex >= profiles.length || hasLiked) return;
    const profile = profiles[currentIndex];
    
    try {
      const res = await axios.post(`${API_URL}/api/users/like/${profile._id}`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      setHasLiked(true); // Instantly update UI
      
      // If it's a mutual match, show alert
      if (res.data.isMatch) {
        alert(`It's a match with ${profile.name}! `);
      }
    } catch (err) {
      console.error("Like failed", err);
      alert(err.response?.data?.message || "Failed to like");
    }
  };

  // Handle Pass/Cancel
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

      {/* DYNAMIC ACTION BUTTONS */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: '1.5rem', marginTop: '1.5rem' }}>
        
        {/* CANCEL / PASS BUTTON (Always visible) */}
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

        {/* FOLLOW BUTTON -> CHECKMARK */}
        <button 
          onClick={handleFollow}
          disabled={hasFollowed}
          style={{ 
            width: '60px', height: '60px', borderRadius: '50%', 
            border: hasFollowed ? '2px solid #3b82f6' : '2px solid #cbd5e1', 
            background: hasFollowed ? '#eff6ff' : '#fff', 
            fontSize: '1.5rem', 
            cursor: hasFollowed ? 'default' : 'pointer', 
            color: hasFollowed ? '#3b82f6' : '#94a3b8',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'all 0.3s ease'
          }}
        >
          {hasFollowed ? '✓' : '👤+'}
        </button>

        {/* LIKE BUTTON -> MATCH / FILLED HEART */}
        <button 
          onClick={handleLike}
          disabled={hasLiked}
          style={{ 
            width: '60px', height: '60px', borderRadius: '50%', 
            border: hasLiked ? '2px solid #e53e3e' : '2px solid #10b981', 
            background: hasLiked ? '#fef2f2' : '#fff', 
            fontSize: '1.5rem', 
            cursor: hasLiked ? 'default' : 'pointer', 
            color: hasLiked ? '#e53e3e' : '#10b981',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'all 0.3s ease'
          }}
        >
          {hasLiked ? '❤️' : '♥'}
        </button>
      </div>
    </div>
  );
}

export default MatchingScreen;
