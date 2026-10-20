import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import AgoraRTC, {
  AgoraRTCProvider,
  useJoin,
  useLocalCameraTrack,
  useLocalMicrophoneTrack,
  usePublish,
  useRemoteUsers,
  RemoteUser,
  LocalVideoTrack
} from 'agora-rtc-react';

const API_URL = process.env.REACT_APP_API_URL || 'https://pairhaven.onrender.com';
const AGORA_APP_ID = process.env.REACT_APP_AGORA_APP_ID || 'YOUR_AGORA_APP_ID';
const AGORA_TEMP_TOKEN = process.env.REACT_APP_AGORA_TEMP_TOKEN; 

const agoraClient = AgoraRTC.createClient({ mode: 'rtc', codec: 'vp8' });

function ChatScreen() {
  const [conversations, setConversations] = useState([]);
  const [selectedMatch, setSelectedMatch] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [activeCall, setActiveCall] = useState(null); // 'audio' | 'video' | null
  
  // ✅ Menu & Modal States
  const [showMenu, setShowMenu] = useState(false);
  const [showGiftModal, setShowGiftModal] = useState(false);
  
  const messagesEndRef = useRef(null);
  const navigate = useNavigate();
  const token = localStorage.getItem('token');
  
  const getMyId = () => {
    try {
      const raw = localStorage.getItem('user');
      if (!raw) return null;
      const user = JSON.parse(raw);
      return (user._id || user.id || user.userId)?.toString();
    } catch (e) { return null; }
  };
  
  const myId = getMyId();

  useEffect(() => {
    const fetchConversations = async () => {
      try {
        const res = await axios.get(`${API_URL}/api/messages/conversations`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setConversations(res.data || []);
      } catch (err) { console.error("Conv fetch failed", err); }
    };
    if (token) fetchConversations();
  }, [token]);

  useEffect(() => {
    if (!selectedMatch) return;
    setShowMenu(false);
    
    const fetchConversation = async () => {
      try {
        const res = await axios.get(`${API_URL}/api/messages/conversation/${selectedMatch._id}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        
        setMessages(res.data || []);
        setConversations(prev => prev.map(c => 
          c.user._id === selectedMatch._id ? { ...c, unreadCount: 0 } : c
        ));
      } catch (err) {
        console.error("Msg fetch failed", err);
        setMessages([]);
      }
    };
    
    fetchConversation();
  }, [selectedMatch, token, myId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!newMessage.trim() || !selectedMatch) return;
    try {
      const res = await axios.post(`${API_URL}/api/messages/send`, {
        receiverId: selectedMatch._id, content: newMessage
      }, { headers: { Authorization: `Bearer ${token}` } });
      
      setMessages(prev => [...prev, res.data]);
      setNewMessage('');
      setConversations(prev => prev.map(c => 
        c.user._id === selectedMatch._id ? { ...c, lastMessage: res.data, unreadCount: 0 } : c
      ).sort((a, b) => new Date(b.lastMessage?.createdAt) - new Date(a.lastMessage?.createdAt)));
    } catch (err) { alert(err.response?.data?.message || "Send failed"); }
  };

  // ✅ BLOCK USER HANDLER
  const handleBlockUser = async () => {
    if (!selectedMatch) return;
    if (!window.confirm(`Are you sure you want to block ${selectedMatch.name}? They will no longer be able to message or call you.`)) return;

    try {
      await axios.post(`${API_URL}/api/users/block/${selectedMatch._id}`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      alert("User blocked successfully.");
      setSelectedMatch(null);
      setShowMenu(false);
      // Refresh conversations list
      const res = await axios.get(`${API_URL}/api/messages/conversations`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setConversations(res.data || []);
    } catch (err) {
      alert(err.response?.data?.message || "Failed to block user");
    }
  };

  // ✅ SEND VIRTUAL GIFT HANDLER
  const handleSendGift = async (giftName) => {
    try {
      await axios.post(`${API_URL}/api/messages/send`, {
        receiverId: selectedMatch._id, content: `🎁 Sent a virtual gift: ${giftName}`
      }, { headers: { Authorization: `Bearer ${token}` } });

      setShowGiftModal(false);
      setShowMenu(true);
      // Refresh conversation
      const res = await axios.get(`${API_URL}/api/messages/conversation/${selectedMatch._id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setMessages(res.data || []);
    } catch (err) {
      alert("Failed to send gift");
    }
  };

  const getAvatarUrl = (photos) => {
    if (!photos) return 'https://via.placeholder.com/45';
    const p = photos[0];
    return typeof p === 'string' ? p : p?.url || 'https://via.placeholder.com/45';
  };

  const getTimeAgo = (d) => {
    if (!d) return '';
    const diff = Math.floor((Date.now() - new Date(d)) / 60000);
    if (diff < 1) return 'Now';
    if (diff < 60) return `${diff}m`;
    if (diff < 1440) return `${Math.floor(diff/60)}h`;
    return `${Math.floor(diff/1440)}d`;
  };

  const getChannelName = () => {
    if (!myId || !selectedMatch?._id) return 'call_channel';
    return [myId, selectedMatch._id].sort().join('_');
  };

  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 78px)', background: '#fff', position: 'relative' }}>
      
      {/* SIDEBAR CONVERSATIONS */}
      <div style={{ width: '320px', borderRight: '1px solid #eee', overflowY: 'auto', background: '#fff' }}>
        <div style={{ padding: '1.2rem', borderBottom: '1px solid #eee', fontWeight: 700 }}>Messages</div>
        {conversations.length === 0 ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: '#999' }}>No conversations</div>
        ) : conversations.map(conv => {
          const isActive = selectedMatch?._id === conv.user._id;
          const hasUnread = conv.unreadCount > 0;
          return (
            <div key={conv.user._id} onClick={() => setSelectedMatch(conv.user)} style={{ 
              padding: '1rem 1.2rem', cursor: 'pointer',
              background: isActive ? '#f0f7ff' : (hasUnread ? '#fafafa' : '#fff'),
              borderBottom: '1px solid #f5f5f5', display: 'flex', alignItems: 'center', gap: '12px',
              borderLeft: hasUnread ? '3px solid #5b72f2' : '3px solid transparent'
            }}>
              <div style={{ position: 'relative' }}>
                <img src={getAvatarUrl(conv.user.photos)} alt="" style={{ width: 50, height: 50, borderRadius: '50%', objectFit: 'cover' }} />
                {hasUnread && <span style={{ position: 'absolute', top: '-2px', right: '-2px', background: '#e53e3e', color: '#fff', fontSize: '0.65rem', borderRadius: '50%', width: '18px', height: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid #fff' }}>{conv.unreadCount > 9 ? '9+' : conv.unreadCount}</span>}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <div style={{ fontWeight: hasUnread ? 700 : 600 }}>{conv.user.name}</div>
                  <div style={{ fontSize: '0.7rem', color: hasUnread ? '#5b72f2' : '#999' }}>{getTimeAgo(conv.lastMessage?.createdAt)}</div>
                </div>
                <div style={{ fontSize: '0.85rem', color: hasUnread ? '#333' : '#888', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{conv.lastMessage?.content || 'Start chatting'}</div>
              </div>
            </div>
          );
        })}
      </div>

      {/* CHAT AREA */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#fff', position: 'relative' }}>
        {selectedMatch ? (
          <>
            {/* CHAT HEADER */}
            <div style={{ padding: '1rem 1.5rem', borderBottom: '1px solid #eee', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <img src={getAvatarUrl(selectedMatch.photos)} alt="" onClick={() => window.location.hash = `/profile/${selectedMatch._id}`} style={{ width: 42, height: 42, borderRadius: '50%', objectFit: 'cover', cursor: 'pointer', border: '2px solid #f0f0f0' }} />
                <div>
                  <div style={{ fontWeight: 700 }}>{selectedMatch.name}</div>
                  <div style={{ fontSize: '0.75rem', color: '#888' }}>{selectedMatch.age ? `${selectedMatch.age} yrs` : 'Online'}</div>
                </div>
              </div>

              {/* HEADER ACTIONS & 3-DOT MENU */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', position: 'relative' }}>
                <button onClick={() => setActiveCall('audio')} title="Voice Call" style={callButtonStyle}>📞</button>
                <button onClick={() => setActiveCall('video')} title="Video Call" style={callButtonStyle}>📹</button>
                
                {/* 3 DOT MENU BUTTON */}
                <button 
                  onClick={() => setShowMenu(!showMenu)} 
                  title="More Options" 
                  style={{ ...callButtonStyle, background: showMenu ? '#eef2ff' : '#fff', fontWeight: 900 }}
                >
                  ⋮
                </button>

                {/* 3 DOT DROPDOWN */}
                {showMenu && (
                  <div style={{ position: 'absolute', top: '45px', right: 0, background: '#fff', boxShadow: '0 4px 16px rgba(0,0,0,0.15)', borderRadius: '12px', width: '180px', zIndex: 100, overflow: 'hidden', border: '1px solid #eee' }}>
                    <button onClick={() => { setShowMenu(false); setActiveCall('audio'); }} style={menuItemStyle}>📞 Voice Call coming soon</button>
                    <button onClick={() => { setShowMenu(false); setActiveCall('video'); }} style={menuItemStyle}>📹 Video Call coming soon</button>
                    <button onClick={() => { setShowMenu(false); setShowGiftModal(true); }} style={menuItemStyle}>🎁 Send Gift comming soon</button>
                    <div style={{ height: '1px', background: '#eee', margin: '4px 0' }} />
                    <button onClick={handleBlockUser} style={{ ...menuItemStyle, color: '#e53e3e', fontWeight: 600 }}>🚫 Block User</button>
                  </div>
                )}
              </div>
            </div>
            
            {/* MESSAGES BODY */}
            <div style={{ flex: 1, padding: '1.5rem', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              {messages.length === 0 ? (
                <div style={{ textAlign: 'center', color: '#999', marginTop: '4rem' }}>Say hello to {selectedMatch.name}!</div>
              ) : messages.map(msg => {
                const s = msg.sender;
                const senderId = (typeof s === 'object' && s !== null) ? s._id?.toString() : s?.toString();
                const isMe = myId && senderId && myId === senderId;

                return (
                  <div key={msg._id} style={{ display: 'flex', justifyContent: isMe ? 'flex-end' : 'flex-start', marginBottom: '4px' }}>
                    <div style={{ 
                      background: isMe ? '#5b72f2' : '#f0f0f0', color: isMe ? '#fff' : '#000',
                      padding: '10px 14px', borderRadius: isMe ? '20px 20px 4px 20px' : '20px 20px 20px 4px',
                      maxWidth: '75%', fontSize: '0.95rem', lineHeight: '1.4', wordBreak: 'break-word'
                    }}>
                      {msg.content}
                      <div style={{ fontSize: '0.65rem', opacity: isMe ? 0.8 : 0.6, marginTop: '4px', textAlign: 'right' }}>
                        {new Date(msg.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                      </div>
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>

            {/* MESSAGE INPUT */}
            <div style={{ padding: '1rem 1.5rem', borderTop: '1px solid #eee', display: 'flex', gap: '10px' }}>
              <input type="text" value={newMessage} onChange={e => setNewMessage(e.target.value)} onKeyPress={e => e.key === 'Enter' && handleSend()} placeholder="Type a message..." style={{ flex: 1, padding: '0.8rem 1.2rem', borderRadius: '24px', border: '1px solid #e2e8f0', outline: 'none', background: '#f8f9fa' }} />
              <button onClick={handleSend} disabled={!newMessage.trim()} style={{ background: newMessage.trim() ? '#5b72f2' : '#cbd5e1', color: '#fff', border: 'none', borderRadius: '24px', padding: '0.8rem 1.5rem', fontWeight: 600, cursor: newMessage.trim() ? 'pointer' : 'default' }}>Send</button>
            </div>
          </>
        ) : (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#999' }}>
            <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>💬</div>
            <p>Select a conversation</p>
          </div>
        )}
      </div>

      {/* GIFT MODAL */}
      {showGiftModal && (
        <div style={modalOverlayStyle}>
          <div style={modalContentStyle}>
            <h3>Send a Gift to {selectedMatch?.name} 🎁</h3>
            <p style={{ fontSize: '0.85rem', color: '#666', marginBottom: '1rem' }}>Choose a virtual gift to brighten their day!</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', marginBottom: '1.5rem' }}>
              {['🌹 Rose', '☕ Coffee', '🍫 Chocolate', '🧸 Teddy Bear', '💍 Ring', '💎 Diamond'].map(gift => (
                <button key={gift} onClick={() => handleSendGift(gift)} style={{ padding: '0.8rem', background: '#f8f9fa', border: '1px solid #e2e8f0', borderRadius: '10px', cursor: 'pointer', fontWeight: 600 }}>
                  {gift}
                </button>
              ))}
            </div>
            <button onClick={() => setShowGiftModal(false)} style={{ background: '#cbd5e1', color: '#333', border: 'none', padding: '0.6rem 1.5rem', borderRadius: '20px', cursor: 'pointer', fontWeight: 600 }}>Cancel</button>
          </div>
        </div>
      )}

      {/* CALL MODAL OVERLAY */}
      {activeCall && (
        <CallModal 
          appId={AGORA_APP_ID}
          channelName={getChannelName()}
          callType={activeCall}
          onClose={() => setActiveCall(null)}
        />
      )}
    </div>
  );
}

function CallModal({ appId, channelName, callType, onClose }) {
  return (
    <AgoraRTCProvider client={agoraClient}>
      <div style={modalOverlayStyle}>
        <div style={modalContentStyle}>
          <h3>{callType === 'video' ? '📹 Video Call' : '📞 Voice Call'}</h3>
          <CallRoom appId={appId} channelName={channelName} callType={callType} onClose={onClose} />
        </div>
      </div>
    </AgoraRTCProvider>
  );
}

function CallRoom({ appId, channelName, callType, onClose }) {
  const isVideo = callType === 'video';
  
  // ✅ REPLACE THIS LINE
  // useJoin({ appid: appId, channel: channelName, token: null });
  
  // ✅ WITH THIS (Uses the env variable defined at top of file)
  useJoin({ 
    appid: appId, 
    channel: channelName, 
    token: AGORA_TEMP_TOKEN 
  });

  const { localMicrophoneTrack } = useLocalMicrophoneTrack(true);
  const { localCameraTrack } = useLocalCameraTrack(isVideo);

  usePublish([localMicrophoneTrack, localCameraTrack].filter(Boolean));
  const remoteUsers = useRemoteUsers();

  return (
    <div style={{ textAlign: 'center' }}>
      {isVideo ? (
        <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', marginBottom: '1rem', flexWrap: 'wrap' }}>
          <div style={videoBoxStyle}>
            <p style={labelStyle}>You</p>
            {localCameraTrack && <LocalVideoTrack track={localCameraTrack} play style={{ width: '100%', height: '100%', borderRadius: '10px' }} />}
          </div>
          {remoteUsers.map(user => (
            <div key={user.uid} style={videoBoxStyle}>
              <p style={labelStyle}>Connected User</p>
              <RemoteUser user={user} style={{ width: '100%', height: '100%', borderRadius: '10px' }} />
            </div>
          ))}
        </div>
      ) : (
        <div style={{ padding: '2rem 0', fontSize: '1.2rem', color: '#5b72f2' }}>
          ️ Voice Call Active...
        </div>
      )}
      <button onClick={onClose} style={endCallButtonStyle}>🛑 End Call</button>
    </div>
  );
}

// Styling Constants
const callButtonStyle = {
  background: '#eef2ff',
  border: '1px solid #5b72f2',
  borderRadius: '50%',
  width: '38px',
  height: '38px',
  fontSize: '1.1rem',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center'
};

const menuItemStyle = {
  width: '100%', padding: '0.75rem 1rem', background: 'none', border: 'none', textAlign: 'left', cursor: 'pointer', fontSize: '0.9rem', color: '#333'
};

const modalOverlayStyle = {
  position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 9999,
  display: 'flex', alignItems: 'center', justifyContent: 'center'
};

const modalContentStyle = {
  background: '#fff', padding: '1.5rem', borderRadius: '16px', width: '90%', maxWidth: '400px', textAlign: 'center'
};

const videoBoxStyle = {
  width: '180px', height: '240px', background: '#222', borderRadius: '10px', position: 'relative', overflow: 'hidden'
};

const labelStyle = {
  position: 'absolute', bottom: '5px', left: '8px', color: '#fff', margin: 0, fontSize: '0.75rem', zIndex: 10, background: 'rgba(0,0,0,0.5)', padding: '2px 6px', borderRadius: '4px'
};

const endCallButtonStyle = {
  background: '#e53e3e', color: '#fff', border: 'none', padding: '0.8rem 1.8rem', borderRadius: '30px', fontWeight: 'bold', fontSize: '1rem', cursor: 'pointer', marginTop: '1rem'
};

export default ChatScreen;
