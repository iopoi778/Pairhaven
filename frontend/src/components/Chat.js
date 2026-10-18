import React, { useState, useEffect, useRef } from 'react';
import io from 'socket.io-client';

const SOCKET_URL = process.env.REACT_APP_SOCKET_URL || 'https://pairhaven.onrender.com';

export default function Chat({ matchId, userId, partnerId }) {
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const socketRef = useRef(null);

  useEffect(() => {
    const socket = io(SOCKET_URL, { transports: ['websocket'] });
    socketRef.current = socket;
    socket.emit('join', userId);

    socket.on('newMessage', (msg) => {
      setMessages(m => [...m, msg]);
    });

    return () => { socket.disconnect(); };
  }, [userId]);

  const send = () => {
    const payload = { senderId: userId, receiverId: partnerId, content: text };
    socketRef.current.emit('sendMessage', payload);
    setMessages(m => [...m, { ...payload, createdAt: new Date() }]);
    setText('');
  };

  return (
    <div style={{ padding: 12 }}>
      <div style={{ height: 300, overflow: 'auto', border: '1px solid #eee', padding: 8 }}>
        {messages.map((m, i) => (
          <div key={i} style={{ marginBottom: 8 }}>
            <strong>{m.senderId === userId ? 'You' : 'Them'}:</strong> {m.content}
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
        <input value={text} onChange={e => setText(e.target.value)} style={{ flex: 1 }} />
        <button onClick={send}>Send</button>
      </div>
    </div>
  );
}
