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
        } catch (e) {}
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
      return { isMatched: true, chatAction: 'chat', unmatchAction: 'unmatch' };
    }
    if (hasReceivedRequest) {
      return { dualButtons: true };
    }
    if (hasSentRequest) {
      return { label: 'Requested', style: { background: '#e2e8f0', color: '#64748b' }, disabled: true };
    }
    return { label: '❤️ Request', style: { background: '#ff4b4b', color: '#fff' }, action: 'send_request' };
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
    const threshold = 110;
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

  if (loading || !freshUser) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '70vh', color: '#64748b', fontWeight: 600 }}>
        ✨ Finding profiles near you...
      </div>
    );
  }

  const currentUser = users[currentIndex];

  return (
    <div style={{ padding: '1rem', paddingBottom: '100px', maxWidth: '420px', margin: '0 auto', position: 'relative', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}>
      
      {/* Header Controls */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.2rem' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '1.6rem', fontWeight: 800, color: '#1e293b', letterSpacing: '-0.5px' }}>Discover</h2>
          <p style={{ margin: 0, fontSize: '0.8rem', color: '#64748b' }}>Explore new matches around you</p>
        </div>
        
        <div style={{ display: 'flex', gap: '8px' }}>
          <button 
            onClick={() => setViewMode(viewMode === 'swipe' ? 'grid' : 'swipe')}
            style={{ background: '#f8fafc', border: '1px solid #e2e8f0', padding: '0.5rem 0.9rem', borderRadius: '20px', cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem', color: '#334155' }}
          >
            {viewMode === 'swipe' ? '📱 Grid' : '🎴 Swipe'}
          </button>
          <button 
            onClick={() => setShowFilters(true)}
            style={{ background: '#f8fafc', border: '1px solid #e2e8f0', padding: '0.5rem 0.9rem', borderRadius: '20px', cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem', color: '#334155' }}
          >
            ⚙️ Filters
          </button>
        </div>
      </div>

      {/* Filter Modal */}
      {showFilters && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(4px)', zIndex: 1000, display: 'flex', justifyContent: 'center', alignItems: 'flex-end' }}>
          <div style={{ background: '#fff', width: '100%', maxWidth: '420px', borderTopLeftRadius: '24px', borderTopRightRadius: '24px', padding: '1.8rem', boxShadow: '0 -10px 25px rgba(0,0,0,0.1)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 700, color: '#1e293b' }}>Discovery Filters</h3>
              <button onClick={() => setShowFilters(false)} style={{ background: '#f1f5f9', border: 'none', width: '32px', height: '32px', borderRadius: '50%', fontSize: '1rem', cursor: 'pointer', color: '#64748b' }}>✕</button>
            </div>

            <div style={{ marginBottom: '1.2rem' }}>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, color: '#475569', marginBottom: '0.5rem' }}>
                Age Range: <span style={{ color: '#5b72f2' }}>{filters.minAge} - {filters.maxAge} yrs</span>
              </label>
              <div style={{ display: 'flex', gap: '10px' }}>
                <input type="number" value={filters.minAge} onChange={e => setFilters({...filters, minAge: Number(e.target.value)})} style={{ width: '50%', padding: '10px', borderRadius: '12px', border: '1px solid #cbd5e1', outline: 'none' }} />
                <input type="number" value={filters.maxAge} onChange={e => setFilters({...filters, maxAge: Number(e.target.value)})} style={{ width: '50%', padding: '10px', borderRadius: '12px', border: '1px solid #cbd5e1', outline: 'none' }} />
              </div>
            </div>

            <div style={{ marginBottom: '1.2rem' }}>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, color: '#475569', marginBottom: '0.5rem' }}>Location / City / Country</label>
              <input type="text" placeholder="e.g. New York or United States" value={filters.location} onChange={e => setFilters({...filters, location: e.target.value})} style={{ width: '100%', padding: '10px', borderRadius: '12px', border: '1px solid #cbd5e1', boxSizing: 'border-box', outline: 'none' }} />
            </div>

            <div style={{ marginBottom: '1.8rem' }}>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, color: '#475569', marginBottom: '0.5rem' }}>Max Distance: <span style={{ color: '#5b72f2' }}>{filters.maxDistance} km</span></label>
              <input type="range" min="5" max="500" value={filters.maxDistance} onChange={e => setFilters({...filters, maxDistance: Number(e.target.value)})} style={{ width: '100%', accentColor: '#5b72f2' }} />
            </div>

            <button 
              onClick={() => { setShowFilters(false); fetchPotentialMatches(filters); }}
              style={{ width: '100%', background: 'linear-gradient(135deg, #5b72f2, #7c3aed)', color: '#fff', border: 'none', padding: '0.9rem', borderRadius: '14px', fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 12px rgba(91,114,242,0.3)' }}
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
            <div style={{ textAlign: 'center', color: '#64748b', padding: '5rem 1.5rem', background: '#fff', borderRadius: '24px', boxShadow: '0 10px 30px rgba(0,0,0,0.04)', border: '1px solid #f1f5f9' }}>
              <div style={{ fontSize: '3.5rem', marginBottom: '1rem' }}>🎉</div>
              <h3 style={{ margin: '0 0 0.5rem 0', color: '#1e293b', fontSize: '1.3rem' }}>You're all caught up!</h3>
              <p style={{ fontSize: '0.9rem', color: '#64748b', maxWidth: '280px', margin: '0 auto 1.5rem auto' }}>There are no more new profiles matching your current filters.</p>
              <button onClick={() => { setFilters({minAge:18, maxAge:60, location:'', maxDistance:50}); fetchPotentialMatches({minAge:18, maxAge:60, location:'', maxDistance:50}); }} style={{ background: '#5b72f2', color: '#fff', border: 'none', padding: '0.7rem 1.4rem', borderRadius: '12px', cursor: 'pointer', fontWeight: 700, boxShadow: '0 4px 12px rgba(91,114,242,0.3)' }}>Reset Filters</button>
            </div>
          ) : (
            <div style={{ position: 'relative', height: '64vh', width: '100%' }}>
              
              {/* Background Card Preview Stack */}
              {users[currentIndex + 1] && (
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: '#fff', borderRadius: '24px', overflow: 'hidden', boxShadow: '0 4px 12px rgba(0,0,0,0.04)', zIndex: 1, transform: 'scale(0.96) translateY(12px)', opacity: 0.6 }}>
                  <img src={users[currentIndex + 1].photos?.[0]?.url || users[currentIndex + 1].photos?.[0] || 'https://via.placeholder.com/400'} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                </div>
              )}

              {/* Active Foreground Card */}
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
                  background: '#1e293b', borderRadius: '24px', overflow: 'hidden', 
                  boxShadow: '0 12px 32px rgba(0,0,0,0.12)', zIndex: 2,
                  transform: `translate(${dragOffset.x}px, ${dragOffset.y}px) rotate(${dragOffset.x * 0.04}deg)`,
                  transition: isDragging ? 'none' : 'transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
                  cursor: isDragging ? 'grabbing' : 'grab',
                  display: 'flex', flexDirection: 'column', userSelect: 'none'
                }}
              >
                {/* Swipe Dynamic Indicator Stamps */}
                {dragOffset.x > 50 && (
                  <div style={{ position: 'absolute', top: '2.5rem', left: '2rem', border: '3px solid #10b981', color: '#10b981', padding: '0.3rem 0.9rem', fontSize: '1.4rem', fontWeight: 900, borderRadius: '10px', transform: 'rotate(-12deg)', zIndex: 10, background: 'rgba(255,255,255,0.9)', letterSpacing: '1px' }}>
                    LIKE
                  </div>
                )}
                {dragOffset.x < -50 && (
                  <div style={{ position: 'absolute', top: '2.5rem', right: '2rem', border: '3px solid #ef4444', color: '#ef4444', padding: '0.3rem 0.9rem', fontSize: '1.4rem', fontWeight: 900, borderRadius: '10px', transform: 'rotate(12deg)', zIndex: 10, background: 'rgba(255,255,255,0.9)', letterSpacing: '1px' }}>
                    PASS
                  </div>
                )}

                {/* Immersive Img & Info Overlay */}
                <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
                  <img 
                    src={currentUser.photos?.[0]?.url || currentUser.photos?.[0] || 'https://via.placeholder.com/400'} 
                    alt={currentUser.name} 
                    style={{ width: '100%', height: '100%', objectFit: 'cover', pointerEvents: 'none' }} 
                  />
                  
                  {/* Subtle Top Indicator Bar */}
                  <div style={{ position: 'absolute', top: '1rem', left: '1rem', right: '1rem', height: '4px', background: 'rgba(255,255,255,0.4)', borderRadius: '4px', overflow: 'hidden' }}>
                    <div style={{ width: '30%', height: '100%', background: '#fff' }} />
                  </div>

                  {/* Gradient Info Box */}
                  <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'linear-gradient(to top, rgba(15,23,42,0.95) 15%, rgba(15,23,42,0.7) 60%, transparent 100%)', padding: '2.5rem 1.4rem 1.2rem', color: '#fff' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                      <div>
                        <div style={{ fontSize: '1.7rem', fontWeight: 800, textShadow: '0 2px 4px rgba(0,0,0,0.3)' }}>
                          {currentUser.name}, <span style={{ fontWeight: 400, opacity: 0.9 }}>{currentUser.age || ''}</span>
                        </div>
                        <div style={{ fontSize: '0.85rem', opacity: 0.85, marginTop: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          📍 {renderLocation(currentUser.location)}
                        </div>
                      </div>
                      
                      <button 
                        onClick={() => window.location.hash = `/profile/${currentUser._id}`}
                        style={{ background: 'rgba(255,255,255,0.2)', border: 'none', backdropFilter: 'blur(8px)', width: '38px', height: '38px', borderRadius: '50%', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: '1rem' }}
                        title="View Full Profile"
                      >
                        ℹ️
                      </button>
                    </div>

                    {currentUser.bio && (
                      <div style={{ fontSize: '0.85rem', opacity: 0.85, marginTop: '8px', overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', lineHeight: '1.3' }}>
                        {currentUser.bio}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Modern Circular Swipe Actions Panel */}
          {currentUser && currentIndex < users.length && (
            <div style={{ display: 'flex', justifyContent: 'center', gap: '1.2rem', marginTop: '1.5rem', alignItems: 'center' }}>
              
              <button 
                onClick={() => handleMatchAction(currentUser, 'decline')}
                disabled={actionLoading === currentUser._id}
                title="Pass"
                style={{ width: '56px', height: '56px', borderRadius: '50%', background: '#fff', border: '1px solid #e2e8f0', color: '#ef4444', fontSize: '1.2rem', boxShadow: '0 8px 20px rgba(0,0,0,0.06)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'transform 0.1s ease' }}
              >
                ✕
              </button>

              {getButtonConfig(currentUser).isMatched ? (
                <>
                  <button 
                    onClick={() => handleMatchAction(currentUser, 'chat')}
                    disabled={actionLoading === currentUser._id}
                    title="Chat"
                    style={{ width: '64px', height: '64px', borderRadius: '50%', background: 'linear-gradient(135deg, #5b72f2, #7c3aed)', border: 'none', color: '#fff', fontSize: '1.4rem', boxShadow: '0 10px 25px rgba(91,114,242,0.35)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  >
                    💬
                  </button>
                  <button 
                    onClick={() => handleMatchAction(currentUser, 'unmatch')}
                    disabled={actionLoading === currentUser._id}
                    title="Unmatch"
                    style={{ background: '#fee2e2', color: '#ef4444', border: 'none', borderRadius: '20px', padding: '0.6rem 1.1rem', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 12px rgba(239,68,68,0.15)' }}
                  >
                    Unmatch 💔
                  </button>
                </>
              ) : getButtonConfig(currentUser).dualButtons ? (
                <button 
                  onClick={() => handleMatchAction(currentUser, 'accept')}
                  disabled={actionLoading === currentUser._id}
                  title="Accept Match Request"
                  style={{ width: '64px', height: '64px', borderRadius: '50%', background: 'linear-gradient(135deg, #10b981, #059669)', border: 'none', color: '#fff', fontSize: '1.4rem', boxShadow: '0 10px 25px rgba(16,185,129,0.35)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                  ✓
                </button>
              ) : (
                <button 
                  onClick={() => handleMatchAction(currentUser, 'send_request')}
                  disabled={getButtonConfig(currentUser).disabled || actionLoading === currentUser._id}
                  title="Send Request"
                  style={{ width: '68px', height: '68px', borderRadius: '50%', background: 'linear-gradient(135deg, #ff4b4b, #f43f5e)', border: 'none', color: '#fff', fontSize: '1.6rem', boxShadow: '0 10px 25px rgba(255,75,75,0.35)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
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
            <div style={{ textAlign: 'center', color: '#64748b', padding: '4rem', background: '#fff', borderRadius: '20px', border: '1px solid #f1f5f9' }}>No profiles match your filters.</div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '1rem' }}>
              {users.map(user => {
                const btnConfig = getButtonConfig(user);
                const isLoading = actionLoading === user._id;

                return (
                  <div key={user._id} style={{ background: '#fff', borderRadius: '16px', overflow: 'hidden', boxShadow: '0 4px 16px rgba(0,0,0,0.05)', border: '1px solid #f1f5f9', display: 'flex', flexDirection: 'column' }}>
                    <div onClick={() => window.location.hash = `/profile/${user._id}`} style={{ aspectRatio: '3/4', cursor: 'pointer', overflow: 'hidden', position: 'relative' }}>
                      <img src={user.photos?.[0]?.url || user.photos?.[0] || 'https://via.placeholder.com/200'} alt={user.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.8), transparent)', padding: '1rem 0.8rem 0.5rem', color: '#fff' }}>
                        <div style={{ fontWeight: 700, fontSize: '0.95rem', textShadow: '0 1px 2px rgba(0,0,0,0.5)' }}>{user.name}, {user.age || ''}</div>
                        <div style={{ fontSize: '0.7rem', opacity: 0.9, marginTop: '2px' }}>📍 {renderLocation(user.location)}</div>
                      </div>
                    </div>

                    <div style={{ padding: '0.7rem' }}>
                      {btnConfig.isMatched ? (
                        <div style={{ display: 'flex', gap: '6px' }}>
                          <button onClick={() => handleMatchAction(user, 'chat')} disabled={isLoading} style={{ flex: 1, background: '#5b72f2', color: '#fff', border: 'none', borderRadius: '8px', padding: '0.5rem', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer' }}>💬 Chat</button>
                          <button onClick={() => handleMatchAction(user, 'unmatch')} disabled={isLoading} style={{ background: '#fee2e2', color: '#ef4444', border: 'none', borderRadius: '8px', padding: '0.5rem 0.8rem', fontSize: '0.8rem', cursor: 'pointer' }}>💔</button>
                        </div>
                      ) : btnConfig.dualButtons ? (
                        <div style={{ display: 'flex', gap: '6px' }}>
                          <button onClick={() => handleMatchAction(user, 'accept')} disabled={isLoading} style={{ flex: 1, background: '#10b981', color: '#fff', border: 'none', borderRadius: '8px', padding: '0.5rem', fontWeight: 600, cursor: 'pointer' }}>✓ Accept</button>
                          <button onClick={() => handleMatchAction(user, 'decline')} disabled={isLoading} style={{ background: '#ef4444', color: '#fff', border: 'none', borderRadius: '8px', padding: '0.5rem 0.8rem', cursor: 'pointer' }}>✕</button>
                        </div>
                      ) : (
                        <button 
                          onClick={() => handleMatchAction(user, btnConfig.action)}
                          disabled={btnConfig.disabled || isLoading}
                          style={{ 
                            width: '100%', ...btnConfig.style, border: 'none', borderRadius: '8px', padding: '0.55rem', fontSize: '0.85rem', fontWeight: 700,
                            cursor: (btnConfig.disabled || isLoading) ? 'not-allowed' : 'pointer', opacity: isLoading ? 0.7 : 1,
                            boxShadow: btnConfig.disabled ? 'none' : '0 4px 10px rgba(255,75,75,0.2)'
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
