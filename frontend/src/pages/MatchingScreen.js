// frontend/src/pages/MatchingScreen.js
import React, { useState, useEffect } from 'react';
import axios from 'axios';

const API_URL = "https://pairhaven.onrender.com";

function MatchingScreen() {
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const token = localStorage.getItem('token');

  useEffect(() => {
    const fetchMatches = async () => {
      try {
        const res = await axios.get(`${API_URL}/api/matches`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setMatches(res.data);
      } catch (err) {
        setError(err.response?.data?.message || 'Failed to load matches');
      } finally {
        setLoading(false);
      }
    };

    if (token) fetchMatches();
  }, [token]);

  if (loading) return <div style={{ textAlign: 'center', padding: '2rem' }}>Loading matches...</div>;
  if (error) return <div style={{ textAlign: 'center', padding: '2rem', color: 'red' }}>{error}</div>;
  if (matches.length === 0) return <div style={{ textAlign: 'center', padding: '2rem' }}>No new matches found. Try adjusting your preferences.</div>;

  return (
    <div style={{ padding: '1rem', paddingBottom: '90px' }}>
      <h2 style={{ textAlign: 'center', marginBottom: '1.5rem' }}>Potential Matches</h2>
      
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '1rem' }}>
        {matches.map(match => (
          <div key={match._id} style={{ 
            background: 'white', 
            borderRadius: '12px', 
            overflow: 'hidden', 
            boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
            cursor: 'pointer'
          }}>
            <img 
              src={match.photos?.[0]?.url || match.photos?.[0] || 'https://via.placeholder.com/150'} 
              alt={match.name}
              style={{ width: '100%', height: '200px', objectFit: 'cover' }}
            />
            <div style={{ padding: '0.8rem' }}>
              <h3 style={{ margin: '0 0 0.3rem', fontSize: '1.1rem' }}>{match.name}, {match.age}</h3>
              <p style={{ margin: 0, color: '#666', fontSize: '0.9rem' }}>{match.bio?.substring(0, 50)}...</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default MatchingScreen;