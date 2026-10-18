import React, { useEffect, useRef, useState } from 'react';
import io from 'socket.io-client';

const SOCKET_URL = process.env.REACT_APP_SOCKET_URL || 'https://pairhaven.onrender.com';

function ChatScreen() {
  const [messages, setMessages] = useState([
    { senderId: 'system', receiverId: 'me', content: 'Start a new conversation by matching with someone.' }
  ]);
  const [text, setText] = useState('');
  const socketRef = useRef(null);

  useEffect(() => {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    const userId = user.id || user._id;

    if (!userId) return;

    const socket = io(SOCKET_URL, { transports: ['websocket'] });
    socketRef.current = socket;

    socket.emit('join', userId);

    socket.on('newMessage', (msg) => {
      setMessages(prev => [...prev, msg]);
    });

    return () => socket.disconnect();
  }, []);

  const sendMessage = () => {
    if (!text.trim()) return;
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    const senderId = user.id || user._id;
    const receiverId = 'demo-match-user';

    if (!senderId) return;

    const payload = {
      senderId,
      receiverId,
      content: text
    };

    socketRef.current.emit('sendMessage', payload);
    setMessages(prev => [...prev, { ...payload, createdAt: new Date() }]);
    setText('');
  };

  return (
    <div style={{ paddingTop: '2rem' }}>
      <h2 style={{ textAlign: 'center', marginBottom: '1rem' }}>Chat</h2>

      <div style={{ background: '#fff', borderRadius: '12px', padding: '1rem', minHeight: '300px', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        {messages.map((msg, index) => (
          <div
            key={index}
            style={{
              alignSelf: msg.senderId === 'system' ? 'center' : (msg.senderId === JSON.parse(localStorage.getItem('user') || '{}').id ? 'flex-end' : 'flex-start'),
              background: msg.senderId === 'system' ? '#f0f0f0' : '#dfe8ff',
              borderRadius: '12px',
              padding: '0.6rem 0.8rem',
              maxWidth: '75%'
            }}
          >
            {msg.content}
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Type a message..."
          style={{ flex: 1, padding: '0.8rem', borderRadius: '8px', border: '1px solid #dfe3ea' }}
        />
        <button onClick={sendMessage} style={{ padding: '0.8rem 1rem', background: '#5b72f2', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>
          Send
        </button>
      </div>
    </div>
  );
}

export default ChatScreen;