import React, { useState, useEffect } from 'react';
import axios from 'axios';

const API_URL = 'https://pairhaven.onrender.com';

export default function DiscoverySwipe({}) {
  const [cards, setCards] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    axios.get(`${API_URL}/api/matches/random`, { headers: { Authorization: `Bearer ${token}` } })
      .then(res => setCards(res.data))
      .catch(err => console.error(err))
      .finally(() => setLoading(false));
  }, []);

  const handleAction = async (toUserId, action) => {
    const token = localStorage.getItem('token');
    // optimistic UI: remove card locally
    setCards(prev => prev.filter(c => c._id !== toUserId));
    try {
      await axios.post(`${API_URL}/api/swipes`, { toUserId, action }, { headers: { Authorization: `Bearer ${token}` } });
    } catch (err) {
      console.error('Swipe failed', err);
      // TODO: consider restoring the card on failure
    }
  };

  if (loading) return <div>Loading...</div>;
  if (cards.length === 0) return <div>No more profiles</div>;

  return (
    <div>
      {cards.map(card => (
        <div key={card._id} style={{ border: '1px solid #eee', padding: 12, marginBottom: 12 }}>
          <img src={card.photos?.[0]?.url || card.photos?.[0] || 'https://via.placeholder.com/300'} style={{ width: '100%', height: 300, objectFit: 'cover' }} alt="profile" />
          <h4>{card.name}, {card.age}</h4>
          <p>{card.bio}</p>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => handleAction(card._id, 'pass')}>Pass</button>
            <button onClick={() => handleAction(card._id, 'like')}>Like</button>
          </div>
        </div>
      ))}
    </div>
  );
}
