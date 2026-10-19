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
  
  // Safe user parsing
  const currentUser = JSON.parse(localStorage.getItem('user') || '{}');

  // Fetch conversations WITH unread counts
  useEffect(() => {
    const fetchConversations = async () => {
      try {
        const res = await axios.get(`${API_URL}/api/messages/conversations`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setConversations(res.data || []);
      } catch (err) {
        console.error("Failed to load conversations", err);
      }
    };
    if (token) fetchConversations();
  }, [token]);

  // Fetch conversation when match is selected
  useEffect(() => {
    if (!selectedMatch) return;
    
    const fetchConversation = async () => {
      try {
        const res = await axios.get(`${API_URL}/api/messages/conversation/${selectedMatch._id}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setMessages(res.data || []);
        
        // Auto-mark as read locally & refresh list
        setConversations(prev => prev.map(c => 
          c.user._id === selectedMatch._id ? { ...c, unreadCount: 0 } : c
        ));
      } catch (err) {
        console.error("Failed to load conversation", err);
        setMessages([]);
      }
    };
    
    fetchConversation();
  }, [selectedMatch, token]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Send message handler
  const handleSend = async () => {
    if (!newMessage.trim() || !selectedMatch) return;
    
    try {
      const res = await axios.post(`${API_URL}/api/messages/send`, {
        receiverId: selectedMatch._id,
        content: newMessage
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      setMessages(prev => [...prev, res.data]);
      setNewMessage('');
      
      // Update conversation list with new last message
      setConversations(prev => prev.map(c => 
        c.user._id === selectedMatch._id 
          ? { ...c, lastMessage: res.data, unreadCount: 0 } 
          : c
      ).sort((a, b) => new Date(b.lastMessage?.createdAt) - new Date(a.lastMessage?.createdAt)));
      
    } catch (err) {
      console.error("Send failed", err);
      alert(err.response?.data?.message || "Failed to send message");
    }
  };

  // Helper to get safe avatar URL
  const getAvatarUrl = (photos) => {
    if (!photos) return 'https://via.placeholder.com/45';
    if (Array.isArray(photos) && photos[0]) {
      return typeof photos[0] === 'string' ? photos[0] : photos[0].url;
    }
    return 'https://via.placeholder.com/45';
  };

  // Format time ago for sidebar
  const getTimeAgo = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Now';
    if (diffMins < 60) return `${diffMins}m`;
    if (diffHours < 24) return `${diffHours}h`;
    if (diffDays < 7) return `${diffDays}d`;
    return date.toLocaleDateString();
  };

  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 78px)', background: '#fff' }}>
      
      {/* PROFESSIONAL SIDEBAR WITH COUNTS */}
      <div style={{ width: '320px', borderRight: '1px solid #eee', overflowY: 'auto', background: '#fff', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '1.2rem', borderBottom: '1px solid #eee', fontWeight: 700, fontSize: '1.1rem' }}>Messages</div>
        
        {conversations.length === 0 ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: '#999' }}>No conversations yet</div>
        ) : (
          conversations.map(conv => {
            const isActive = selectedMatch?._id === conv.user._id;
            const hasUnread = conv.unreadCount > 0;
            
            return (
              <div 
                key={conv.user._id} 
                onClick={() => setSelectedMatch(conv.user)}
                style={{ 
                  padding: '1rem 1.2rem', 
                  cursor: 'pointer',
                  background: isActive ? '#f0f7ff' : (hasUnread ? '#fafafa' : '#fff'),
                  borderBottom: '1px solid #f5f5f5',
                  display: 'flex', alignItems: 'center', gap: '12px',
                  transition: 'background 0.2s',
                  borderLeft: hasUnread ? '3px solid #5b72f2' : '3px solid transparent'
                }}
              >
                <div style={{ position: 'relative' }}>
                  <img 
                    src={getAvatarUrl(conv.user.photos)} 
                    alt={conv.user.name}
                    style={{ width: 50, height: 50, borderRadius: '50%', objectFit: 'cover', border: '1px solid #eee' }}
                  />
                  {hasUnread && (
                    <span style={{
                      position: 'absolute', top: '-2px', right: '-2px',
                      background: '#e53e3e', color: '#fff', fontSize: '0.65rem',
                      borderRadius: '50%', width: '18px', height: '18px',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontWeight: 700, border: '2px solid #fff'
                    }}>
                      {conv.unreadCount > 9 ? '9+' : conv.unreadCount}
                    </span>
                  )}
                </div>
                
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                    <div style={{ fontWeight: hasUnread ? 700 : 600, fontSize: '0.95rem', color: hasUnread ? '#111' : '#333' }}>
                      {conv.user.name}
                    </div>
                    <div style={{ fontSize: '0.7rem', color: hasUnread ? '#5b72f2' : '#999', fontWeight: hasUnread ? 600 : 400 }}>
                      {getTimeAgo(conv.lastMessage?.createdAt)}
                    </div>
                  </div>
                  <div style={{ 
                    fontSize: '0.85rem', 
                    color: hasUnread ? '#333' : '#888', 
                    fontWeight: hasUnread ? 600 : 400,
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'
                  }}>
                    {conv.lastMessage?.content || 'Start a conversation'}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* CHAT AREA */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#fff' }}>
        {selectedMatch ? (
          <>
            {/* HEADER WITH CLICKABLE PROFILE PICTURE */}
            <div style={{ 
              padding: '1rem 1.5rem', borderBottom: '1px solid #eee', 
              background: '#fff', display: 'flex', alignItems: 'center', gap: '12px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.03)'
            }}>
               <img 
                  src={getAvatarUrl(selectedMatch.photos)} 
                  alt={selectedMatch.name}
                  onClick={() => window.location.hash = `/profile/${selectedMatch._id}`}
                  style={{ 
                    width: 42, height: 42, borderRadius: '50%', objectFit: 'cover', 
                    cursor: 'pointer', border: '2px solid #f0f0f0', transition: 'border-color 0.2s' 
                  }}
                  onMouseOver={e => e.target.style.borderColor = '#5b72f2'}
                  onMouseOut={e => e.target.style.borderColor = '#f0f0f0'}
                />
              <div>
                <div style={{ fontWeight: 700, fontSize: '1rem' }}>{selectedMatch.name}</div>
                <div style={{ fontSize: '0.75rem', color: '#888' }}>
                  {selectedMatch.age ? `${selectedMatch.age} years old` : 'Online'}
                </div>
              </div>
            </div>
            
            {/* MESSAGES SCROLL AREA - INSTAGRAM STYLE */}
            <div style={{ 
              flex: 1, padding: '1.5rem', overflowY: 'auto', 
              background: '#ffffff', display: 'flex', flexDirection: 'column', gap: '0.4rem' 
            }}>
              {messages.length === 0 ? (
                <div style={{ textAlign: 'center', color: '#999', marginTop: '4rem' }}>
                  <div style={{ fontSize: '3rem', marginBottom: '1rem' }}></div>
                  <p style={{ fontWeight: 600 }}>Say hello to {selectedMatch.name}!</p>
                  <p style={{ fontSize: '0.85rem', marginTop: '0.5rem' }}>This is the beginning of your conversation.</p>
                </div>
              ) : (
                messages.map(msg => {
                  const isMe = msg.sender?._id === currentUser._id;
                  return (
                    <div key={msg._id} style={{ display: 'flex', justifyContent: isMe ? 'flex-end' : 'flex-start', marginBottom: '2px' }}>
                      <div style={{ 
                        background: isMe ? '#5b72f2' : '#f0f0f0',
                        color: isMe ? '#fff' : '#000',
                        padding: '10px 14px',
                        borderRadius: isMe ? '20px 20px 4px 20px' : '20px 20px 20px 4px',
                        maxWidth: '75%',
                        fontSize: '0.95rem',
                        lineHeight: '1.4',
                        wordBreak: 'break-word',
                        boxShadow: 'none'
                      }}>
                        {msg.content}
                        <div style={{ 
                          fontSize: '0.65rem', opacity: 0.7, marginTop: '4px', 
                          textAlign: 'right', fontWeight: 500 
                        }}>
                          {new Date(msg.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* INPUT BAR */}
            <div style={{ 
              padding: '1rem 1.5rem', borderTop: '1px solid #eee', 
              display: 'flex', gap: '10px', background: '#fff', alignItems: 'center' 
            }}>
              <input 
                type="text" 
                value={newMessage}
                onChange={e => setNewMessage(e.target.value)}
                onKeyPress={e => e.key === 'Enter' && handleSend()}
                placeholder="Type a message..."
                style={{ 
                  flex: 1, padding: '0.8rem 1.2rem', borderRadius: '24px', 
                  border: '1px solid #e2e8f0', outline: 'none', fontSize: '0.95rem', 
                  background: '#f8f9fa', transition: 'border-color 0.2s' 
                }}
                onFocus={e => e.target.style.borderColor = '#5b72f2'}
                onBlur={e => e.target.style.borderColor = '#e2e8f0'}
              />
              <button 
                onClick={handleSend}
                disabled={!newMessage.trim()}
                style={{ 
                  background: newMessage.trim() ? '#5b72f2' : '#cbd5e1', 
                  color: '#fff', border: 'none', borderRadius: '24px', 
                  padding: '0.8rem 1.5rem', fontWeight: 600, 
                  cursor: newMessage.trim() ? 'pointer' : 'default',
                  transition: 'all 0.2s', fontSize: '0.95rem'
                }}
              >
                Send
              </button>
            </div>
          </>
        ) : (
          <div style={{ 
            flex: 1, display: 'flex', flexDirection: 'column', 
            alignItems: 'center', justifyContent: 'center', color: '#999', 
            background: '#f8f9fa' 
          }}>
            <div style={{ fontSize: '4rem', marginBottom: '1rem', opacity: 0.5 }}>💬</div>
            <p style={{ fontWeight: 600, fontSize: '1.1rem', color: '#666' }}>Select a conversation</p>
            <p style={{ fontSize: '0.85rem', marginTop: '0.5rem' }}>Choose a match from the sidebar to start chatting</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default ChatScreen;
