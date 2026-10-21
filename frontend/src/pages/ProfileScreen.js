import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

const API_URL = process.env.REACT_APP_API_URL || 'https://pairhaven.onrender.com';

function ProfileScreen({ userId }) {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [posts, setPosts] = useState([]);
  const [isEditingBio, setIsEditingBio] = useState(false);
  const [bioText, setBioText] = useState('');
  const [loading, setLoading] = useState(true);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  
  // Modals State
  const [showPostModal, setShowPostModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  
  // Post Creation State
  const [newPostText, setNewPostText] = useState('');
  const [newPostMedia, setNewPostMedia] = useState(null);
  const [posting, setPosting] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  // Password Update State
  const [passwords, setPasswords] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [updatingPassword, setUpdatingPassword] = useState(false);

  const token = localStorage.getItem('token');
  const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
  const isOwnProfile = userId === currentUser._id || !userId;

  useEffect(() => {
    const fetchData = async () => {
      try {
        const profileRes = await axios.get(`${API_URL}/api/users/profile/${userId || 'me'}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setUser(profileRes.data);
        setBioText(profileRes.data.bio || '');

        const postsRes = await axios.get(`${API_URL}/api/users/profile/${profileRes.data._id}/posts`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setPosts(postsRes.data);
      } catch (err) {
        console.error("Failed to load profile", err);
      } finally {
        setLoading(false);
      }
    };
    if (token) fetchData();
  }, [userId, token]);

  // Safe Location Helper
  const renderLocation = (loc) => {
    if (!loc) return 'Location not specified';
    if (typeof loc === 'object') {
      const parts = [loc.address || loc.city || loc.name, loc.country].filter(Boolean);
      return parts.length > 0 ? parts.join(', ') : 'Location specified';
    }
    return loc;
  };

  // Match Request Handlers
  const handleSendRequest = async (targetUserId) => {
    try {
      await axios.post(`${API_URL}/api/users/request/${targetUserId}`, {}, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      alert("Match request sent!");
    } catch (err) {
      if (err.response && err.response.status === 403) {
        const choice = window.confirm("You've run out of match coins for today! \n\nClick 'OK' to watch an ad for +3 Match Coins & +3 Chat Coins, or 'Cancel' to upgrade.");
        if (choice) {
          handleWatchAd();
        } else {
          alert("Upgrade to Pro or Unlimited for more capacity!");
        }
      } else {
        alert(err.response?.data?.message || "Error sending request");
      }
    }
  };

  const handleWatchAd = async () => {
    alert("Playing reward ad... (Simulated)");
    setTimeout(async () => {
      try {
        const res = await axios.post(`${API_URL}/api/users/reward-ad-matches`, {}, {
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
        });
        alert(res.data.message);
        // Refresh profile data to update remaining coins
        const profileRes = await axios.get(`${API_URL}/api/users/profile/me/photo`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        
        setUser(profileRes.data);
      } catch (e) {
        alert("Failed to claim ad reward.");
      }
    }, 2000);
  };

  // Flutterwave Payment Integration
  const handleFlutterwavePayment = (plan, priceInUsd) => {
    const FLUTTERWAVE_PUBLIC_KEY = process.env.REACT_APP_FLUTTERWAVE_PUBLIC_KEY || 'FLWPUBK_TEST-your_public_key_here';

    if (!window.FlutterwaveCheckout) {
      alert("Payment gateway script is still loading. Please try again in a moment.");
      return;
    }

    window.FlutterwaveCheckout({
      public_key: FLUTTERWAVE_PUBLIC_KEY,
      tx_ref: "ph_tx_" + Date.now(),
      amount: priceInUsd, 
      currency: "USD",
      payment_options: "card, mobilemoney, banktransfer, ussd",
      customer: {
        email: user.email,
        name: user.name,
        phone_number: user.phone || ""
      },
      customizations: {
        title: "PairHaven Membership Upgrade",
        description: `Upgrade to ${plan.toUpperCase()} plan`,
        logo: "https://via.placeholder.com/150"
      },
      callback: function (response) {
        if (response.status === "successful") {
          verifyFlutterwavePayment(response.transaction_id, plan);
        } else {
          alert("Payment was not completed.");
        }
      },
      onclose: function() {
        console.log("Payment window closed.");
      }
    });
  };

  const verifyFlutterwavePayment = async (transactionId, plan) => {
    try {
      const res = await axios.post(`${API_URL}/api/users/verify-flutterwave`, { transactionId, plan }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      setUser(prev => ({ 
        ...prev, 
        isVip: true, 
        membershipTier: plan 
      }));
      alert(res.data.message || `Successfully upgraded to ${plan.toUpperCase()} 🎉`);
    } catch (err) {
      alert(err.response?.data?.message || "Payment verification failed.");
    }
  };

  const handleAcceptRequest = async () => {
    setActionLoading(true);
    try {
      await axios.post(`${API_URL}/api/users/accept-request/${user._id}`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setUser(prev => ({ 
        ...prev, 
        matches: [...(prev.matches || []), currentUser._id],
        requestsReceived: (prev.requestsReceived || []).filter(id => id !== currentUser._id)
      }));
      alert("Match accepted! You can now chat.");
    } catch (err) { 
      alert(err.response?.data?.message || "Failed to accept request"); 
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeclineRequest = async () => {
    setActionLoading(true);
    try {
      await axios.delete(`${API_URL}/api/users/request/${user._id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setUser(prev => ({ 
        ...prev, 
        requestsReceived: (prev.requestsReceived || []).filter(id => id !== currentUser._id)
      }));
    } catch (err) { 
      alert("Failed to decline request"); 
    } finally {
      setActionLoading(false);
    }
  };

  const handleOpenChat = () => {
    localStorage.setItem('activeTab', 'messages');
    window.location.hash = '/';
  };

  const handleCreatePost = async () => {
    if (!newPostText.trim() && !newPostMedia) return;
    setPosting(true);
    
    const formData = new FormData();
    formData.append('text', newPostText);
    if (newPostMedia) {
      formData.append('media', newPostMedia);
    }
    
    try {
      const res = await axios.post(`${API_URL}/api/posts`, formData, {
        headers: { 
          Authorization: `Bearer ${token}`,
          'Content-Type': 'multipart/form-data'
        }
      });
      
      setPosts(prev => [res.data, ...prev]);
      setNewPostText('');
      setNewPostMedia(null);
      setShowPostModal(false);
    } catch (err) {
      alert(err.response?.data?.message || "Failed to create post");
    } finally {
      setPosting(false);
    }
  };

  const handlePhotoUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploadingPhoto(true);
    const formData = new FormData();
    formData.append('photo', file);
    try {
      const res = await axios.patch(`${API_URL}/api/users/profile/me/photo`, formData, {
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'multipart/form-data' }
      });
      const updatedPhotos = res.data.photos || [...(user.photos || []), res.data.photoUrl];
      setUser(prev => ({ ...prev, photos: updatedPhotos }));
      alert("Photo added successfully!");
    } catch (err) {
      alert(err.response?.data?.message || "Failed to upload photo");
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleRemovePhoto = async (photoIndex) => {
    if (!window.confirm("Remove this photo?")) return;
    try {
      const updatedPhotos = user.photos.filter((_, idx) => idx !== photoIndex);
      await axios.patch(`${API_URL}/api/users/profile/me`, { photos: updatedPhotos }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setUser(prev => ({ ...prev, photos: updatedPhotos }));
    } catch (err) {
      alert("Failed to remove photo");
    }
  };

  const handleSaveBio = async () => {
    try {
      await axios.patch(`${API_URL}/api/users/profile/me`, { bio: bioText }, { headers: { Authorization: `Bearer ${token}` } });
      setUser(prev => ({ ...prev, bio: bioText }));
      setIsEditingBio(false);
    } catch (err) { alert("Failed to update bio"); }
  };

  const handleTogglePrivacy = async () => {
    try {
      const newStatus = !user.isPrivate;
      await axios.patch(`${API_URL}/api/users/profile/me`, { isPrivate: newStatus }, { headers: { Authorization: `Bearer ${token}` } });
      setUser(prev => ({ ...prev, isPrivate: newStatus }));
    } catch (err) { alert("Failed to update privacy"); }
  };

  const handleDeletePost = async (postId) => {
    if (!window.confirm("Delete this post?")) return;
    try {
      await axios.delete(`${API_URL}/api/posts/${postId}`, { headers: { Authorization: `Bearer ${token}` } });
      setPosts(prev => prev.filter(p => p._id !== postId));
    } catch (err) { alert("Failed to delete post"); }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (passwords.newPassword !== passwords.confirmPassword) {
      return alert("New passwords do not match.");
    }
    setUpdatingPassword(true);
    try {
      await axios.patch(`${API_URL}/api/users/password`, {
        currentPassword: passwords.currentPassword,
        newPassword: passwords.newPassword
      }, { headers: { Authorization: `Bearer ${token}` } });
      
      alert("Password updated successfully!");
      setShowPasswordModal(false);
      setPasswords({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (err) {
      alert(err.response?.data?.message || "Failed to update password");
    } finally {
      setUpdatingPassword(false);
    }
  };

  const handleDeleteAccount = async () => {
    const confirmation = window.prompt("Type 'DELETE' to permanently delete your account and all data:");
    if (confirmation !== 'DELETE') return;

    try {
      await axios.delete(`${API_URL}/api/users/profile/me`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      alert("Your account has been deleted.");
      handleLogout();
    } catch (err) {
      alert(err.response?.data?.message || "Failed to delete account");
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    delete axios.defaults.headers.common['Authorization'];
    navigate('/login', { replace: true });
  };

  const getPhotoUrl = (p) => {
    if (!p) return 'https://via.placeholder.com/150';
    return typeof p === 'string' ? p : p.url;
  };

  if (loading) return <div style={{padding:'3rem', textAlign:'center', color: '#666'}}>Loading profile...</div>;
  if (!user) return <div style={{padding:'3rem', textAlign:'center', color: '#666'}}>User not found.</div>;

  const photosList = Array.isArray(user.photos) ? user.photos : [];

  // Standard Plan Daily Coins Calculation
  const maxStandardMatches = 10;
  const maxStandardChats = 10;
  const matchesUsed = user.matchesSentToday || 0;
  const chatsUsed = user.chatsSentToday || 0;
  const remainingMatchCoins = Math.max(0, maxStandardMatches - matchesUsed);
  const remainingChatCoins = Math.max(0, maxStandardChats - chatsUsed);

  return (
    <div style={{ padding: '1rem', paddingBottom: '100px', maxWidth: '500px', margin: '0 auto', position: 'relative' }}>
      
      {/* HEADER BAR FOR OWN PROFILE */}
      {isOwnProfile && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h2 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 700 }}>My Profile</h2>
          <button 
            onClick={() => setShowSettingsModal(true)} 
            style={{ background: '#f0f2f5', border: 'none', padding: '0.5rem 1rem', borderRadius: '20px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            ⚙️ Settings
          </button>
        </div>
      )}

      {/* SETTINGS MODAL */}
      {showSettingsModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '1rem' }}>
          <div style={{ background: '#fff', width: '100%', maxWidth: '400px', borderRadius: '16px', padding: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.2rem' }}>
              <h3 style={{ margin: 0 }}>Account Settings</h3>
              <button onClick={() => setShowSettingsModal(false)} style={{ background: 'none', border: 'none', fontSize: '1.2rem', cursor: 'pointer' }}>✕</button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <button 
                onClick={() => { setShowSettingsModal(false); setShowPasswordModal(true); }}
                style={{ width: '100%', padding: '0.8rem', background: '#f8f9fa', border: '1px solid #e2e8f0', borderRadius: '10px', fontWeight: 600, cursor: 'pointer', textAlign: 'left' }}
              >
                🔒 Change Password
              </button>
              <button 
                onClick={handleLogout}
                style={{ width: '100%', padding: '0.8rem', background: '#f8f9fa', border: '1px solid #e2e8f0', borderRadius: '10px', fontWeight: 600, cursor: 'pointer', textAlign: 'left', color: '#e53e3e' }}
              >
                🚪 Logout
              </button>
              <button 
                onClick={handleDeleteAccount}
                style={{ width: '100%', padding: '0.8rem', background: '#fee2e2', border: '1px solid #fecaca', borderRadius: '10px', fontWeight: 600, cursor: 'pointer', textAlign: 'left', color: '#dc2626', marginTop: '0.5rem' }}
              >
                ⚠️ Delete Account Permanently
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CHANGE PASSWORD MODAL */}
      {showPasswordModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1100, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '1rem' }}>
          <div style={{ background: '#fff', width: '100%', maxWidth: '400px', borderRadius: '16px', padding: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ margin: 0 }}>Change Password</h3>
              <button onClick={() => setShowPasswordModal(false)} style={{ background: 'none', border: 'none', fontSize: '1.2rem', cursor: 'pointer' }}>✕</button>
            </div>
            
            <form onSubmit={handleChangePassword}>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '4px' }}>Current Password</label>
                <input type="password" required value={passwords.currentPassword} onChange={e => setPasswords({...passwords, currentPassword: e.target.value})} style={{ width: '100%', padding: '8px', borderRadius: '8px', border: '1px solid #ddd', boxSizing: 'border-box' }} />
              </div>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '4px' }}>New Password</label>
                <input type="password" required value={passwords.newPassword} onChange={e => setPasswords({...passwords, newPassword: e.target.value})} style={{ width: '100%', padding: '8px', borderRadius: '8px', border: '1px solid #ddd', boxSizing: 'border-box' }} />
              </div>
              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '4px' }}>Confirm New Password</label>
                <input type="password" required value={passwords.confirmPassword} onChange={e => setPasswords({...passwords, confirmPassword: e.target.value})} style={{ width: '100%', padding: '8px', borderRadius: '8px', border: '1px solid #ddd', boxSizing: 'border-box' }} />
              </div>
              
              <button type="submit" disabled={updatingPassword} style={{ width: '100%', background: '#5b72f2', color: '#fff', border: 'none', padding: '0.75rem', borderRadius: '10px', fontWeight: 700, cursor: updatingPassword ? 'wait' : 'pointer' }}>
                {updatingPassword ? 'Updating...' : 'Update Password'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* POST MODAL */}
      {showPostModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div style={{ background: '#fff', borderRadius: '16px', width: '100%', maxWidth: '400px', maxHeight: '80vh', overflowY: 'auto', padding: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ margin: 0 }}>Create New Post</h3>
              <button onClick={() => setShowPostModal(false)} style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer' }}>✕</button>
            </div>
            <textarea value={newPostText} onChange={e => setNewPostText(e.target.value)} placeholder="What's on your mind?" rows="4" style={{ width: '100%', border: '1px solid #ddd', borderRadius: '8px', padding: '0.8rem', resize: 'none', fontSize: '1rem', boxSizing: 'border-box' }} />
            {newPostMedia && (
              <div style={{ marginTop: '1rem', position: 'relative' }}>
                <img src={URL.createObjectURL(newPostMedia)} alt="Preview" style={{ width: '100%', borderRadius: '8px', maxHeight: '200px', objectFit: 'cover' }} />
                <button onClick={() => setNewPostMedia(null)} style={{ position: 'absolute', top: '-8px', right: '-8px', background: '#fff', border: '1px solid #ddd', borderRadius: '50%', width: '24px', height: '24px', cursor: 'pointer' }}>×</button>
              </div>
            )}
            <div style={{ marginTop: '1rem', display: 'flex', gap: '1rem', alignItems: 'center' }}>
              <label style={{ cursor: 'pointer', color: '#5b72f2', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
                📷 Add Photo
                <input type="file" accept="image/*" onChange={e => setNewPostMedia(e.target.files[0])} style={{ display: 'none' }} />
              </label>
              <button onClick={handleCreatePost} disabled={posting || (!newPostText.trim() && !newPostMedia)} style={{ marginLeft: 'auto', background: '#5b72f2', color: '#fff', border: 'none', borderRadius: '20px', padding: '0.6rem 1.5rem', fontWeight: 600, cursor: posting ? 'wait' : 'pointer', opacity: posting ? 0.7 : 1 }}>
                {posting ? 'Posting...' : 'Share'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* FLOATING "+" POST BUTTON */}
      {isOwnProfile && (
        <button onClick={() => setShowPostModal(true)} style={{ position: 'fixed', bottom: '90px', right: '20px', background: '#5b72f2', color: '#fff', border: 'none', borderRadius: '50%', width: '56px', height: '56px', fontSize: '2rem', cursor: 'pointer', boxShadow: '0 4px 12px rgba(91, 114, 242, 0.4)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>+</button>
      )}

      {/* PROFILE CARD HERO SECTION */}
      <div style={{ background: '#fff', borderRadius: '16px', padding: '1.5rem', boxShadow: '0 4px 16px rgba(0,0,0,0.06)', marginBottom: '1.5rem', textAlign: 'center', position: 'relative' }}>
        <div style={{ position: 'relative', display: 'inline-block', marginBottom: '0.8rem' }}>
          <img src={getPhotoUrl(photosList[0])} alt={user.name} style={{ width: 100, height: 100, borderRadius: '50%', objectFit: 'cover', border: '3px solid #f0f2f5', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }} />
          {isOwnProfile && (
            <label style={{ position: 'absolute', bottom: 0, right: 0, background: '#5b72f2', color: '#fff', borderRadius: '50%', width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: uploadingPhoto ? 'wait' : 'pointer', border: '2px solid #fff', fontSize: '0.9rem' }}>
              📷
              <input type="file" accept="image/*" onChange={handlePhotoUpload} disabled={uploadingPhoto} style={{ display: 'none' }} />
            </label>
          )}
        </div>

        <h2 style={{ margin: '0 0 0.3rem', fontSize: '1.5rem', fontWeight: 700 }}>{user.name}</h2>
        
        <p style={{ margin: '0 0 0.6rem', color: '#666', fontSize: '0.95rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
          <span>{user.age ? `${user.age} yrs` : ''}</span>
          {user.age && renderLocation(user.location) ? ' • ' : ''}
          <span>📍 {renderLocation(user.location)}</span>
        </p>

        {/* PUBLIC MEMBERSHIP PLAN BADGE (VISIBLE TO EVERYONE) */}
        <div style={{ margin: '0.2rem 0 1rem', display: 'inline-block', padding: '4px 14px', borderRadius: '12px', background: user.membershipTier === 'unlimited' ? 'linear-gradient(135deg, #ff4b4b, #dc2626)' : user.membershipTier === 'pro' ? '#5b72f2' : '#e2e8f0', color: user.membershipTier ? '#fff' : '#475569', fontSize: '0.8rem', fontWeight: 700 }}>
          {user.membershipTier === 'unlimited' ? '👑 Unlimited Plan' : user.membershipTier === 'pro' ? '⭐ Pro Plan' : 'Standard Member'}
        </div>

        {/* MATCH ACTION BUTTONS */}
        {!isOwnProfile && (
          <div style={{ display: 'flex', gap: '10px', marginBottom: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
            {currentUser.requestsSent?.includes(user._id) && (
              <button disabled style={{ background: '#ccc', color: '#fff', border: 'none', borderRadius: '20px', padding: '0.6rem 1.5rem', cursor: 'not-allowed', fontSize: '0.9rem' }}>⏳ Request Sent</button>
            )}

            {currentUser.requestsReceived?.includes(user._id) && (
              <>
                <button onClick={handleAcceptRequest} disabled={actionLoading} style={{ background: '#10b981', color: '#fff', border: 'none', borderRadius: '20px', padding: '0.6rem 1.5rem', cursor: actionLoading ? 'wait' : 'pointer', fontSize: '0.9rem' }}>✅ Accept Match</button>
                <button onClick={handleDeclineRequest} disabled={actionLoading} style={{ background: '#e53e3e', color: '#fff', border: 'none', borderRadius: '20px', padding: '0.6rem 1.5rem', cursor: actionLoading ? 'wait' : 'pointer', fontSize: '0.9rem' }}>❌ Decline</button>
              </>
            )}

            {currentUser.matches?.includes(user._id) && (
              <button onClick={handleOpenChat} style={{ background: '#5b72f2', color: '#fff', border: 'none', borderRadius: '20px', padding: '0.6rem 1.5rem', cursor: 'pointer', fontSize: '0.9rem' }}>💬 Message</button>
            )}

            {!currentUser.requestsSent?.includes(user._id) && 
             !currentUser.requestsReceived?.includes(user._id) && 
             !currentUser.matches?.includes(user._id) && (
              <button onClick={() => handleSendRequest(user._id)} disabled={actionLoading} style={{ background: '#5b72f2', color: '#fff', border: 'none', borderRadius: '20px', padding: '0.6rem 1.5rem', cursor: actionLoading ? 'wait' : 'pointer', fontSize: '0.9rem' }}>❤️ Send Match Request</button>
            )}
          </div>
        )}

        {isOwnProfile && (
          <button onClick={handleTogglePrivacy} style={{ background: user.isPrivate ? '#fee2e2' : '#d1fae5', color: user.isPrivate ? '#dc2626' : '#047857', border: 'none', borderRadius: '20px', padding: '0.4rem 1rem', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600, display: 'block', margin: '0.5rem auto 0' }}>
            {user.isPrivate ? '🔒 Private Account' : '🔓 Public Account'}
          </button>
        )}
      </div>

      {/* MEMBERSHIP & COINS MANAGEMENT SECTION (ONLY VISIBLE ON OWN PROFILE) */}
      {isOwnProfile && (
        <div style={{ background: user.isVip ? 'linear-gradient(135deg, #f6d365, #fda085)' : '#fff', borderRadius: '12px', padding: '1.2rem', boxShadow: '0 2px 8px rgba(0,0,0,0.04)', marginBottom: '1.5rem', textAlign: 'center' }}>
          <h4 style={{ margin: '0 0 0.5rem', fontSize: '1rem', color: user.isVip ? '#fff' : '#333' }}>
            {user.membershipTier === 'unlimited' ? '👑 Unlimited Plan Active' : user.membershipTier === 'pro' ? '⭐ Pro Plan Active' : '⭐ Standard Plan Balances'}
          </h4>

          {/* SHOW REMAINING COIN BALANCES ONLY IF OWNER IS ON STANDARD PLAN */}
          {(!user.membershipTier || user.membershipTier === 'standard') && (
            <div style={{ display: 'flex', justifyContent: 'space-around', margin: '1rem 0', background: '#f8fafc', padding: '0.8rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
              <div>
                <strong style={{ fontSize: '1.1rem', color: '#1e293b' }}>{remainingMatchCoins} / 10</strong>
                <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Match Coins</div>
              </div>
              <div>
                <strong style={{ fontSize: '1.1rem', color: '#1e293b' }}>{remainingChatCoins} / 10</strong>
                <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Chat Coins</div>
              </div>
            </div>
          )}

          <p style={{ margin: '0 0 1rem', fontSize: '0.85rem', color: user.isVip ? '#fff' : '#666' }}>
            {user.membershipTier === 'unlimited' ? 'You have unlimited daily matches & unlimited chats!' : user.membershipTier === 'pro' ? 'Pro Plan: 50 Match Coins & Unlimited Chat Active!' : 'Get more coins by watching ads or upgrading your plan!'}
          </p>

          {/* AD REWARD BUTTON FOR STANDARD USERS */}
          {(!user.membershipTier || user.membershipTier === 'standard') && (
            <button 
              onClick={handleWatchAd}
              style={{ background: '#10b981', color: '#fff', border: 'none', borderRadius: '20px', padding: '0.55rem 1.2rem', fontWeight: 600, cursor: 'pointer', fontSize: '0.82rem', display: 'block', margin: '0 auto 1rem', boxShadow: '0 2px 6px rgba(16,185,129,0.2)' }}
            >
              📺 Watch Ad (+3 Match Coins & +3 Chats)
            </button>
          )}

          {/* UPGRADE OPTIONS FOR PRO & UNLIMITED PLANS */}
          {user.membershipTier !== 'unlimited' && (
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', flexWrap: 'wrap' }}>
              {user.membershipTier !== 'pro' && (
                <button 
                  onClick={() => handleFlutterwavePayment('pro', 2)}
                  style={{ background: '#5b72f2', color: '#fff', border: 'none', borderRadius: '20px', padding: '0.6rem 1.2rem', fontWeight: 700, cursor: 'pointer', fontSize: '0.85rem' }}
                >
                  ⭐ Pro Plan ($2) - 50 Coins + Unlim. Chat
                </button>
              )}
              <button 
                onClick={() => handleFlutterwavePayment('unlimited', 5)}
                style={{ background: 'linear-gradient(135deg, #ff4b4b, #5b72f2)', color: '#fff', border: 'none', borderRadius: '20px', padding: '0.6rem 1.2rem', fontWeight: 700, cursor: 'pointer', fontSize: '0.85rem' }}
              >
                👑 Unlimited Plan ($5) - Unlim. Coins & Chat
              </button>
            </div>
          )}
        </div>
      )}

      {/* STATS ROW */}
      <div style={{ display: 'flex', justifyContent: 'space-around', background: '#fff', borderRadius: '12px', padding: '1rem', boxShadow: '0 2px 8px rgba(0,0,0,0.04)', marginBottom: '1.5rem' }}>
        <div style={{textAlign:'center'}}><strong style={{fontSize:'1.1rem'}}>{posts.length}</strong><br/><span style={{fontSize:'0.8rem',color:'#666'}}>Posts</span></div>
        <div style={{textAlign:'center'}}><strong style={{fontSize:'1.1rem'}}>{user.matchesCount || 0}</strong><br/><span style={{fontSize:'0.8rem',color:'#666'}}>Matches</span></div>
      </div>

      {/* PHOTOS SECTION */}
      <div style={{ background: '#fff', padding: '1.2rem', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.04)', marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.8rem' }}>
          <h4 style={{ margin: 0, fontSize: '0.95rem', color: '#444' }}>Photos ({photosList.length})</h4>
          {isOwnProfile && (
            <label style={{ color: '#5b72f2', fontSize: '0.85rem', fontWeight: 600, cursor: uploadingPhoto ? 'wait' : 'pointer' }}>
              + Add Photo
              <input type="file" accept="image/*" onChange={handlePhotoUpload} disabled={uploadingPhoto} style={{ display: 'none' }} />
            </label>
          )}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
          {photosList.map((photo, index) => (
            <div key={index} style={{ aspectRatio: '1', borderRadius: '8px', overflow: 'hidden', background: '#eee', position: 'relative' }}>
              <img src={getPhotoUrl(photo)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              {isOwnProfile && photosList.length > 1 && (
                <button 
                  onClick={() => handleRemovePhoto(index)}
                  style={{ position: 'absolute', top: '4px', right: '4px', background: 'rgba(0,0,0,0.6)', color: '#fff', border: 'none', borderRadius: '50%', width: '20px', height: '20px', fontSize: '10px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                  ✕
                </button>
              )}
            </div>
          ))}
          {isOwnProfile && photosList.length < 6 && (
            <label style={{ aspectRatio: '1', borderRadius: '8px', border: '2px dashed #cbd5e1', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', cursor: uploadingPhoto ? 'wait' : 'pointer', color: '#64748b', background: '#f8fafc' }}>
              <span style={{ fontSize: '1.2rem' }}>+</span>
              <span style={{ fontSize: '0.7rem' }}>Add</span>
              <input type="file" accept="image/*" onChange={handlePhotoUpload} disabled={uploadingPhoto} style={{ display: 'none' }} />
            </label>
          )}
        </div>
      </div>

      {/* BIO SECTION */}
      <div style={{ background: '#fff', padding: '1.2rem', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.04)', marginBottom: '1.5rem' }}>
        <h4 style={{ margin: '0 0 0.5rem', fontSize: '0.95rem', color: '#444' }}>About Me</h4>
        {isEditingBio ? (
          <>
            <textarea value={bioText} onChange={e => setBioText(e.target.value)} rows="3" style={{width:'100%',border:'1px solid #ddd',borderRadius:'8px',padding:'0.6rem', boxSizing: 'border-box'}} />
            <div style={{marginTop:'0.5rem',display:'flex',gap:'0.5rem'}}>
              <button onClick={handleSaveBio} style={{background:'#5b72f2',color:'#fff',border:'none',borderRadius:'6px',padding:'0.4rem 1rem',cursor:'pointer', fontWeight: 600}}>Save</button>
              <button onClick={() => setIsEditingBio(false)} style={{background:'#ccc',border:'none',borderRadius:'6px',padding:'0.4rem 1rem',cursor:'pointer', fontWeight: 600}}>Cancel</button>
            </div>
          </>
        ) : (
          <div>
            <p style={{margin:'0 0 0.5rem', lineHeight: '1.5', color: '#333'}}>{user.bio || 'No bio provided yet.'}</p>
            {isOwnProfile && <button onClick={() => setIsEditingBio(true)} style={{background:'none',border:'none',color:'#5b72f2',cursor:'pointer',padding:0, fontWeight: 600, fontSize:'0.9rem'}}>Edit Bio</button>}
          </div>
        )}
      </div>

      {/* POSTS GRID SECTION */}
      <h3 style={{ marginBottom: '1rem', fontSize: '1.2rem' }}>Posts</h3>
      {posts.length === 0 ? (
        <div style={{ textAlign: 'center', color: '#888', padding: '3rem', background: '#fff', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
          {isOwnProfile ? "You haven't posted anything yet." : "No public posts to show."}
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px', borderRadius: '12px', overflow: 'hidden' }}>
          {posts.map(post => {
            const hasText = post.text && post.text.trim().length > 0;
            const hasMedia = post.mediaUrl && post.mediaUrl !== 'null';
            const isVideo = hasMedia && (post.mediaType === 'video' || post.mediaUrl.includes('/video/upload'));

            return (
              <div key={post._id} style={{ aspectRatio: '1', overflow: 'hidden', background: '#f5f5f5', position: 'relative', borderRadius: '8px' }}>
                {hasText && !hasMedia && (
                  <div style={{ padding: '10px', fontSize: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', wordBreak: 'break-word', height: '100%', background: '#fff', color: '#333' }}>
                    {post.text.substring(0, 50)}{post.text.length > 50 ? '...' : ''}
                  </div>
                )}
                {hasMedia && (
                  isVideo ? (
                    <video src={post.mediaUrl} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <img src={post.mediaUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                      onError={(e) => { e.target.style.display = 'none'; }} 
                    />
                  )
                )}
                {isOwnProfile && (
                  <button onClick={() => handleDeletePost(post._id)} style={{ 
                    position: 'absolute', top: '6px', right: '6px', background: 'rgba(0,0,0,0.6)', color: '#fff', border: 'none', borderRadius: '50%', width: '24px', height: '24px', cursor: 'pointer', fontSize: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' 
                  }}>×</button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default ProfileScreen;
