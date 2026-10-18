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
        // FIXED: Use /conversation/:userId instead of /thread/:id
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

  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 140px)', background: '#fff' }}>
      {/* Matches Sidebar */}
      <div style={{ width: '30%', borderRight: '1px solid #eee', overflowY: 'auto' }}>
        <h3 style={{ padding: '1rem', margin: 0, borderBottom: '1px solid #eee' }}>Matches</h3>
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
                background: selectedMatch?._id === match._id ? '#eef2ff' : 'transparent',
                borderBottom: '1px solid #f5f5f5',
                display: 'flex', alignItems: 'center', gap: '10px'
              }}
            >
              <img 
                src={match.photos?.[0]?.url || match.photos?.[0] || 'https://via.placeholder.com/40'} 
                alt={match.name}
                style={{ width: 40, height: 40, borderRadius: '50%', objectFit: 'cover' }}
              />
              <div>
                <div style={{ fontWeight: 600 }}>{match.name}</div>
                <div style={{ fontSize: '0.8rem', color: '#666' }}>{match.age || ''}</div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Chat Area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        {selectedMatch ? (
          <>
            {/* Header */}
            <div style={{ padding: '1rem', borderBottom: '1px solid #eee', fontWeight: 600 }}>
              {selectedMatch.name}
            </div>
            
            {/* Messages */}
            <div style={{ flex: 1, padding: '1rem', overflowY: 'auto', background: '#fafafa' }}>
              {messages.length === 0 ? (
                <p style={{ textAlign: 'center', color: '#999', marginTop: '2rem' }}>Start the conversation!</p>
              ) : (
                messages.map(msg => (
                  <div 
                    key={msg._id} 
                    style={{ 
                      display: 'flex', 
                      justifyContent: msg.sender?._id === JSON.parse(localStorage.getItem('user'))._id ? 'flex-end' : 'flex-start',
                      marginBottom: '0.8rem'
                    }}
                  >
                    <div style={{ 
                      background: msg.sender?._id === JSON.parse(localStorage.getItem('user'))._id ? '#5b72f2' : '#fff',
                      color: msg.sender?._id === JSON.parse(localStorage.getItem('user'))._id ? '#fff' : '#333',
                      padding: '0.6rem 1rem',
                      borderRadius: '18px',
                      maxWidth: '70%',
                      boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
                    }}>
                      {msg.content}
                      <div style={{ fontSize: '0.7rem', opacity: 0.7, marginTop: '4px', textAlign: 'right' }}>
                        {new Date(msg.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                      </div>
                    </div>
                  </div>
                ))
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div style={{ padding: '1rem', borderTop: '1px solid #eee', display: 'flex', gap: '10px' }}>
              <input 
                type="text" 
                value={newMessage}
                onChange={e => setNewMessage(e.target.value)}
                onKeyPress={e => e.key === 'Enter' && handleSend()}
                placeholder="Type a message..."
                style={{ flex: 1, padding: '0.8rem', borderRadius: '24px', border: '1px solid #ddd', outline: 'none' }}
              />
              <button 
                onClick={handleSend}
                style={{ background: '#5b72f2', color: '#fff', border: 'none', borderRadius: '24px', padding: '0 1.5rem', fontWeight: 600, cursor: 'pointer' }}
              >
                Send
              </button>
            </div>
          </>
        ) : (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#999' }}>
            Select a match to start chatting
          </div>
        )}
      </div>
    </div>
  );
}

export default ChatScreen;
