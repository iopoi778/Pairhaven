import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'https://pairhaven.onrender.com';

function ChatScreen() {
  const [matches, setMatches] = useState([]);
  const [selectedMatch, setSelectedMatch] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const messagesEndRef = useRef(null);
  const token = localStorage.getItem('token');
  
  // Safe user parsing
  const currentUser = JSON.parse(localStorage.getItem('user') || '{}');

  // Fetch matches list
  useEffect(() => {
    const fetchMatches = async () => {
      try {
        const res = await axios.get(`${API_URL}/api/matches/my-matches`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setMatches(res.data || []);
      } catch (err) {
        console.error("Failed to load matches", err);
      }
    };
    if (token) fetchMatches();
  }, [token]);

  // Fetch conversation when match selected
  useEffect(() => {
    if (!selectedMatch) return;
    
    const fetchConversation = async () => {
      try {
        const res = await axios.get(`${API_URL}/api/messages/conversation/${selectedMatch._id}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setMessages(res.data || []);
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
    } catch (err) {
      console.error("Send failed", err);
      alert(err.response?.data?.message || "Failed to send message");
    }
  };

  // SINGLE RETURN STATEMENT WITH PROFESSIONAL STYLING
  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 78px)', background: '#fff' }}>
      {/* Matches Sidebar */}
      <div style={{ width: '30%', borderRight: '1px solid #eee', overflowY: 'auto', background: '#fafafa' }}>
        <h3 style={{ padding: '1rem', margin: 0, borderBottom: '1px solid #eee', background: '#fff' }}>Matches</h3>
        {matches.length === 0 ? (
          <p style={{ padding: '1rem', color: '#666', textAlign: 'center' }}>No matches yet</p>
        ) : (
          matches.map(match => (
            <div 
              key={match._id} 
              onClick={() => setSelectedMatch(match)}
              style={{ 
                padding: '1rem', 
                cursor: 'pointer',
                background: selectedMatch?._id === match._id ? '#eef2ff' : '#fff',
                borderBottom: '1px solid #f5f5f5',
                display: 'flex', alignItems: 'center', gap: '10px',
                transition: 'background 0.2s'
              }}
            >
              <img 
                src={match.photos?.[0]?.url || match.photos?.[0] || 'https://via.placeholder.com/40'} 
                alt={match.name}
                style={{ width: 45, height: 45, borderRadius: '50%', objectFit: 'cover', border: '1px solid #ddd' }}
              />
              <div>
                <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>{match.name}</div>
                <div style={{ fontSize: '0.8rem', color: '#666' }}>{match.age ? `${match.age} yrs` : ''}</div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Chat Area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#fff' }}>
        {selectedMatch ? (
          <>
            {/* Header */}
            <div style={{ padding: '1rem', borderBottom: '1px solid #eee', fontWeight: 600, background: '#fff', display: 'flex', alignItems: 'center', gap: '10px' }}>
               <img 
                  src={selectedMatch.photos?.[0]?.url || selectedMatch.photos?.[0] || 'https://via.placeholder.com/30'} 
                  alt={selectedMatch.name}
                  style={{ width: 35, height: 35, borderRadius: '50%', objectFit: 'cover' }}
                />
              {selectedMatch.name}
            </div>
            
            {/* Messages Scroll Area */}
            <div style={{ flex: 1, padding: '1.5rem', overflowY: 'auto', background: '#f8f9fa', display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
              {messages.length === 0 ? (
                <div style={{ textAlign: 'center', color: '#999', marginTop: '3rem' }}>
                  <p>Start your conversation with {selectedMatch.name}!</p>
                </div>
              ) : (
                messages.map(msg => {
                  const isMe = msg.sender?._id === currentUser._id;
                  return (
                    <div key={msg._id} style={{ display: 'flex', justifyContent: isMe ? 'flex-end' : 'flex-start' }}>
                      <div style={{ 
                        background: isMe ? '#5b72f2' : '#fff',
                        color: isMe ? '#fff' : '#333',
                        padding: '0.8rem 1.2rem',
                        borderRadius: isMe ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                        maxWidth: '75%',
                        boxShadow: '0 1px 2px rgba(0,0,0,0.08)',
                        fontSize: '0.95rem',
                        lineHeight: '1.4'
                      }}>
                        {msg.content}
                        <div style={{ fontSize: '0.65rem', opacity: 0.7, marginTop: '4px', textAlign: 'right' }}>
                          {new Date(msg.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Fixed Input Bar */}
            <div style={{ padding: '1rem', borderTop: '1px solid #eee', display: 'flex', gap: '10px', background: '#fff' }}>
              <input 
                type="text" 
                value={newMessage}
                onChange={e => setNewMessage(e.target.value)}
                onKeyPress={e => e.key === 'Enter' && handleSend()}
                placeholder="Type a message..."
                style={{ flex: 1, padding: '0.9rem 1.2rem', borderRadius: '24px', border: '1px solid #e2e8f0', outline: 'none', fontSize: '0.95rem', background: '#f8f9fa' }}
              />
              <button 
                onClick={handleSend}
                disabled={!newMessage.trim()}
                style={{ 
                  background: newMessage.trim() ? '#5b72f2' : '#cbd5e1', 
                  color: '#fff', border: 'none', borderRadius: '24px', 
                  padding: '0 1.8rem', fontWeight: 600, cursor: newMessage.trim() ? 'pointer' : 'default',
                  transition: 'all 0.2s'
                }}
              >
                Send
              </button>
            </div>
          </>
        ) : (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#999', background: '#f8f9fa' }}>
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>💬</div>
            <p>Select a match to start chatting</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default ChatScreen;
