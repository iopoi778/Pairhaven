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
    // Mark notification as read
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

    // Direct routing for message or welcome types
    if (note.type === 'message') {
      localStorage.setItem('activeTab', 'messages');
      window.location.hash = '/';
      return;
    }

    // For Likes, Matches, Requests, and Accepts
    if (['like', 'match', 'follow', 'match_request', 'match_accepted', 'new-user'].includes(note.type)) {
      const senderId = note.sender?._id || note.sender || note.metadata?.newUserId;

      if (!senderId) return;

      // Check if user is on Pro or Unlimited plan
      const isPaidUser = currentUser?.isVip || ['pro', 'unlimited'].includes(currentUser?.membershipTier);

      if (isPaidUser) {
        // Pro / Unlimited members see matches & likes directly
        window.location.hash = `/profile/${senderId}`;
      } else {
        // Standard user: prompt to watch an ad to reveal
        const confirmAd = window.confirm(
          "🔒 Upgrade to Pro or watch a quick ad to reveal who liked/matched with you!\n\nClick 'OK' to watch ad now."
        );

        if (confirmAd) {
          alert("Playing reward ad... (Simulated)");
          setTimeout(() => {
            alert("Ad completed! Opening profile...");
            window.location.hash = `/profile/${senderId}`;
          }, 2000);
        }
      }
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
                position: 'relative'
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

                {/* Show lock badge for free users on like/match alerts */}
                {isLockedType && (
                  <span style={{ fontSize: '0.75rem', background: '#fee2e2', color: '#dc2626', padding: '2px 8px', borderRadius: '10px', fontWeight: 600 }}>
                    🔒 Watch Ad to view
                  </span>
                )}
              </div>

              <div style={{ color: '#444', fontSize: '0.9rem' }}>{note.message}</div>
              
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
