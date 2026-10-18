// frontend/src/pages/NotificationsScreen.js
import React, { useState, useEffect } from 'react';
import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'https://pairhaven.onrender.com';

function NotificationsScreen() {
  const [notifications, setNotifications] = useState([]);
  const [unreadMsgCount, setUnreadMsgCount] = useState(0);
  const token = localStorage.getItem('token');

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch Notifications
        const notifRes = await axios.get(`${API_URL}/api/notifications`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setNotifications(notifRes.data || []);

        // Fetch Unread Message Count
        const msgRes = await axios.get(`${API_URL}/api/messages/conversations`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const totalUnread = (msgRes.data || []).reduce((sum, conv) => sum + (conv.unreadCount || 0), 0);
        setUnreadMsgCount(totalUnread);

      } catch (err) {
        console.error("Failed to fetch data", err);
      }
    };

    if (token) fetchData();
  }, [token]);

  return (
    <div style={{ padding: '1rem' }}>
      <h2>Alerts {unreadMsgCount > 0 && <span style={{background:'#e53e3e', color:'#fff', borderRadius:'50%', padding:'2px 8px', fontSize:'0.8rem'}}>{unreadMsgCount}</span>}</h2>
      
      {notifications.length === 0 ? (
        <div style={{ textAlign: 'center', color: '#666', marginTop: '2rem' }}>No new notifications.</div>
      ) : (
        notifications.map(note => (
          <div key={note._id} style={{ background: '#fff', padding: '1rem', borderRadius: '8px', marginBottom: '0.8rem', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
            <div style={{ fontWeight: 'bold', marginBottom: '0.3rem' }}>
              {note.type === 'like' && '❤️ New Like'}
              {note.type === 'follow' && '👤 New Follower'}
              {note.type === 'match' && '💖 It\'s a Match!'}
            </div>
            <div style={{ color: '#444' }}>{note.message}</div>
            <div style={{ fontSize: '0.75rem', color: '#999', marginTop: '0.5rem' }}>
              {new Date(note.createdAt).toLocaleString()}
            </div>
          </div>
        ))
      )}
    </div>
  );
}

export default NotificationsScreen;
