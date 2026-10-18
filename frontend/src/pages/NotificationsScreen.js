
import React, { useEffect, useState } from 'react';
import axios from 'axios';
const API_URL = process.env.REACT_APP_API_URL || 'https://pairhaven.onrender.com';

export default function NotificationsScreen() {
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    const token = localStorage.getItem('token');
    axios.get(`${API_URL}/api/notifications`, { headers: { Authorization: `Bearer ${token}` } })
      .then(res => { if (mounted) setNotes(res.data); })
      .catch(err => console.error('Failed to fetch notifications', err))
      .finally(() => { if (mounted) setLoading(false); });
    return () => mounted = false;
  }, []);

  const markRead = async (id) => {
    const token = localStorage.getItem('token');
    try {
      await axios.put(`${API_URL}/api/notifications/${id}/read`, {}, { headers: { Authorization: `Bearer ${token}` } });
      setNotes(n => n.map(x => x._id === id ? { ...x, read: true } : x));
    } catch (err) { console.error(err); }
  };

  if (loading) return <div style={{ padding: 20, textAlign: 'center' }}>Loading...</div>;
  if (!notes.length) return <div style={{ padding: 20, textAlign: 'center' }}>You have no notifications.</div>;

  return (
    <div style={{ padding: 16 }}>
      <h2>Notifications</h2>
      <ul style={{ listStyle: 'none', padding: 0 }}>
        {notes.map(n => (
          <li key={n._id} style={{ background: n.read ? '#fff' : '#eef6ff', padding: 12, borderRadius: 8, marginBottom: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <div>
                <strong>{n.type}</strong> — {n.message}
                <div style={{ fontSize: 12, color: '#666' }}>{new Date(n.createdAt).toLocaleString()}</div>
              </div>
              <div>
                {!n.read && <button onClick={() => markRead(n._id)} style={{ marginLeft: 8 }}>Mark read</button>}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
