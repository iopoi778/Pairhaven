import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

const API_URL = process.env.REACT_APP_API_URL || 'https://pairhaven.onrender.com';

function MatchingScreen() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(null); // Stores userId of loading action
  const navigate = useNavigate();
  
  const token = localStorage.getItem('token');
  const currentUser = JSON.parse(localStorage.getItem('user') || '{}');

  useEffect(() => {
    const fetchPotentialMatches = async () => {
      try {
        // Fetch users excluding yourself (adjust endpoint as needed)
        const res = await axios.get(`${API_URL}/api/users/potential-matches`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setUsers(res.data || []);
      } catch (err) {
        console.error("Failed to load matches", err);
      } finally {
        setLoading(false);
      }
    };
    if (token) fetchPotentialMatches();
  }, [token]);

  // ✅ SMART ACTION HANDLER
  const handleMatchAction = async (targetUser, actionType) => {
    setActionLoading(targetUser._id);
    
    try {
      if (actionType === 'send_request') {
        await axios.post(`${API_URL}/api/users/request/${targetUser._id}`, {}, {
          headers: { Authorization: `Bearer ${token}` }
        });
        alert(`Match request sent to ${targetUser.name}!`);
        
      } else if (actionType === 'accept') {
        await axios.post(`${API_URL}/api/users/accept-request/${targetUser._id}`, {}, {
          headers: { Authorization: `Bearer ${token}` }
        });
        alert(`You matched with ${targetUser.name}! You can now chat.`);
        
      } else if (actionType === 'decline') {
        await axios.delete(`${API_URL}/api/users/request/${targetUser._id}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        
      } else if (actionType === 'chat') {
        // Navigate to chat and open conversation with this user
        localStorage.setItem('activeTab', 'messages');
        localStorage.setItem('chatWithUserId', targetUser._id); // Optional: auto-select chat
        window.location.hash = '/';
        return; // Don't reset loading state yet
      }
      
      // Refresh user list to update button states
      const res = await axios.get(`${API_URL}/api/users/potential-matches`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setUsers(res.data || []);
      
    } catch (err) {
      console.error("Action failed:", err);
      alert(err.response?.data?.message || "Action failed");
    } finally {
      setActionLoading(null);
    }
  };

  // ✅ GET BUTTON CONFIG BASED ON RELATIONSHIP STATUS
  const getButtonConfig = (targetUser) => {
    const isMatched = currentUser.matches?.includes(targetUser._id);
    const hasSentRequest = currentUser.requestsSent?.includes(targetUser._id);
    const hasReceivedRequest = currentUser.requestsReceived?.includes(targetUser._id);

    if (isMatched) {
      return { 
        label: '💬 Message', 
        style: { background: '#5b72f2', color: '#fff' }, 
        action: 'chat',
        disabled: false 
      };
    }
    if (hasSentRequest) {
      return { 
        label: '⏳ Request Sent', 
        style: { background: '#ccc', color: '#fff' }, 
        action: null,
        disabled: true 
      };
    }
    if (hasReceivedRequest) {
      // Return object with two buttons for accept/decline
      return { dualButtons: true };
    }
    // Default: Send Request
    return { 
      label: '❤️ Send Match Request', 
      style: { background: '#5b72f2', color: '#fff' }, 
      action: 'send_request',
      disabled: false 
    };
  };

  if (loading) return <div style={{padding:'3rem', textAlign:'center'}}>Loading potential matches...</div>;

  return (
    <div style={{ padding: '1rem', paddingBottom: '90px' }}>
      <h2 style={{ marginBottom: '1rem' }}>Discover People</h2>
      
      {users.length === 0 ? (
        <div style={{ textAlign: 'center', color: '#666', padding: '3rem' }}>
          No new people to discover right now.
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '1rem' }}>
          {users.map(user => {
            const btnConfig = getButtonConfig(user);
            const isLoading = actionLoading === user._id;

            return (
              <div key={user._id} style={{ 
                background: '#fff', borderRadius: '12px', overflow: 'hidden', 
                boxShadow: '0 2px 8px rgba(0,0,0,0.08)', display: 'flex', flexDirection: 'column' 
              }}>
                {/* User Photo */}
                <div 
                  onClick={() => window.location.hash = `/profile/${user._id}`}
                  style={{ aspectRatio: '1', cursor: 'pointer', overflow: 'hidden' }}
                >
                  <img 
                    src={user.photos?.[0]?.url || user.photos?.[0] || 'https://via.placeholder.com/200'} 
                    alt={user.name}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                </div>

                {/* User Info */}
                <div style={{ padding: '0.8rem', flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>{user.name}</div>
                  <div style={{ fontSize: '0.8rem', color: '#666', marginTop: '2px' }}>
                    {user.age ? `${user.age} yrs` : ''}
                    {user.location?.city ? ` • ${user.location.city}` : ''}
                  </div>
                </div>

                {/* ✅ DYNAMIC ACTION BUTTON(S) */}
                <div style={{ padding: '0 0.8rem 0.8rem' }}>
                  {btnConfig.dualButtons ? (
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button 
                        onClick={() => handleMatchAction(user, 'accept')}
                        disabled={isLoading}
                        style={{ 
                          flex: 1, background: '#10b981', color: '#fff', border: 'none', 
                          borderRadius: '8px', padding: '0.5rem', fontSize: '0.8rem', 
                          cursor: isLoading ? 'wait' : 'pointer', fontWeight: 600 
                        }}
                      >
                        {isLoading ? '...' : '✅ Accept'}
                      </button>
                      <button 
                        onClick={() => handleMatchAction(user, 'decline')}
                        disabled={isLoading}
                        style={{ 
                          flex: 1, background: '#e53e3e', color: '#fff', border: 'none', 
                          borderRadius: '8px', padding: '0.5rem', fontSize: '0.8rem', 
                          cursor: isLoading ? 'wait' : 'pointer', fontWeight: 600 
                        }}
                      >
                        {isLoading ? '...' : '❌ Decline'}
                      </button>
                    </div>
                  ) : (
                    <button 
                      onClick={() => handleMatchAction(user, btnConfig.action)}
                      disabled={btnConfig.disabled || isLoading}
                      style={{ 
                        width: '100%', ...btnConfig.style, border: 'none', 
                        borderRadius: '8px', padding: '0.6rem', fontSize: '0.85rem', 
                        cursor: (btnConfig.disabled || isLoading) ? 'not-allowed' : 'pointer',
                        fontWeight: 600, transition: 'opacity 0.2s',
                        opacity: isLoading ? 0.7 : 1
                      }}
                    >
                      {isLoading ? 'Processing...' : btnConfig.label}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default MatchingScreen;
