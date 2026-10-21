import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

const API_URL = process.env.REACT_APP_API_URL || 'https://pairhaven.onrender.com';

function AdminScreen() {
  const [activeTab, setActiveTab] = useState('users'); // 'users' or 'support'
  const [users, setUsers] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(null);

  // Chat/Support State
  const [conversations, setConversations] = useState([]);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [chatMessages, setChatMessages] = useState([]);
  const [replyText, setReplyText] = useState('');

  const navigate = useNavigate();
  const token = localStorage.getItem('token');
  const currentUser = JSON.parse(localStorage.getItem('user') || '{}');

  useEffect(() => {
    if (currentUser.role !== 'admin') {
      alert("Access denied. Admins only.");
      navigate('/');
      return;
    }
    if (activeTab === 'users') {
      fetchUsers();
    } else if (activeTab === 'support') {
      fetchConversations();
    }
  }, [search, activeTab]);

  const fetchUsers = async () => {
    try {
      const res = await axios.get(`${API_URL}/api/admin/users?search=${search}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setUsers(res.data || []);
    } catch (err) {
      console.error("Failed to fetch users", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchConversations = async () => {
    try {
      const res = await axios.get(`${API_URL}/api/messages/conversations`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setConversations(res.data || []);
    } catch (err) {
      console.error("Failed to fetch support messages", err);
    } finally {
      setLoading(false);
    }
  };

  const openConversation = async (conv) => {
    setSelectedConversation(conv);
    try {
      const res = await axios.get(`${API_URL}/api/messages/${conv.user._id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setChatMessages(res.data || []);
    } catch (err) {
      console.error("Failed to load message history", err);
    }
  };

  const handleSendReply = async (e) => {
    e.preventDefault();
    if (!replyText.trim() || !selectedConversation) return;

    try {
      const res = await axios.post(`${API_URL}/api/messages`, {
        recipientId: selectedConversation.user._id,
        text: replyText
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      setChatMessages(prev => [...prev, res.data]);
      setReplyText('');
    } catch (err) {
      alert("Failed to send reply");
    }
  };

  const handleUpdateTier = async (userId, newTier) => {
    setActionLoading(userId);
    try {
      await axios.patch(`${API_URL}/api/admin/users/${userId}/tier`, { tier: newTier }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      setUsers(prevUsers =>
        prevUsers.map(u =>
          u._id === userId
            ? { ...u, membershipTier: newTier, isVip: newTier !== 'standard' }
            : u
        )
      );

      alert(`User tier updated to ${newTier.toUpperCase()} successfully!`);
    } catch (err) {
      alert(err.response?.data?.message || "Failed to update tier");
    } finally {
      setActionLoading(null);
    }
  };

  const handleEditBio = async (userId, currentBio) => {
    const newBio = prompt("Edit Bio for user (violating profiles can be cleared):", currentBio || "");
    if (newBio === null) return;

    setActionLoading(userId);
    try {
      await axios.patch(`${API_URL}/api/admin/users/${userId}/profile`, { bio: newBio }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      alert("User profile updated successfully!");
      fetchUsers();
    } catch (err) {
      alert("Failed to update user profile");
    } finally {
      setActionLoading(null);
    }
  };

  // ✅ New Handler: Update Profile Picture URL directly
  const handleUpdatePhoto = async (userId, currentPhotos) => {
    const currentUrl = currentPhotos?.[0]?.url || currentPhotos?.[0] || '';
    const newPhotoUrl = prompt("Enter new profile picture image URL:", currentUrl);
    
    if (!newPhotoUrl || !newPhotoUrl.trim()) return;

    setActionLoading(userId);
    try {
      const updatedPhotos = [{ url: newPhotoUrl.trim(), isPrimary: true }];
      await axios.patch(`${API_URL}/api/admin/users/${userId}/profile`, { photos: updatedPhotos }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      alert("Profile picture updated successfully!");
      fetchUsers();
    } catch (err) {
      alert("Failed to update profile photo");
    } finally {
      setActionLoading(null);
    }
  };

  const handleDeleteUser = async (userId, userName) => {
    if (!window.confirm(`Are you sure you want to permanently delete user "${userName}"? This action cannot be undone.`)) {
      return;
    }

    setActionLoading(userId);
    try {
      await axios.delete(`${API_URL}/api/admin/users/${userId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      alert("User account deleted successfully.");
      setUsers(prev => prev.filter(u => u._id !== userId));
    } catch (err) {
      alert(err.response?.data?.message || "Failed to delete user");
    } finally {
      setActionLoading(null);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    axios.defaults.headers.common['Authorization'] = '';
    navigate('/login', { replace: true });
  };

  if (loading) {
    return <div style={{ padding: '3rem', textAlign: 'center', color: '#666' }}>Loading Admin Panel...</div>;
  }

  return (
    <div style={{ padding: '1.5rem', maxWidth: '800px', margin: '0 auto', paddingBottom: '100px', fontFamily: 'sans-serif' }}>
      
      {/* Header with Logout Button */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '1.6rem', fontWeight: 800, color: '#1e293b' }}>🛡️ Admin & Support Center</h2>
          <p style={{ margin: '4px 0 0', color: '#64748b', fontSize: '0.9rem' }}>Manage users, review policy violations, or reply to customer support inquiries.</p>
        </div>

        {/* 🔴 Logout Button */}
        <button 
          onClick={handleLogout}
          style={{
            background: '#fee2e2',
            color: '#dc2626',
            border: '1px solid #fca5a5',
            borderRadius: '10px',
            padding: '0.6rem 1.1rem',
            fontWeight: 700,
            fontSize: '0.88rem',
            cursor: 'pointer'
          }}
        >
          🚪 Log Out
        </button>
      </div>

      {/* Tabs Switcher */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '1.5rem' }}>
        <button 
          onClick={() => setActiveTab('users')}
          style={{
            flex: 1, padding: '0.75rem', borderRadius: '10px', border: 'none',
            background: activeTab === 'users' ? '#5b72f2' : '#e2e8f0',
            color: activeTab === 'users' ? '#fff' : '#475569',
            fontWeight: 700, cursor: 'pointer'
          }}
        >
          👥 User Management
        </button>
        <button 
          onClick={() => setActiveTab('support')}
          style={{
            flex: 1, padding: '0.75rem', borderRadius: '10px', border: 'none',
            background: activeTab === 'support' ? '#5b72f2' : '#e2e8f0',
            color: activeTab === 'support' ? '#fff' : '#475569',
            fontWeight: 700, cursor: 'pointer'
          }}
        >
          💬 Support Inbox ({conversations.length})
        </button>
      </div>

      {/* ================= USER MANAGEMENT TAB ================= */}
      {activeTab === 'users' && (
        <>
          <div style={{ marginBottom: '1.5rem' }}>
            <input 
              type="text" 
              placeholder="Search users by name or email..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ width: '100%', padding: '0.8rem 1rem', borderRadius: '12px', border: '1px solid #cbd5e1', fontSize: '0.95rem', boxSizing: 'border-box', outline: 'none' }}
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {users.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '3rem', background: '#fff', borderRadius: '12px', color: '#666' }}>No users found.</div>
            ) : (
              users.map(u => {
                const isLoading = actionLoading === u._id;
                return (
                  <div key={u._id} style={{ background: '#fff', borderRadius: '14px', padding: '1.2rem', boxShadow: '0 2px 8px rgba(0,0,0,0.04)', border: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
                    
                    {/* User Profile Info */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                      <div style={{ position: 'relative' }}>
                        <img 
                          src={u.photos?.[0]?.url || u.photos?.[0] || 'https://via.placeholder.com/150'} 
                          alt={u.name} 
                          style={{ width: '50px', height: '50px', borderRadius: '50%', objectFit: 'cover' }}
                        />
                        {/* 📷 Change Avatar Button */}
                        <button
                          onClick={() => handleUpdatePhoto(u._id, u.photos)}
                          title="Change Profile Picture"
                          style={{
                            position: 'absolute', bottom: '-2px', right: '-2px', background: '#5b72f2',
                            color: '#fff', border: 'none', borderRadius: '50%', width: '20px', height: '20px',
                            fontSize: '0.65rem', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer'
                          }}
                        >
                          📷
                        </button>
                      </div>

                      <div>
                        <div style={{ fontWeight: 700, fontSize: '1rem', color: '#1e293b' }}>
                          {u.name} {u.role === 'admin' && <span style={{ background: '#fee2e2', color: '#dc2626', fontSize: '0.7rem', padding: '2px 6px', borderRadius: '6px', marginLeft: '6px' }}>ADMIN</span>}
                        </div>
                        <div style={{ fontSize: '0.85rem', color: '#64748b' }}>{u.email}</div>
                        <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '2px' }}>Plan: <strong>{(u.membershipTier || 'standard').toUpperCase()}</strong></div>
                      </div>
                    </div>

                    {/* Actions Panel */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      {/* Edit Bio Button */}
                      <button
                        onClick={() => handleEditBio(u._id, u.bio)}
                        disabled={isLoading}
                        style={{ background: '#f1f5f9', border: '1px solid #cbd5e1', color: '#334155', borderRadius: '8px', padding: '0.5rem 0.8rem', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer' }}
                      >
                        ✏️ Bio
                      </button>

                      {/* Tier Change Dropdown */}
                      <select 
                        value={u.membershipTier || 'standard'} 
                        disabled={isLoading}
                        onChange={(e) => handleUpdateTier(u._id, e.target.value)}
                        style={{ padding: '0.5rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.85rem', background: '#f8fafc', fontWeight: 600, cursor: 'pointer' }}
                      >
                        <option value="standard">Standard</option>
                        <option value="pro">Pro ($2)</option>
                        <option value="unlimited">Unlimited ($5)</option>
                      </select>

                      {/* Delete / Ban Account Button */}
                      {u.role !== 'admin' && (
                        <button 
                          onClick={() => handleDeleteUser(u._id, u.name)}
                          disabled={isLoading}
                          style={{ background: '#fee2e2', color: '#dc2626', border: 'none', borderRadius: '8px', padding: '0.5rem 0.9rem', fontSize: '0.85rem', fontWeight: 700, cursor: 'pointer' }}
                        >
                          {isLoading ? '...' : 'Delete'}
                        </button>
                      )}
                    </div>

                  </div>
                );
              })
            )}
          </div>
        </>
      )}

      {/* ================= SUPPORT INBOX TAB ================= */}
      {activeTab === 'support' && (
        <div style={{ display: 'grid', gridTemplateColumns: selectedConversation ? '1fr 1.5fr' : '1fr', gap: '1rem' }}>
          
          {/* Conversation List */}
          <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '1rem' }}>
            <h4 style={{ margin: '0 0 1rem', color: '#334155' }}>User Complaints & Messages</h4>
            {conversations.length === 0 ? (
              <div style={{ color: '#94a3b8', fontSize: '0.9rem' }}>No messages found.</div>
            ) : (
              conversations.map(c => (
                <div 
                  key={c.user._id}
                  onClick={() => openConversation(c)}
                  style={{
                    padding: '0.8rem', borderRadius: '8px', cursor: 'pointer', marginBottom: '8px',
                    background: selectedConversation?.user?._id === c.user._id ? '#eef2ff' : '#f8fafc',
                    border: '1px solid #e2e8f0'
                  }}
                >
                  <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>{c.user.name}</div>
                  <div style={{ fontSize: '0.8rem', color: '#64748b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {c.lastMessage?.text || 'Sent an attachment'}
                  </div>
                </div>
              ))
            )}
          </div>
  {/* Inside the users map loop in AdminScreen.js */}
<div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
  
  {/* 🟦⭐ Toggle Blue Badge Button */}
  <button
    onClick={async () => {
      const nextStatus = u.verificationStatus === 'verified' ? 'not_verified' : 'verified';
      try {
        await axios.patch(`${API_URL}/api/admin/users/${u._id}/verify`, 
          { status: nextStatus }, 
          { headers: { Authorization: `Bearer ${token}` } }
        );

        // Optimistically update local React state
        setUsers(prev => prev.map(userItem => 
          userItem._id === u._id 
            ? { ...userItem, verificationStatus: nextStatus } 
            : userItem
        ));

        alert(`User is now ${nextStatus === 'verified' ? 'VERIFIED (🟦★)' : 'UNVERIFIED'}`);
      } catch (err) {
        alert("Failed to update verification status.");
      }
    }}
    style={{
      background: u.verificationStatus === 'verified' ? '#dbeafe' : '#f1f5f9',
      color: u.verificationStatus === 'verified' ? '#1d4ed8' : '#64748b',
      border: '1px solid #bfdbfe',
      borderRadius: '8px',
      padding: '0.5rem 0.8rem',
      fontSize: '0.82rem',
      fontWeight: 700,
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      gap: '4px'
    }}
  >
    {u.verificationStatus === 'verified' ? '🟦★ Verified' : 'Grant 🟦★ Badge'}
  </button>

</div>
          {/* Active Reply Pane */}
          {selectedConversation && (
            <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '1rem', display: 'flex', flexDirection: 'column', height: '450px' }}>
              <div style={{ borderBottom: '1px solid #e2e8f0', paddingBottom: '0.5rem', marginBottom: '1rem', fontWeight: 700 }}>
                Chatting with: {selectedConversation.user.name}
              </div>

              {/* Messages Container */}
              <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px', paddingRight: '4px' }}>
                {chatMessages.map(m => {
                  const isSupport = m.sender === currentUser._id || m.sender?._id === currentUser._id;
                  return (
                    <div 
                      key={m._id || Math.random()}
                      style={{
                        alignSelf: isSupport ? 'flex-end' : 'flex-start',
                        background: isSupport ? '#5b72f2' : '#f1f5f9',
                        color: isSupport ? '#fff' : '#1e293b',
                        padding: '0.6rem 0.9rem', borderRadius: '12px', maxWidth: '80%', fontSize: '0.9rem'
                      }}
                    >
                      {m.text}
                    </div>
                  );
                })}
              </div>

              {/* Reply Form */}
              <form onSubmit={handleSendReply} style={{ display: 'flex', gap: '8px', marginTop: '1rem' }}>
                <input 
                  type="text" 
                  placeholder="Type support reply..."
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  style={{ flex: 1, padding: '0.6rem', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none' }}
                />
                <button type="submit" style={{ background: '#5b72f2', color: '#fff', border: 'none', borderRadius: '8px', padding: '0 1rem', fontWeight: 700, cursor: 'pointer' }}>
                  Send
                </button>
              </form>
            </div>
          )}

        </div>
      )}

    </div>
  );
}

export default AdminScreen;
