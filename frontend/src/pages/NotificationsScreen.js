import React, { useState, useEffect } from 'react';
import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'https://pairhaven.onrender.com';

function NotificationsScreen() {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState(null);
  const token = localStorage.getItem('token');

  useEffect(() => {
    const fetchData = async () => {
      try {
        // 1. Fetch User Profile to verify plan tier
        const userRes = await axios.get(`${API_URL}/api/users/profile/me`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setCurrentUser(userRes.data);

        // 2. Fetch Notifications
        const notifRes = await axios.get(`${API_URL}/api/notifications`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setNotifications(notifRes.data || []);
      } catch (err) {
        console.error("Failed to fetch notification data:", err);
      } finally {
        setLoading(false);
      }
    };

    if (token) fetchData();
  }, [token]);

  const handleNotificationClick = async (note) => {
    // Check if user is on Pro or Unlimited plan
    const isPaidUser = currentUser?.isVip || ['pro', 'unlimited'].includes(currentUser?.membershipTier);
    const isLockedType = ['like', 'match', 'match_request'].includes(note.type) && !isPaidUser;

    if (isLockedType) {
      const confirmAd = window.confirm(
        "🔒 This notification is locked!\n\nUpgrade to Pro/Unlimited or watch a quick ad to blur-reveal who liked or matched with you."
      );

      if (confirmAd) {
        alert("Playing reward ad... (Simulated)");
        setTimeout(() => {
          alert("Ad completed! Unlocking notification...");
          const senderId = note.sender?._id || note.sender || note.metadata?.newUserId;
          if (senderId) {
            window.location.hash = `/profile/${senderId}`;
          }
        }, 2000);
      }
      return;
    }

    // Mark notification as read for normal/unlocked items
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

    // Direct routing
    if (note.type === 'message') {
      localStorage.setItem('activeTab', 'messages');
      window.location.hash = '/';
      return;
    }

    const senderId = note.sender?._id || note.sender || note.metadata?.newUserId;
    if (senderId) {
      window.location.hash = `/profile/${senderId}`;
    }
  };

  if (loading) return <div style={{ padding: '2rem', textAlign: 'center', color: '#666' }}>Loading alerts...</div>;

  return (
    <div style={{ padding: '1rem', maxWidth: '500px', margin: '0 auto', paddingBottom: '100px' }}>
      <h2 style={{ fontSize: '1.4rem', fontWeight: 700, marginBottom: '1rem' }}>Alerts</h2>
      {notifications.length === 0 ? (
        <div style={{ textAlign: 'center', color: '#666', marginTop: '2rem' }}>
          No new notifications.
        </div>
      ) : (
        notifications.map(note => {
          const isRead = note.read === true; 
          const isPaidUser = currentUser?.isVip || ['pro', 'unlimited'].includes(currentUser?.membershipTier);
          const isLockedType = ['like', 'match', 'match_request'].includes(note.type) && !isPaidUser;
          
          return (
            <div 
              key={note._id} 
              onClick={() => handleNotificationClick(note)}
              style={{ 
                background: isRead ? '#fff' : '#f0f7ff',
                padding: '1rem', 
                borderRadius: '12px', 
                marginBottom: '0.8rem', 
                boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
                cursor: 'pointer',
                borderLeft: isRead ? '4px solid transparent' : '4px solid #5b72f2',
                transition: 'all 0.2s',
                position: 'relative',
                overflow: 'hidden'
              }}
            >
              <div style={{ fontWeight: 'bold', marginBottom: '0.3rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {!isRead && <span style={{ width: 8, height: 8, background: '#5b72f2', borderRadius: '50%' }}></span>}
                  {note.type === 'like' && '❤️ New Like'}
                  {note.type === 'follow' && '👤 New Follower'}
                  {note.type === 'match' && '💖 It\'s a Match!'}
                  {note.type === 'message' && '💬 New Message'}
                  {note.type === 'match_request' && '💌 Match Request'}
                  {note.type === 'match_accepted' && '💖 Match Accepted'}
                  {note.type === 'welcome' && '👋 Welcome to PairHaven'}
                  {note.type === 'new-user' && '🌟 New User Nearby'}
                  {!['like','follow','match','message','match_request','match_accepted','welcome','new-user'].includes(note.type) && '🔔 Notification'}
                </div>

                {isLockedType && (
                  <span style={{ fontSize: '0.75rem', background: '#fee2e2', color: '#dc2626', padding: '2px 8px', borderRadius: '10px', fontWeight: 600 }}>
                    🔒 Locked
                  </span>
                )}
              </div>

              {/* Apply CSS filter blur effect for standard users on match/like notifications */}
              <div style={{ 
                color: '#444', 
                fontSize: '0.9rem',
                filter: isLockedType ? 'blur(5px)' : 'none',
                userSelect: isLockedType ? 'none' : 'auto',
                transition: 'filter 0.3s ease'
              }}>
                {note.message}
              </div>

              {isLockedType && (
                <div style={{ 
                  position: 'absolute', 
                  top: 0, 
                  left: 0, 
                  right: 0, 
                  bottom: 0, 
                  background: 'rgba(255, 255, 255, 0.4)', 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center',
                  fontWeight: 600,
                  fontSize: '0.8rem',
                  color: '#1e293b',
                  backdropFilter: 'blur(2px)'
                }}>
                  🔒 Tap & watch ad to reveal
                </div>
              )}
              
              <div style={{ fontSize: '0.75rem', color: '#999', marginTop: '0.5rem', position: 'relative', zIndex: 1 }}>
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
