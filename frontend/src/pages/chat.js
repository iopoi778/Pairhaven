import React, { useEffect, useState, useRef } from 'react';
import io from 'socket.io-client';
import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'https://pairhaven.onrender.com';
const SOCKET_URL = process.env.REACT_APP_SOCKET_URL || API_URL;

export default function ChatScreen() {
  const [matches, setMatches] = useState([]);
  const [selected, setSelected] = useState(null);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const socketRef = useRef(null);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) return;

    axios.get(`${API_URL}/api/matches/my-matches`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(res => setMatches(res.data || []))
      .catch(err => console.error('Failed to load matches', err));

    const user = JSON.parse(localStorage.getItem('user') || '{}');
    const userId = user.id || user._id;
    if (!userId) return;

    const socket = io(SOCKET_URL, {
      path: '/socket.io',
      transports: ['websocket'],
      auth: { token }
    });

    socketRef.current = socket;
    socket.emit('join', userId);

    socket.on('newMessage', (msg) => {
      const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
      const currentId = currentUser.id || currentUser._id;

      if (selected && (msg.senderId === selected._id || msg.sender === selected._id)) {
        setMessages(prev => [...prev, msg]);
      }
    });

    return () => socket.disconnect();
  }, [selected]);

  const openConversation = async (user) => {
    setSelected(user);

    const token = localStorage.getItem('token');
    try {
      const res = await axios.get(`${API_URL}/api/messages/thread/${user._id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setMessages(res.data || []);
    } catch (err) {
      console.warn('No messages found or thread fetch failed', err);
      setMessages([]);
    }
  };

  const send = () => {
    if (!text.trim() || !selected) return;

    const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
    const payload = {
      senderId: currentUser.id || currentUser._id,
      receiverId: selected._id,
      content: text
    };

    if (socketRef.current) {
      socketRef.current.emit('sendMessage', payload);
      setMessages(prev => [...prev, { ...payload, createdAt: new Date() }]);
      setText('');
    }
  };

  return (
    <div style={{ display: 'flex', gap: 12, padding: 16 }}>
      <div style={{ width: 240, borderRight: '1px solid #eee', paddingRight: 12 }}>
        <h3 style={{ marginTop: 0 }}>Matches</h3>
        <ul style={{ listStyle: 'none', padding: 0 }}>
          {matches.map(m => (
            <li key={m._id} style={{ marginBottom: 8, cursor: 'pointer' }} onClick={() => openConversation(m)}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <img
                  src={m.photos?.[0]?.url || 'https://via.placeholder.com/48'}
                  style={{ width: 48, height: 48, borderRadius: 8, objectFit: 'cover' }}
                  alt=""
                />
                <div>
                  <div style={{ fontWeight: 700 }}>{m.name}</div>
                  <div style={{ fontSize: 12, color: '#666' }}>{m.age || ''}</div>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </div>

      <div style={{ flex: 1 }}>
        {selected ? (
          <>
            <h3>{selected.name}</h3>
            <div style={{ height: 360, overflow: 'auto', border: '1px solid #eee', padding: 12, borderRadius: 8 }}>
              {messages.map((msg, idx) => {
                const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
                const meId = currentUser.id || currentUser._id;

                const isMine = String(msg.senderId || msg.sender || '') === String(meId);
                return (
                  <div key={idx} style={{ marginBottom: 8, textAlign: isMine ? 'right' : 'left' }}>
                    <div
                      style={{
                        display: 'inline-block',
                        maxWidth: '75%',
                        padding: '8px 12px',
                        borderRadius: 12,
                        background: isMine ? '#dfe7ff' : '#f4f4f4'
                      }}
                    >
                      {msg.content}
                      <div style={{ fontSize: 10, color: '#666', marginTop: 4 }}>
                        {msg.createdAt ? new Date(msg.createdAt).toLocaleTimeString() : 'now'}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              <input
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Type a message..."
                style={{ flex: 1, padding: 8, borderRadius: 8, border: '1px solid #ddd' }}
              />
              <button onClick={send} style={{ padding: '8px 12px' }}>Send</button>
            </div>
          </>
        ) : (
          <div style={{ textAlign: 'center', paddingTop: 40 }}>Select a match to open chat</div>
        )}
      </div>
    </div>
  );
}
