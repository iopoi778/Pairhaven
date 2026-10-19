import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

const API_URL = process.env.REACT_APP_API_URL || 'https://pairhaven.onrender.com';

function NotificationsScreen() {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const token = localStorage.getItem('token');
  const navigate = useNavigate();

  useEffect(() => {
    const fetchNotifications = async () => {
      try {
        const res = await axios.get(`${API_URL}/api/notifications`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setNotifications(res.data || []);
      } catch (err) {
        console.error("Failed to fetch notifications:", err);
      } finally {
        setLoading(false);
      }
    };

    if (token) fetchNotifications();
  }, [token]);

  const handleNotificationClick = async (note) => {
    // ✅ FIX: Use PUT instead of PATCH to avoid 404s
    try {
      await axios.put(`${API_URL}/api/notifications/${note._id}/read`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      setNotifications(prev => prev.map(n => 
        n._id === note._id ? { ...n, read: true } : n
      ));
    } catch (err) { 
      console.error("Mark read failed", err); 
    }

    // Navigate based on type
    if (note.type === 'message') {
      localStorage.setItem('activeTab', 'messages');
      window.location.hash = '/';
    } else if (['like', 'match', 'follow', 'match_request', 'match_accepted'].includes(note.type)) {
      const senderId = note.sender?._id || note.sender;
      if (senderId) window.location.hash = `/profile/${senderId}`;
    }
  };

  if (loading) return <div style={{ padding: '2rem', textAlign: 'center' }}>Loading alerts...</div>;

  return (
    <div style={{ padding: '1rem' }}>
      <h2>Alerts</h2>
      {notifications.length === 0 ? (
        <div style={{ textAlign: 'center', color: '#666', marginTop: '2rem' }}>
          No new notifications.
        </div>
      ) : (
        notifications.map(note => {
          const isRead = note.read === true; 
          
          return (
            <div 
              key={note._id} 
              onClick={() => handleNotificationClick(note)}
              style={{ 
                background: isRead ? '#fff' : '#f0f7ff',
                padding: '1rem', 
                borderRadius: '8px', 
                marginBottom: '0.8rem', 
                boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                cursor: 'pointer',
                borderLeft: isRead ? '4px solid transparent' : '4px solid #5b72f2',
                transition: 'all 0.2s'
              }}
            >
              <div style={{ fontWeight: 'bold', marginBottom: '0.3rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                {!isRead && <span style={{width: 8, height: 8, background: '#5b72f2', borderRadius: '50%'}}></span>}
                {note.type === 'like' && '❤️ New Like'}
                {note.type === 'follow' && '👤 New Follower'}
                {note.type === 'match' && ' It\'s a Match!'}
                {note.type === 'message' && '💬 New Message'}
                {note.type === 'match_request' && '💌 Match Request'}
                {note.type === 'match_accepted' && '💖 Match Accepted'}
                {!['like','follow','match','message','match_request','match_accepted'].includes(note.type) && '🔔 Notification'}
              </div>
              <div style={{ color: '#444' }}>{note.message}</div>
              <div style={{ fontSize: '0.75rem', color: '#999', marginTop: '0.5rem' }}>
                {new Date(note.createdAt).toLocaleString()}
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}

export default NotificationsScreen;
