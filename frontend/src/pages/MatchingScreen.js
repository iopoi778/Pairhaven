import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

const API_URL = process.env.REACT_APP_API_URL || 'https://pairhaven.onrender.com';

function MatchingScreen() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(null);
  
  // ✅ Filter State
  const [showFilters, setShowFilters] = useState(false);
  const [viewMode, setViewMode] = useState('swipe'); // 'swipe' or 'grid'
  const [filters, setFilters] = useState({
    minAge: 18,
    maxAge: 60,
    location: '',
    maxDistance: 50 // in km
  });

  // ✅ Swipe Card State
  const [currentIndex, setCurrentIndex] = useState(0);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef({ x: 0, y: 0 });

  const navigate = useNavigate();
  const token = localStorage.getItem('token');
  const [freshUser, setFreshUser] = useState(null);

  // Sync user data on mount
  useEffect(() => {
    const syncUserData = async () => {
      try {
        const res = await axios.get(`${API_URL}/api/users/profile/me`, {
          headers: { Authorization: `Bearer ${token}` }
        });
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

  // Fetch potential matches with query filters
  const fetchPotentialMatches = async (currentFilters = filters) => {
    try {
      const params = new URLSearchParams();
      if (currentFilters.minAge) params.append('minAge', currentFilters.minAge);
      if (currentFilters.maxAge) params.append('maxAge', currentFilters.maxAge);
      if (currentFilters.location) params.append('location', currentFilters.location);
      if (currentFilters.maxDistance) params.append('maxDistance', currentFilters.maxDistance);

      const res = await axios.get(`${API_URL}/api/users/potential-matches?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setUsers(res.data || []);
      setCurrentIndex(0);
    } catch (err) {
      console.error("Failed to load matches", err);
    }
  };

  useEffect(() => {
    if (!freshUser) return;
    fetchPotentialMatches(filters);
  }, [freshUser, token]);

  // ✅ Helper to render Location and Country cleanly
  const renderLocation = (loc) => {
    if (!loc) return 'Nearby';
    if (typeof loc === 'object') {
      const parts = [loc.address || loc.city || loc.name, loc.country].filter(Boolean);
      return parts.length > 0 ? parts.join(', ') : 'Nearby';
    }
    return loc;
  };

  const handleMatchAction = async (targetUser, actionType) => {
    if (!targetUser) return;
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
        try {
          await axios.delete(`${API_URL}/api/users/request/${targetUser._id}`, {
            headers: { Authorization: `Bearer ${token}` }
          });
        } catch (e) {
          // Ignore if passing user without active request
        }
      } else if (actionType === 'unmatch') {
        await axios.delete(`${API_URL}/api/users/match/${targetUser._id}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
      } else if (actionType === 'chat') {
        localStorage.setItem('activeTab', 'messages');
        window.location.hash = '/';
        return;
      }
      
      await refreshData();
      if (viewMode === 'swipe') {
        setCurrentIndex(prev => prev + 1);
      }
    } catch (err) {
      if (err.response?.status === 400 && err.response?.data?.message === 'Already matched') {
        await refreshData();
        if (viewMode === 'swipe') setCurrentIndex(prev => prev + 1);
      } else if (err.response?.status !== 400) {
        alert(err.response?.data?.message || "Action failed");
      }
    } finally {
      setActionLoading(null);
      setDragOffset({ x: 0, y: 0 });
    }
  };

  const refreshData = async () => {
    try {
      const [userRes, matchesRes] = await Promise.all([
        axios.get(`${API_URL}/api/users/profile/me`, { headers: { Authorization: `Bearer ${token}` } }),
        axios.get(`${API_URL}/api/users/potential-matches`, { headers: { Authorization: `Bearer ${token}` } })
      ]);
      setFreshUser(userRes.data);
      localStorage.setItem('user', JSON.stringify(userRes.data));
      setUsers(matchesRes.data || []);
    } catch (err) {
      console.error("Refresh failed", err);
    }
  };

  const getButtonConfig = (targetUser) => {
    if (!freshUser) return { label: '...', disabled: true };
    
    const isMatched = (freshUser.matches || []).includes(targetUser._id);
    const hasSentRequest = (freshUser.requestsSent || []).includes(targetUser._id);
    const hasReceivedRequest = (freshUser.requestsReceived || []).includes(targetUser._id) || targetUser.hasReceivedRequest;

    if (isMatched) {
      return { 
        isMatched: true,
        chatAction: 'chat',
        unmatchAction: 'unmatch'
      };
    }
    
    if (hasReceivedRequest) {
      return { dualButtons: true };
    }

    if (hasSentRequest) {
      return { label: 'Request Sent', style: { background: '#ccc', color: '#fff' }, disabled: true };
    }
    
    return { label: '❤️ Request', style: { background: '#5b72f2', color: '#fff' }, action: 'send_request' };
  };

  // --- Touch & Mouse Drag Swipe Event Handlers ---
  const handleTouchStart = (e) => {
    setIsDragging(true);
    dragStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  };

  const handleTouchMove = (e) => {
    if (!isDragging) return;
    const currentX = e.touches[0].clientX;
    const currentY = e.touches[0].clientY;
    setDragOffset({ x: currentX - dragStartRef.current.x, y: currentY - dragStartRef.current.y });
  };

  const handleTouchEnd = () => {
    if (!isDragging) return;
    setIsDragging(false);
    evaluateSwipe();
  };

  const handleMouseDown = (e) => {
    setIsDragging(true);
    dragStartRef.current = { x: e.clientX, y: e.clientY };
  };

  const handleMouseMove = (e) => {
    if (!isDragging) return;
    const currentX = e.clientX;
    const currentY = e.clientY;
    setDragOffset({ x: currentX - dragStartRef.current.x, y: currentY - dragStartRef.current.y });
  };

  const handleMouseUp = () => {
    if (!isDragging) return;
    setIsDragging(false);
    evaluateSwipe();
  };

  const evaluateSwipe = () => {
    const threshold = 120;
    const currentUser = users[currentIndex];
    if (!currentUser) return;

    if (dragOffset.x > threshold) {
      const config = getButtonConfig(currentUser);
      if (config.isMatched) {
        handleMatchAction(currentUser, 'chat');
      } else if (config.dualButtons) {
        handleMatchAction(currentUser, 'accept');
      } else {
        handleMatchAction(currentUser, 'send_request');
      }
    } else if (dragOffset.x < -threshold) {
      handleMatchAction(currentUser, 'decline');
    } else {
      setDragOffset({ x: 0, y: 0 });
    }
  };

  if (loading || !freshUser) return <div style={{padding:'3rem', textAlign:'center'}}>Loading profiles...</div>;

  const currentUser = users[currentIndex];

  return (
    <div style={{ padding: '1rem', paddingBottom: '90px', maxWidth: '500px', margin: '0 auto', position: 'relative' }}>
      
      {/* Header Controls */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h2 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 700 }}>Discover</h2>
        
        <div style={{ display: 'flex', gap: '8px' }}>
          <button 
            onClick={() => setViewMode(viewMode === 'swipe' ? 'grid' : 'swipe')}
            style={{ background: '#f0f2f5', border: 'none', padding: '0.5rem 0.8rem', borderRadius: '12px', cursor: 'pointer', fontWeight: 600 }}
          >
            {viewMode === 'swipe' ? '📱 Grid' : '🎴 Swipe'}
          </button>
          <button 
            onClick={() => setShowFilters(true)}
            style={{ background: '#f0f2f5', border: 'none', padding: '0.5rem 0.8rem', borderRadius: '12px', cursor: 'pointer', fontWeight: 600 }}
          >
            ⚙️ Filters
          </button>
        </div>
      </div>

      {/* Filter Modal */}
      {showFilters && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', justifyContent: 'center', alignItems: 'flex-end' }}>
          <div style={{ background: '#fff', width: '100%', maxWidth: '500px', borderTopLeftRadius: '20px', borderTopRightRadius: '20px', padding: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ margin: 0 }}>Filter Matches</h3>
              <button onClick={() => setShowFilters(false)} style={{ background: 'none', border: 'none', fontSize: '1.2rem', cursor: 'pointer' }}>✕</button>
            </div>

            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', fontSize: '0.9rem', fontWeight: 600, marginBottom: '0.4rem' }}>
                Age Range: {filters.minAge} - {filters.maxAge} yrs
              </label>
              <div style={{ display: 'flex', gap: '10px' }}>
                <input type="number" value={filters.minAge} onChange={e => setFilters({...filters, minAge: Number(e.target.value)})} style={{ width: '50%', padding: '8px', borderRadius: '8px', border: '1px solid #ddd' }} />
                <input type="number" value={filters.maxAge} onChange={e => setFilters({...filters, maxAge: Number(e.target.value)})} style={{ width: '50%', padding: '8px', borderRadius: '8px', border: '1px solid #ddd' }} />
              </div>
            </div>

            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', fontSize: '0.9rem', fontWeight: 600, marginBottom: '0.4rem' }}>Location / City / Country</label>
              <input type="text" placeholder="e.g. New York or United States" value={filters.location} onChange={e => setFilters({...filters, location: e.target.value})} style={{ width: '100%', padding: '8px', borderRadius: '8px', border: '1px solid #ddd', boxSizing: 'border-box' }} />
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', fontSize: '0.9rem', fontWeight: 600, marginBottom: '0.4rem' }}>Max Distance: {filters.maxDistance} km</label>
              <input type="range" min="5" max="500" value={filters.maxDistance} onChange={e => setFilters({...filters, maxDistance: Number(e.target.value)})} style={{ width: '100%' }} />
            </div>

            <button 
              onClick={() => { setShowFilters(false); fetchPotentialMatches(filters); }}
              style={{ width: '100%', background: '#5b72f2', color: '#fff', border: 'none', padding: '0.75rem', borderRadius: '10px', fontWeight: 700, cursor: 'pointer' }}
            >
              Apply Filters
            </button>
          </div>
        </div>
      )}

      {/* SWIPE DECK VIEW MODE */}
      {viewMode === 'swipe' && (
        <>
          {!currentUser || currentIndex >= users.length ? (
            <div style={{ textAlign: 'center', color: '#666', padding: '4rem 1rem', background: '#fff', borderRadius: '16px', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
              <h3>No more profiles nearby</h3>
              <p style={{ fontSize: '0.9rem', color: '#888' }}>Adjust filters or reset parameters to see more profiles.</p>
              <button onClick={() => { setFilters({minAge:18, maxAge:60, location:'', maxDistance:50}); fetchPotentialMatches({minAge:18, maxAge:60, location:'', maxDistance:50}); }} style={{ marginTop: '1rem', background: '#5b72f2', color: '#fff', border: 'none', padding: '0.6rem 1.2rem', borderRadius: '8px', cursor: 'pointer', fontWeight: 600 }}>Reset Filters</button>
            </div>
          ) : (
            <div style={{ position: 'relative', height: '62vh', width: '100%' }}>
              
              {users[currentIndex + 1] && (
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: '#fff', borderRadius: '20px', overflow: 'hidden', boxShadow: '0 4px 12px rgba(0,0,0,0.05)', zIndex: 1, transform: 'scale(0.95)', opacity: 0.7 }}>
                  <img src={users[currentIndex + 1].photos?.[0]?.url || users[currentIndex + 1].photos?.[0] || 'https://via.placeholder.com/400'} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                </div>
              )}

              <div 
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
                style={{ 
                  position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, 
                  background: '#fff', borderRadius: '20px', overflow: 'hidden', 
                  boxShadow: '0 8px 24px rgba(0,0,0,0.12)', zIndex: 2,
                  transform: `translate(${dragOffset.x}px, ${dragOffset.y}px) rotate(${dragOffset.x * 0.05}deg)`,
                  transition: isDragging ? 'none' : 'transform 0.3s ease',
                  cursor: isDragging ? 'grabbing' : 'grab',
                  display: 'flex', flexDirection: 'column', userSelect: 'none'
                }}
              >
                {dragOffset.x > 50 && (
                  <div style={{ position: 'absolute', top: '2rem', left: '2rem', border: '4px solid #10b981', color: '#10b981', padding: '0.4rem 0.8rem', fontSize: '1.4rem', fontWeight: 900, borderRadius: '8px', transform: 'rotate(-15deg)', zIndex: 10, background: 'rgba(255,255,255,0.85)' }}>
                    LIKE
                  </div>
                )}
                {dragOffset.x < -50 && (
                  <div style={{ position: 'absolute', top: '2rem', right: '2rem', border: '4px solid #ef4444', color: '#ef4444', padding: '0.4rem 0.8rem', fontSize: '1.4rem', fontWeight: 900, borderRadius: '8px', transform: 'rotate(15deg)', zIndex: 10, background: 'rgba(255,255,255,0.85)' }}>
                    PASS
                  </div>
                )}

                <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
                  <img 
                    src={currentUser.photos?.[0]?.url || currentUser.photos?.[0] || 'https://via.placeholder.com/400'} 
                    alt={currentUser.name} 
                    style={{ width: '100%', height: '100%', objectFit: 'cover', pointerEvents: 'none' }} 
                  />
                  <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.85), transparent)', padding: '2rem 1.2rem 1rem', color: '#fff' }}>
                    <div style={{ fontSize: '1.6rem', fontWeight: 700 }}>{currentUser.name}, {currentUser.age || ''}</div>
                    <div style={{ fontSize: '0.9rem', opacity: 0.9, marginTop: '2px' }}>📍 {renderLocation(currentUser.location)}</div>
                  </div>
                </div>

                <div style={{ padding: '0.8rem 1.2rem', background: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.85rem', color: '#666', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '75%' }}>
                    {currentUser.bio || 'No bio available.'}
                  </span>
                  <button 
                    onClick={() => window.location.hash = `/profile/${currentUser._id}`}
                    style={{ background: 'none', border: 'none', color: '#5b72f2', fontWeight: 600, cursor: 'pointer', fontSize: '0.9rem' }}
                  >
                    Profile ℹ️
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Swipe Controls / Actions */}
          {currentUser && currentIndex < users.length && (
            <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem', marginTop: '1.2rem', alignItems: 'center' }}>
              
              <button 
                onClick={() => handleMatchAction(currentUser, 'decline')}
                disabled={actionLoading === currentUser._id}
                title="Pass"
                style={{ width: '55px', height: '55px', borderRadius: '50%', background: '#fff', border: '2px solid #fee2e2', color: '#ef4444', fontSize: '1.3rem', boxShadow: '0 4px 12px rgba(0,0,0,0.08)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                ❌
              </button>

              {getButtonConfig(currentUser).isMatched ? (
                <>
                  <button 
                    onClick={() => handleMatchAction(currentUser, 'chat')}
                    disabled={actionLoading === currentUser._id}
                    title="Chat"
                    style={{ width: '55px', height: '55px', borderRadius: '50%', background: '#5b72f2', border: 'none', color: '#fff', fontSize: '1.3rem', boxShadow: '0 4px 12px rgba(91,114,242,0.3)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  >
                    💬
                  </button>
                  {/* ✅ Restored Unmatch Button */}
                  <button 
                    onClick={() => handleMatchAction(currentUser, 'unmatch')}
                    disabled={actionLoading === currentUser._id}
                    title="Unmatch"
                    style={{ background: '#fee2e2', color: '#ef4444', border: 'none', borderRadius: '20px', padding: '0.5rem 1rem', fontSize: '0.85rem', fontWeight: 700, cursor: 'pointer' }}
                  >
                    Unmatch 💔
                  </button>
                </>
              ) : getButtonConfig(currentUser).dualButtons ? (
                <>
                  <button 
                    onClick={() => handleMatchAction(currentUser, 'accept')}
                    disabled={actionLoading === currentUser._id}
                    title="Accept Match Request"
                    style={{ width: '60px', height: '60px', borderRadius: '50%', background: '#10b981', border: 'none', color: '#fff', fontSize: '1.4rem', boxShadow: '0 4px 12px rgba(16,185,129,0.3)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  >
                    ✅
                  </button>
                </>
              ) : (
                <button 
                  onClick={() => handleMatchAction(currentUser, 'send_request')}
                  disabled={getButtonConfig(currentUser).disabled || actionLoading === currentUser._id}
                  title="Send Request"
                  style={{ width: '65px', height: '65px', borderRadius: '50%', background: '#ff4b4b', border: 'none', color: '#fff', fontSize: '1.5rem', boxShadow: '0 4px 12px rgba(255,75,75,0.3)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                  ❤️
                </button>
              )}
            </div>
          )}
        </>
      )}

      {/* GRID DISCOVERY VIEW MODE */}
      {viewMode === 'grid' && (
        <div>
          {users.length === 0 ? (
            <div style={{ textAlign: 'center', color: '#666', padding: '3rem' }}>No profiles match your filters.</div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '1rem' }}>
              {users.map(user => {
                const btnConfig = getButtonConfig(user);
                const isLoading = actionLoading === user._id;

                return (
                  <div key={user._id} style={{ background: '#fff', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.08)', display: 'flex', flexDirection: 'column' }}>
                    <div onClick={() => window.location.hash = `/profile/${user._id}`} style={{ aspectRatio: '1', cursor: 'pointer', overflow: 'hidden' }}>
                      <img src={user.photos?.[0]?.url || user.photos?.[0] || 'https://via.placeholder.com/200'} alt={user.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    </div>

                    <div style={{ padding: '0.6rem', flex: 1 }}>
                      <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>{user.name}</div>
                      <div style={{ fontSize: '0.75rem', color: '#666', marginTop: '2px' }}>{user.age ? `${user.age} yrs` : ''} • {renderLocation(user.location)}</div>
                    </div>

                    <div style={{ padding: '0 0.6rem 0.6rem' }}>
                      {btnConfig.isMatched ? (
                        <div style={{ display: 'flex', gap: '4px' }}>
                          <button onClick={() => handleMatchAction(user, 'chat')} disabled={isLoading} style={{ flex: 1, background: '#5b72f2', color: '#fff', border: 'none', borderRadius: '6px', padding: '0.4rem', fontSize: '0.8rem', cursor: 'pointer' }}>💬 Chat</button>
                          {/* ✅ Restored Unmatch Button in Grid */}
                          <button onClick={() => handleMatchAction(user, 'unmatch')} disabled={isLoading} style={{ background: '#fee2e2', color: '#ef4444', border: 'none', borderRadius: '6px', padding: '0.4rem', fontSize: '0.8rem', cursor: 'pointer' }}>💔</button>
                        </div>
                      ) : btnConfig.dualButtons ? (
                        <div style={{ display: 'flex', gap: '4px' }}>
                          <button onClick={() => handleMatchAction(user, 'accept')} disabled={isLoading} style={{ flex: 1, background: '#10b981', color: '#fff', border: 'none', borderRadius: '6px', padding: '0.4rem', cursor: 'pointer' }}>✅</button>
                          <button onClick={() => handleMatchAction(user, 'decline')} disabled={isLoading} style={{ flex: 1, background: '#ef4444', color: '#fff', border: 'none', borderRadius: '6px', padding: '0.4rem', cursor: 'pointer' }}>❌</button>
                        </div>
                      ) : (
                        <button 
                          onClick={() => handleMatchAction(user, btnConfig.action)}
                          disabled={btnConfig.disabled || isLoading}
                          style={{ 
                            width: '100%', ...btnConfig.style, border: 'none', borderRadius: '6px', padding: '0.5rem', fontSize: '0.8rem',
                            cursor: (btnConfig.disabled || isLoading) ? 'not-allowed' : 'pointer', opacity: isLoading ? 0.7 : 1
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
      )}

    </div>
  );
}

export default MatchingScreen;
