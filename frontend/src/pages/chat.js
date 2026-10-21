import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import io from 'socket.io-client';
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
import VerifiedBadge from '../components/VerifiedBadge';

const API_URL = process.env.REACT_APP_API_URL || 'https://pairhaven.onrender.com';
const AGORA_APP_ID = process.env.REACT_APP_AGORA_APP_ID || 'YOUR_AGORA_APP_ID';
const AGORA_TEMP_TOKEN = process.env.REACT_APP_AGORA_TEMP_TOKEN || null; 

const agoraClient = AgoraRTC.createClient({ mode: 'rtc', codec: 'vp8' });

function ChatScreen() {
  const [conversations, setConversations] = useState([]);
  const [selectedMatch, setSelectedMatch] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [activeCall, setActiveCall] = useState(null);
  const [incomingCall, setIncomingCall] = useState(null);
  
  const [showMenu, setShowMenu] = useState(false);
  const [showGiftModal, setShowGiftModal] = useState(false);
  
  const messagesEndRef = useRef(null);
  const navigate = useNavigate();
  const token = localStorage.getItem('token');
  const socketRef = useRef(null);
  
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
    if (!myId) return;

    socketRef.current = io(API_URL);
    socketRef.current.emit('join', myId);

    socketRef.current.on('receive-message', (data) => {
      if (selectedMatch && (data.sender?._id === selectedMatch._id || data.sender === selectedMatch._id)) {
        setMessages(prev => [...prev, data]);
      }
      fetchConversations();
    });

    socketRef.current.on('incoming-call', (data) => {
      setIncomingCall(data);
    });

    socketRef.current.on('call-ended', () => {
      setIncomingCall(null);
      setActiveCall(null);
    });

    return () => {
      if (socketRef.current) socketRef.current.disconnect();
    };
  }, [myId, selectedMatch]);

  const fetchConversations = async () => {
    try {
      const res = await axios.get(`${API_URL}/api/messages/conversations`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const convs = res.data || [];
      setConversations(convs);

      // 🚀 Auto-select first conversation (Support or recent match) on load
      if (convs.length > 0 && !selectedMatch) {
        setSelectedMatch(convs[0].user);
      }
    } catch (err) { console.error("Conv fetch failed", err); }
  };

  useEffect(() => {
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
      fetchConversations();
    } catch (err) { alert(err.response?.data?.message || "Send failed"); }
  };

  const handleBlockUser = async () => {
    if (!selectedMatch) return;
    if (!window.confirm(`Are you sure you want to block ${selectedMatch.name}?`)) return;

    try {
      await axios.post(`${API_URL}/api/users/block/${selectedMatch._id}`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      alert("User blocked successfully.");
      setSelectedMatch(null);
      setShowMenu(false);
      fetchConversations();
    } catch (err) {
      alert("Failed to block user");
    }
  };

  const handleSendGift = async (giftName) => {
    try {
      await axios.post(`${API_URL}/api/messages/send`, {
        receiverId: selectedMatch._id, content: `🎁 Sent a virtual gift: ${giftName}`
      }, { headers: { Authorization: `Bearer ${token}` } });

      setShowGiftModal(false);
      setShowMenu(true);
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

  const getChannelName = () => {
    if (!myId || !selectedMatch?._id) return 'call_channel';
    const id1 = myId.toString().toLowerCase();
    const id2 = selectedMatch._id.toString().toLowerCase();
    return [id1, id2].sort().join('_');
  };

  const startCall = (type) => {
    if (!selectedMatch) return;
    const channelName = getChannelName();
    
    if (socketRef.current) {
      socketRef.current.emit('start-call', {
        recipientId: selectedMatch._id,
        callerId: myId,
        callerName: JSON.parse(localStorage.getItem('user'))?.name || 'User',
        callType: type,
        channelName
      });
    }
    setActiveCall(type);
  };

  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 78px)', background: '#fff', position: 'relative' }}>
      {/* Conversations Sidebar */}
      <div style={{ width: '320px', borderRight: '1px solid #eee', overflowY: 'auto', background: '#fff' }}>
        <div style={{ padding: '1.2rem', borderBottom: '1px solid #eee', fontWeight: 700, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>Messages</span>
          <span style={{ fontSize: '0.75rem', background: '#eef2ff', color: '#5b72f2', padding: '2px 8px', borderRadius: '10px' }}>24/7 Support</span>
        </div>

        {conversations.length === 0 ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: '#999' }}>No conversations</div>
        ) : conversations.map(conv => {
          const isActive = selectedMatch?._id === conv.user._id;
          const unreadCount = conv.unreadCount || 0;
          const isAdmin = conv.user.role === 'admin' || conv.user.email === 'admin@pairhaven.com';

          return (
            <div key={conv.user._id} onClick={() => setSelectedMatch(conv.user)} style={{ 
              padding: '1rem 1.2rem', cursor: 'pointer',
              background: isActive ? '#f0f7ff' : (isAdmin ? '#fffdf5' : '#fff'),
              borderBottom: '1px solid #f5f5f5', display: 'flex', alignItems: 'center', gap: '12px',
              position: 'relative'
            }}>
              <div style={{ position: 'relative' }}>
                <img src={getAvatarUrl(conv.user.photos)} alt="" style={{ width: 50, height: 50, borderRadius: '50%', objectFit: 'cover', border: isAdmin ? '2px solid #f59e0b' : 'none' }} />
                {unreadCount > 0 && (
                  <span style={{ 
                    position: 'absolute', top: -2, right: -2, background: '#ff4b4b', color: '#fff', 
                    fontSize: '0.7rem', fontWeight: 800, padding: '2px 6px', borderRadius: '10px',
                    border: '2px solid #fff'
                  }}>
                    {unreadCount}
                  </span>
                )}
              </div>

              <div style={{ flex: 1, minWidth: '0' }}>
                <div style={{ fontWeight: unreadCount > 0 ? 800 : 600, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexWrap: 'wrap' }}>
                    {conv.user.name} 
                    {isAdmin && <span style={{ fontSize: '0.7rem', background: '#fef3c7', color: '#b45309', padding: '1px 6px', borderRadius: '6px', fontWeight: 700 }}>🛡️ Support</span>}
                    <VerifiedBadge status={conv.user.verificationStatus} size="0.85rem" />
                  </div>
                  {unreadCount > 0 && (
                    <span style={{ width: '8px', height: '8px', background: '#5b72f2', borderRadius: '50%' }}></span>
                  )}
                </div>
                <div style={{ fontSize: '0.85rem', color: unreadCount > 0 ? '#1e293b' : '#888', fontWeight: unreadCount > 0 ? 700 : 400, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {conv.lastMessage?.content || 'Start chatting'}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Active Chat Area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#fff', position: 'relative' }}>
        {selectedMatch ? (
          <>
            <div style={{ padding: '1rem 1.5rem', borderBottom: '1px solid #eee', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <img src={getAvatarUrl(selectedMatch.photos)} alt="" onClick={() => window.location.hash = `/profile/${selectedMatch._id}`} style={{ width: 42, height: 42, borderRadius: '50%', objectFit: 'cover', cursor: 'pointer', border: '2px solid #f0f0f0' }} />
                <div>
                  <div style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                    {selectedMatch.name}
                    {(selectedMatch.role === 'admin' || selectedMatch.email === 'admin@pairhaven.com') && (
                      <span style={{ fontSize: '0.75rem', background: '#fef3c7', color: '#b45309', padding: '2px 8px', borderRadius: '8px', fontWeight: 700 }}>
                        🛡️ Official Support
                      </span>
                    )}
                    <VerifiedBadge status={selectedMatch.verificationStatus} size="0.95rem" />
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#888' }}>
                    {selectedMatch.role === 'admin' ? 'Always Online' : (selectedMatch.age ? `${selectedMatch.age} yrs` : 'Online')}
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', position: 'relative' }}>
                <button onClick={() => startCall('audio')} title="Voice Call" style={callButtonStyle}>📞</button>
                <button onClick={() => startCall('video')} title="Video Call" style={callButtonStyle}>📹</button>
                <button onClick={() => setShowMenu(!showMenu)} title="More Options" style={{ ...callButtonStyle, background: showMenu ? '#eef2ff' : '#fff', fontWeight: 900 }}>⋮</button>

                {showMenu && (
                  <div style={{ position: 'absolute', top: '45px', right: 0, background: '#fff', boxShadow: '0 4px 16px rgba(0,0,0,0.15)', borderRadius: '12px', width: '160px', zIndex: 100, overflow: 'hidden', border: '1px solid #eee' }}>
                    <button onClick={() => { setShowMenu(false); setShowGiftModal(true); }} style={menuItemStyle}>🎁 Send Gift</button>
                    <div style={{ height: '1px', background: '#eee', margin: '4px 0' }} />
                    <button onClick={handleBlockUser} style={{ ...menuItemStyle, color: '#e53e3e', fontWeight: 600 }}>🚫 Block User</button>
                  </div>
                )}
              </div>
            </div>
            
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
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>

            <div style={{ padding: '1rem 1.5rem', borderTop: '1px solid #eee', display: 'flex', gap: '10px' }}>
              <input type="text" value={newMessage} onChange={e => setNewMessage(e.target.value)} onKeyPress={e => e.key === 'Enter' && handleSend()} placeholder={`Type a message to ${selectedMatch.name}...`} style={{ flex: 1, padding: '0.8rem 1.2rem', borderRadius: '24px', border: '1px solid #e2e8f0', outline: 'none', background: '#f8f9fa' }} />
              <button onClick={handleSend} disabled={!newMessage.trim()} style={{ background: newMessage.trim() ? '#5b72f2' : '#cbd5e1', color: '#fff', border: 'none', borderRadius: '24px', padding: '0.8rem 1.5rem', fontWeight: 600, cursor: newMessage.trim() ? 'pointer' : 'default' }}>Send</button>
            </div>
          </>
        ) : (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#999' }}>
            <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>💬</div>
            <p>Loading conversation...</p>
          </div>
        )}
      </div>

      {incomingCall && !activeCall && (
        <div style={modalOverlayStyle}>
          <div style={modalContentStyle}>
            <h3>Incoming {incomingCall.callType === 'video' ? 'Video' : 'Voice'} Call 📞</h3>
            <p style={{ margin: '1rem 0', color: '#555' }}><b>{incomingCall.callerName}</b> is calling you...</p>
            <div style={{ display: 'flex', gap: '15px', justifyContent: 'center' }}>
              <button onClick={() => { socketRef.current?.emit('end-call', { recipientId: incomingCall.callerId }); setIncomingCall(null); }} style={{ background: '#e53e3e', color: '#fff', border: 'none', padding: '0.7rem 1.5rem', borderRadius: '20px', cursor: 'pointer', fontWeight: 600 }}>Decline</button>
              <button onClick={() => { setActiveCall(incomingCall.callType); setIncomingCall(null); }} style={{ background: '#38a169', color: '#fff', border: 'none', padding: '0.7rem 1.5rem', borderRadius: '20px', cursor: 'pointer', fontWeight: 600 }}>Accept</button>
            </div>
          </div>
        </div>
      )}

      {showGiftModal && (
        <div style={modalOverlayStyle}>
          <div style={modalContentStyle}>
            <h3>Send a Gift to {selectedMatch?.name} 🎁</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', margin: '1rem 0' }}>
              {['🌹 Rose', '☕ Coffee', '🍫 Chocolate', '🧸 Teddy', '💍 Ring', '💎 Diamond'].map(gift => (
                <button key={gift} onClick={() => handleSendGift(gift)} style={{ padding: '0.8rem', background: '#f8f9fa', border: '1px solid #e2e8f0', borderRadius: '10px', cursor: 'pointer', fontWeight: 600 }}>{gift}</button>
              ))}
            </div>
            <button onClick={() => setShowGiftModal(false)} style={{ background: '#cbd5e1', color: '#333', border: 'none', padding: '0.6rem 1.5rem', borderRadius: '20px', cursor: 'pointer', fontWeight: 600 }}>Cancel</button>
          </div>
        </div>
      )}

      {activeCall && (
        <CallModal 
          appId={AGORA_APP_ID}
          channelName={incomingCall ? incomingCall.channelName : getChannelName()}
          callType={activeCall}
          onClose={() => {
            if (incomingCall && socketRef.current) socketRef.current.emit('end-call', { recipientId: incomingCall.callerId });
            setActiveCall(null);
            setIncomingCall(null);
          }}
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
  useJoin({ appid: appId, channel: channelName, token: AGORA_TEMP_TOKEN || null });
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
          {remoteUsers.length === 0 ? (
            <div style={{ ...videoBoxStyle, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#aaa', fontSize: '0.85rem' }}>Waiting...</div>
          ) : (
            remoteUsers.map(user => (
              <div key={user.uid} style={videoBoxStyle}>
                <p style={labelStyle}>Matched User</p>
                <RemoteUser user={user} playVideo={isVideo} playAudio={true} style={{ width: '100%', height: '100%', borderRadius: '10px' }} />
              </div>
            ))
          )}
        </div>
      ) : (
        <div style={{ padding: '2rem 0', fontSize: '1.2rem', color: '#5b72f2' }}>🎙️ Voice Call Active</div>
      )}
      <button onClick={onClose} style={endCallButtonStyle}>🛑 End Call</button>
    </div>
  );
}

const callButtonStyle = { background: '#eef2ff', border: '1px solid #5b72f2', borderRadius: '50%', width: '38px', height: '38px', fontSize: '1.1rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' };
const menuItemStyle = { width: '100%', padding: '0.75rem 1rem', background: 'none', border: 'none', textAlign: 'left', cursor: 'pointer', fontSize: '0.9rem', color: '#333' };
const modalOverlayStyle = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' };
const modalContentStyle = { background: '#fff', padding: '1.5rem', borderRadius: '16px', width: '90%', maxWidth: '400px', textAlign: 'center' };
const videoBoxStyle = { width: '180px', height: '240px', background: '#222', borderRadius: '10px', position: 'relative', overflow: 'hidden' };
const labelStyle = { position: 'absolute', bottom: '5px', left: '8px', color: '#fff', margin: 0, fontSize: '0.75rem', zIndex: 10, background: 'rgba(0,0,0,0.5)', padding: '2px 6px', borderRadius: '4px' };
const endCallButtonStyle = { background: '#e53e3e', color: '#fff', border: 'none', padding: '0.8rem 1.8rem', borderRadius: '30px', fontWeight: 'bold', fontSize: '1rem', cursor: 'pointer', marginTop: '1rem' };

export default ChatScreen;
