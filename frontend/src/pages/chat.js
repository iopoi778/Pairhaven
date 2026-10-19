import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

const API_URL = process.env.REACT_APP_API_URL || 'https://pairhaven.onrender.com';

function ChatScreen() {
  const [conversations, setConversations] = useState([]);
  const [selectedMatch, setSelectedMatch] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const messagesEndRef = useRef(null);
  const navigate = useNavigate();
  const token = localStorage.getItem('token');
  
  // ✅ AGGRESSIVE ID PARSING
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
    
    const fetchConversation = async () => {
      try {
        const res = await axios.get(`${API_URL}/api/messages/conversation/${selectedMatch._id}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        
        // DEBUG LOGS
        console.log(" MY ID:", myId);
        if (res.data?.length > 0) {
          const s = res.data[0].sender;
          console.log("📨 SENDER:", s);
          console.log("✅ IS ME?", myId === (s?._id || s)?.toString());
        }
        
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
    } catch (err) { alert("Send failed"); }
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

  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 78px)', background: '#fff' }}>
      {/* SIDEBAR */}
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
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#fff' }}>
        {selectedMatch ? (
          <>
            <div style={{ padding: '1rem 1.5rem', borderBottom: '1px solid #eee', display: 'flex', alignItems: 'center', gap: '12px' }}>
              <img src={getAvatarUrl(selectedMatch.photos)} alt="" onClick={() => window.location.hash = `/profile/${selectedMatch._id}`} style={{ width: 42, height: 42, borderRadius: '50%', objectFit: 'cover', cursor: 'pointer', border: '2px solid #f0f0f0' }} />
              <div>
                <div style={{ fontWeight: 700 }}>{selectedMatch.name}</div>
                <div style={{ fontSize: '0.75rem', color: '#888' }}>{selectedMatch.age ? `${selectedMatch.age} yrs` : 'Online'}</div>
              </div>
            </div>
            
            <div style={{ flex: 1, padding: '1.5rem', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              {messages.length === 0 ? (
                <div style={{ textAlign: 'center', color: '#999', marginTop: '4rem' }}>Say hello to {selectedMatch.name}!</div>
              ) : messages.map(msg => {
                // ✅ ROBUST COMPARISON
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
    </div>
  );
}

export default ChatScreen;
