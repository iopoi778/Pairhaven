import React, { useState, useEffect, useRef } from 'react';
import io from 'socket.io-client';
import { API_BASE_URL } from '../config';

const socket = io(API_BASE_URL);

function Chat({ matchId, currentUserId }) {
  const [messages, setMessages] = useState([]);
  const [newMsg, setNewMsg] = useState('');
  const messagesEndRef = useRef(null);

  const roomId = [currentUserId, matchId].sort().join('_');

  useEffect(() => {
    // Join room and load history
    socket.emit('joinChat', roomId);
    socket.emit('loadHistory', roomId);

    // Listen for new messages and history
    socket.on('receiveMessage', (msg) => {
      setMessages(prev => [...prev, msg]);
    });
    
    socket.on('chatHistory', (history) => {
      setMessages(history);
    });

    return () => {
      socket.off('receiveMessage');
      socket.off('chatHistory');
    };
  }, [roomId]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = (e) => {
    e.preventDefault();
    if (!newMsg.trim()) return;
    
    socket.emit('sendMessage', {
      roomId,
      sender: currentUserId,
      text: newMsg
    });
    setNewMsg('');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '80vh' }}>
      <div style={{ flex: 1, overflowY: 'auto', padding: '1rem' }}>
        {messages.map((m, i) => (
          <div key={i} style={{ 
            textAlign: m.sender === currentUserId ? 'right' : 'left', 
            margin: '0.5rem 0' 
          }}>
            <span style={{ 
              background: m.sender === currentUserId ? '#007bff' : '#e9ecef', 
              color: m.sender === currentUserId ? '#fff' : '#000', 
              padding: '0.5rem 1rem', 
              borderRadius: '1rem',
              display: 'inline-block'
            }}>
              {m.text}
            </span>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>
      <form onSubmit={sendMessage} style={{ padding: '1rem', borderTop: '1px solid #ccc' }}>
        <input 
          value={newMsg} 
          onChange={e => setNewMsg(e.target.value)} 
          placeholder="Type a message..." 
          style={{ width: '80%', padding: '0.5rem' }} 
        />
        <button type="submit" style={{ padding: '0.5rem 1rem' }}>Send</button>
      </form>
    </div>
  );
}

export default Chat;