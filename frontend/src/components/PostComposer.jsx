import React, { useState } from 'react';
import axios from 'axios';
const API = process.env.REACT_APP_API_URL || 'https://pairhaven.onrender.com';

export default function PostComposer({ onPosted }) {
  const [text, setText] = useState('');
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!file) return alert('Select a video or image');

    const form = new FormData();
    form.append('media', file);
    form.append('text', text);

    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const res = await axios.post(`${API}/api/posts`, form, {
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'multipart/form-data' }
      });
      setText('');
      setFile(null);
      if (onPosted) onPosted(res.data.post);
    } catch (err) {
      console.error('Upload failed', err);
      alert('Upload failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} style={{ padding: 12, background: '#fff', borderRadius: 10 }}>
      <textarea value={text} placeholder="Say something…" onChange={(e) => setText(e.target.value)} />
      <div>
        <input type="file" accept="video/*,image/*" onChange={(e) => setFile(e.target.files[0])} />
      </div>
      <button type="submit" disabled={loading}>{loading ? 'Posting…' : 'Post'}</button>
    </form>
  );
}
