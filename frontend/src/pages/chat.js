
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
    axios.get(`${API_URL}/api/matches/my-matches`, { headers: { Authorization: `Bearer ${token}` } })
      .then(res => setMatches(res.data || []))
      .catch(err => console.error('Failed to load matches', err));

    const user = JSON.parse(localStorage.getItem('user') || '{}');
    const userId = user.id || user._id;
    if (!userId) return;

    const socket = io(SOCKET_URL, { transports: ['websocket'] });
    socketRef.current = socket;
    socket.emit('join', userId);

    socket.on('newMessage', (msg) => {
      // if current conversation, add; otherwise, optionally show indicator
      if (selected && (msg.sender === selected._id || msg.senderId === selected._id)) {
        setMessages(m => [...m, msg]);
      }
      // else: you could also mark notification or update matches state to show unread
    });

    return () => socket.disconnect();
  }, [selected]);

  const openConversation = async (user) => {
    setSelected(user);
    // fetch recent messages between current user and selected using your Message model route if you have one
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`${API_URL}/api/messages/thread/${user._id}`, { headers: { Authorization: `Bearer ${token}` } });
      setMessages(res.data || []);
    } catch (err) {
      console.warn('No messages or failed to load thread', err);
      setMessages([]);
    }
  };

  const send = () => {
    if (!text.trim() || !selected) return;
    const me = JSON.parse(localStorage.getItem('user') || '{}');
    const payload = { senderId: me.id || me._id, receiverId: selected._id, content: text };
    socketRef.current.emit('sendMessage', payload);
    setMessages(m => [...m, { ...payload, createdAt: new Date() }]);
    setText('');
  };

  return (
    <div style={{ display: 'flex', gap: 12, padding: 16 }}>
      <div style={{ width: 240, borderRight: '1px solid #eee', paddingRight: 12 }}>
        <h3 style={{ marginTop: 0 }}>Matches</h3>
        <ul style={{ listStyle: 'none', padding: 0 }}>
          {matches.map(m => (
            <li key={m._id} style={{ marginBottom: 8, cursor: 'pointer' }} onClick={() => openConversation(m)}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <img src={m.photos?.[0]?.url || m.photos?.[0] || 'https://via.placeholder.com/48'} style={{ width: 48, height: 48, borderRadius: 8, objectFit: 'cover' }} alt='' />
                <div>
                  <div style={{ fontWeight: 700 }}>{m.name}</div>
                  <div style={{ fontSize: 12, color: '#666' }}>{m.age} • {m.bio?.slice(0,40)}</div>
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
              {messages.map((msg, idx) => (
                <div key={idx} style={{ marginBottom: 8, textAlign: msg.senderId === (JSON.parse(localStorage.getItem('user')||'{}').id) ? 'right' : 'left' }}>
                  <div style={{ display: 'inline-block', padding: '8px 12px', borderRadius: 12, background: '#f0f8ff' }}>
                    {msg.content}
                    <div style={{ fontSize: 10, color: '#666', marginTop: 4 }}>{new Date(msg.createdAt).toLocaleTimeString()}</div>
                  </div>
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              <input value={text} onChange={(e) => setText(e.target.value)} style={{ flex: 1, padding: 8, borderRadius: 8 }} />
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
