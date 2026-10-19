import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

const API_URL = process.env.REACT_APP_API_URL || 'https://pairhaven.onrender.com';

function MatchingScreen() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(null);
  const navigate = useNavigate();
  
  const token = localStorage.getItem('token');
  
  // ✅ FRESH USER STATE
  const [freshUser, setFreshUser] = useState(null);

  // ✅ SYNC USER DATA ON MOUNT WITH DEBUG LOGS
  useEffect(() => {
    const syncUserData = async () => {
      try {
        console.log("🔄 Fetching fresh user data...");
        const res = await axios.get(`${API_URL}/api/users/profile/me`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        
        console.log("✅ Fresh User Data:", res.data);
        console.log("📋 Matches Array:", res.data.matches);
        console.log("📤 Requests Sent:", res.data.requestsSent);
        console.log("📥 Requests Received:", res.data.requestsReceived);
        
        setFreshUser(res.data);
        localStorage.setItem('user', JSON.stringify(res.data));
      } catch (err) {
        console.error("❌ Failed to sync user data", err);
      } finally {
        setLoading(false);
      }
    };

    if (token) syncUserData();
  }, [token]);

  // Fetch potential matches AFTER user data is synced
  useEffect(() => {
    if (!freshUser) return;
    
    const fetchPotentialMatches = async () => {
      try {
        const res = await axios.get(`${API_URL}/api/users/potential-matches`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setUsers(res.data || []);
      } catch (err) {
        console.error("Failed to load matches", err);
      }
    };
    
    fetchPotentialMatches();
  }, [freshUser, token]);

  const handleMatchAction = async (targetUser, actionType) => {
    setActionLoading(targetUser._id);
    
    try {
      if (actionType === 'send_request') {
        await axios.post(`${API_URL}/api/users/request/${targetUser._id}`, {}, {
          headers: { Authorization: `Bearer ${token}` }
        });
        
      } else if (actionType === 'accept') {
        await axios.post(`${API_URL}/api/users/accept-request/${targetUser._id}`, {}, {
          headers: { Authorization: `Bearer ${token}` }
        });
        
      } else if (actionType === 'decline') {
        await axios.delete(`${API_URL}/api/users/request/${targetUser._id}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        
      } else if (actionType === 'chat') {
        localStorage.setItem('activeTab', 'messages');
        window.location.hash = '/';
        return;
      }
      
      // ✅ REFRESH BOTH USER AND MATCHES AFTER ACTION
      await refreshData();
      
    } catch (err) {
      // Handle "Already Matched" as success
      if (err.response?.status === 400 && err.response?.data?.message === 'Already matched') {
        console.log("⚠️ Already matched - refreshing UI...");
        await refreshData();
      } else if (err.response?.status !== 400) {
        alert(err.response?.data?.message || "Action failed");
      }
    } finally {
      setActionLoading(null);
    }
  };

  // ✅ HELPER TO REFRESH ALL DATA
  const refreshData = async () => {
    try {
      const [userRes, matchesRes] = await Promise.all([
        axios.get(`${API_URL}/api/users/profile/me`, { headers: { Authorization: `Bearer ${token}` } }),
        axios.get(`${API_URL}/api/users/potential-matches`, { headers: { Authorization: `Bearer ${token}` } })
      ]);
      
      console.log("🔄 Refreshed User Data:", userRes.data);
      console.log("📋 Updated Matches:", userRes.data.matches);
      
      setFreshUser(userRes.data);
      localStorage.setItem('user', JSON.stringify(userRes.data));
      setUsers(matchesRes.data || []);
    } catch (err) {
      console.error("Refresh failed", err);
    }
  };

  // ✅ BUTTON CONFIG WITH DEBUG LOGS
  const getButtonConfig = (targetUser) => {
    if (!freshUser) return { label: '...', disabled: true };
    
    const isMatched = (freshUser.matches || []).includes(targetUser._id);
    const hasSentRequest = (freshUser.requestsSent || []).includes(targetUser._id);
    const hasReceivedRequest = (freshUser.requestsReceived || []).includes(targetUser._id);

    // Debug log for James Galloges (replace with actual ID if different)
    if (targetUser.name === 'James Galloges') {
      console.log(`🔍 Button check for ${targetUser.name}:`);
      console.log(`   - Is Matched: ${isMatched}`);
      console.log(`   - Has Sent Request: ${hasSentRequest}`);
      console.log(`   - Has Received Request: ${hasReceivedRequest}`);
      console.log(`   - My Matches Array:`, freshUser.matches);
    }

    if (isMatched) {
      return { 
        label: '💬', 
        style: { background: '#5b72f2', color: '#fff', fontSize: '1.5rem' }, 
        action: 'chat',
        disabled: false 
      };
    }
    
    if (hasSentRequest) {
      return { 
        label: ' Sent', 
        style: { background: '#ccc', color: '#fff' }, 
        action: null,
        disabled: true 
      };
    }
    
    if (hasReceivedRequest) {
      return { dualButtons: true };
    }
    
    return { 
      label: '❤️ Request', 
      style: { background: '#5b72f2', color: '#fff' }, 
      action: 'send_request',
      disabled: false 
    };
  };

  if (loading || !freshUser) return <div style={{padding:'3rem', textAlign:'center'}}>Loading...</div>;

  return (
    <div style={{ padding: '1rem', paddingBottom: '90px' }}>
      <h2 style={{ marginBottom: '1rem' }}>Discover People</h2>
      
      {users.length === 0 ? (
        <div style={{ textAlign: 'center', color: '#666', padding: '3rem' }}>No one to discover.</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '1rem' }}>
          {users.map(user => {
            const btnConfig = getButtonConfig(user);
            const isLoading = actionLoading === user._id;

            return (
              <div key={user._id} style={{ 
                background: '#fff', borderRadius: '12px', overflow: 'hidden', 
                boxShadow: '0 2px 8px rgba(0,0,0,0.08)', display: 'flex', flexDirection: 'column' 
              }}>
                <div onClick={() => window.location.hash = `/profile/${user._id}`} style={{ aspectRatio: '1', cursor: 'pointer', overflow: 'hidden' }}>
                  <img src={user.photos?.[0]?.url || user.photos?.[0] || 'https://via.placeholder.com/200'} alt={user.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                </div>

                <div style={{ padding: '0.8rem', flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>{user.name}</div>
                  <div style={{ fontSize: '0.8rem', color: '#666' }}>{user.age ? `${user.age} yrs` : ''}</div>
                </div>

                <div style={{ padding: '0 0.8rem 0.8rem' }}>
                  {btnConfig.dualButtons ? (
                    <div style={{ display: 'flex', gap: '4px' }}>
                      <button onClick={() => handleMatchAction(user, 'accept')} disabled={isLoading} style={{ flex: 1, background: '#10b981', color: '#fff', border: 'none', borderRadius: '8px', padding: '0.5rem', cursor: isLoading ? 'wait' : 'pointer' }}>✅</button>
                      <button onClick={() => handleMatchAction(user, 'decline')} disabled={isLoading} style={{ flex: 1, background: '#e53e3e', color: '#fff', border: 'none', borderRadius: '8px', padding: '0.5rem', cursor: isLoading ? 'wait' : 'pointer' }}>❌</button>
                    </div>
                  ) : (
                    <button 
                      onClick={() => handleMatchAction(user, btnConfig.action)}
                      disabled={btnConfig.disabled || isLoading}
                      style={{ 
                        width: '100%', ...btnConfig.style, border: 'none', 
                        borderRadius: '8px', padding: '0.6rem', 
                        cursor: (btnConfig.disabled || isLoading) ? 'not-allowed' : 'pointer',
                        opacity: isLoading ? 0.7 : 1
                      }}
                    >
                      {isLoading ? '...' : btnConfig.label}
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
