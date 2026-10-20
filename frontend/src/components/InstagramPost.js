import React, { useState } from 'react';
import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'https://pairhaven.onrender.com';

function InstagramPost({ post, onProfileClick }) {
  const [likes, setLikes] = useState(post.likes?.length || 0);
  const [loves, setLoves] = useState(post.loves?.length || 0);
  const [userLiked, setUserLiked] = useState(post.likes?.includes(JSON.parse(localStorage.getItem('user'))._id));
  const [userLoved, setUserLoved] = useState(post.loves?.includes(JSON.parse(localStorage.getItem('user'))._id));
  const token = localStorage.getItem('token');

  const handleReact = async (type) => {
    try {
      const res = await axios.post(`${API_URL}/api/posts/${post._id}/react`, 
        { type }, 
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setLikes(res.data.likesCount);
      setLoves(res.data.lovesCount);
      setUserLiked(res.data.userLiked);
      setUserLoved(res.data.userLoved);
    } catch (err) { console.error("Reaction failed", err); }
  };

  return (
    <div style={{ background: '#fff', borderRadius: '12px', marginBottom: '1.5rem', boxShadow: '0 1px 4px rgba(0,0,0,0.05)', overflow: 'hidden' }}>
      {/* Header with Profile Preview */}
      <div style={{ display: 'flex', alignItems: 'center', padding: '1rem', cursor: 'pointer' }} onClick={() => onProfileClick(post.author._id)}>
        <img src={post.author.photos?.[0]?.url || 'https://via.placeholder.com/40'} alt="" style={{ width: 40, height: 40, borderRadius: '50%', objectFit: 'cover', marginRight: '10px' }} />
        <div>
          <div style={{ fontWeight: 700 }}>{post.author.name}</div>
          <div style={{ fontSize: '0.75rem', color: '#666' }}>{post.author.age} • {post.author.bio?.substring(0, 30)}...</div>
        </div>
      </div>

      {/* Media */}
      {post.mediaUrl && (
        post.mediaType === 'video' ? 
        <video src={post.mediaUrl} controls style={{ width: '100%', maxHeight: 500, background: '#000' }} /> :
        <img src={post.mediaUrl} alt="" style={{ width: '100%', maxHeight: 500, objectFit: 'cover' }} />
      )}

      {/* Actions Bar */}
      <div style={{ padding: '0.8rem 1rem', display: 'flex', gap: '1rem' }}>
        <button onClick={() => handleReact('like')} style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: userLiked ? '#e53e3e' : '#333' }}>
          {userLiked ? '❤️' : '🤍'}
        </button>
        <button onClick={() => handleReact('love')} style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: userLoved ? '#ff6b6b' : '#333' }}>
          {userLoved ? '💖' : ''}
        </button>
      </div>

      {/* Counts & Caption */}
      <div style={{ padding: '0 1rem 1rem' }}>
        <div style={{ fontWeight: 700, marginBottom: '0.3rem' }}>
          {likes > 0 && `${likes} Like${likes !== 1 ? 's' : ''}`} {loves > 0 && `• ${loves} Love${loves !== 1 ? 's' : ''}`}
        </div>
        {post.text && <div><strong>{post.author.name}</strong> {post.text}</div>}
        
        {/* Visibility Badge */}
        <div style={{ marginTop: '0.5rem', fontSize: '0.7rem', color: '#999', textTransform: 'uppercase' }}>
          {post.visibility === 'everyone' ? '🌍 Public' : post.visibility === 'followers' ? '👥 Followers Only' : '💞 Matches Only'}
        </div>
      </div>
    </div>
  );
}

export default InstagramPost;
