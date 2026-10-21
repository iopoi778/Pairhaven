import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

const API_URL = process.env.REACT_APP_API_URL || 'https://pairhaven.onrender.com';

function AdminScreen() {
  const [users, setUsers] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(null);
  const navigate = useNavigate();

  const token = localStorage.getItem('token');
  const currentUser = JSON.parse(localStorage.getItem('user') || '{}');

  // Verify admin access
  useEffect(() => {
    if (currentUser.role !== 'admin') {
      alert("Access denied. Admins only.");
      navigate('/');
      return;
    }
    fetchUsers();
  }, [search]);

  const fetchUsers = async () => {
    try {
      const res = await axios.get(`${API_URL}/api/admin/users?search=${search}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setUsers(res.data || []);
    } catch (err) {
      console.error("Failed to fetch users", err);
      alert("Failed to load admin data.");
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateTier = async (userId, newTier) => {
    setActionLoading(userId);
    try {
      await axios.patch(`${API_URL}/api/admin/users/${userId}/tier`, { tier: newTier }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      alert(`User tier updated to ${newTier.toUpperCase()} successfully!`);
      fetchUsers();
    } catch (err) {
      alert(err.response?.data?.message || "Failed to update tier");
    } finally {
      setActionLoading(null);
    }
  };

  const handleDeleteUser = async (userId, userName) => {
    if (!window.confirm(`Are you sure you want to permanently delete user "${userName}"? This violates terms action cannot be undone.`)) {
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

  if (loading) {
    return <div style={{ padding: '3rem', textAlign: 'center', color: '#666' }}>Loading Admin Panel...</div>;
  }

  return (
    <div style={{ padding: '1.5rem', maxWidth: '800px', margin: '0 auto', paddingBottom: '100px', fontFamily: 'sans-serif' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '1.6rem', fontWeight: 800, color: '#1e293b' }}>🛡️ Support & Admin Dashboard</h2>
          <p style={{ margin: '4px 0 0', color: '#64748b', fontSize: '0.9rem' }}>Manage users, grant VIP plans, or remove policy violators.</p>
        </div>
      </div>

      {/* Search Bar */}
      <div style={{ marginBottom: '1.5rem' }}>
        <input 
          type="text" 
          placeholder="Search users by name or email..." 
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ width: '100%', padding: '0.8rem 1rem', borderRadius: '12px', border: '1px solid #cbd5e1', fontSize: '0.95rem', boxSizing: 'border-box', outline: 'none' }}
        />
      </div>

      {/* Users List Table / Cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {users.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3rem', background: '#fff', borderRadius: '12px', color: '#666' }}>No users found.</div>
        ) : (
          users.map(u => {
            const isLoading = actionLoading === u._id;
            return (
              <div key={u._id} style={{ background: '#fff', borderRadius: '14px', padding: '1.2rem', boxShadow: '0 2px 8px rgba(0,0,0,0.04)', border: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
                
                {/* User Info */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <img 
                    src={u.photos?.[0]?.url || u.photos?.[0] || 'https://via.placeholder.com/150'} 
                    alt={u.name} 
                    style={{ width: '50px', height: '50px', borderRadius: '50%', objectFit: 'cover' }}
                  />
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '1rem', color: '#1e293b' }}>
                      {u.name} {u.role === 'admin' && <span style={{ background: '#fee2e2', color: '#dc2626', fontSize: '0.7rem', padding: '2px 6px', borderRadius: '6px', marginLeft: '6px' }}>ADMIN</span>}
                    </div>
                    <div style={{ fontSize: '0.85rem', color: '#64748b' }}>{u.email}</div>
                    <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '2px' }}>Current Plan: <strong>{(u.membershipTier || 'standard').toUpperCase()}</strong></div>
                  </div>
                </div>

                {/* Actions Panel */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
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
                      {isLoading ? '...' : 'Delete Account'}
                    </button>
                  )}
                </div>

              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

export default AdminScreen;
