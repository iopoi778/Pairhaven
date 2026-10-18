import React, { useState, useEffect } from 'react';
import axios from 'axios';

const API_URL = 'https://pairhaven.onrender.com';
const PLACEHOLDER = 'https://via.placeholder.com/400?text=No+Image';

// NOTE: This is a TypeScript-flavored file (.tsx) but kept lightweight so your app can adopt it gradually.
// Save as frontend/src/components/EditProfile.tsx

export default function EditProfile({ onSaved }: any) {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [photos, setPhotos] = useState<any[]>([]);

  useEffect(() => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    if (!token) { setLoading(false); return; }
    let mounted = true;
    axios.get(`${API_URL}/api/users/profile`, { headers: { Authorization: `Bearer ${token}` } })
      .then(res => {
        if (!mounted) return;
        setUser(res.data.user || null);
        const initial = (res.data.user?.photos || []).map((p: any) => ({ file: null, preview: p.url || p, uploaded: true, url: p.url || p, public_id: p.public_id || p.publicId }));
        setPhotos(initial);
      }).catch(err => console.error(err)).finally(() => setLoading(false));
    return () => { mounted = false; };
  }, []);

  const handleFiles = (files: FileList | null) => {
    if (!files) return;
    const arr = Array.from(files).slice(0, 6 - photos.length);
    const mapped = arr.map(f => ({ file: f, preview: URL.createObjectURL(f), uploaded: false }));
    setPhotos(p => [...p, ...mapped]);
  };

  const removePhoto = (index: number) => {
    const copy = [...photos];
    const removed = copy.splice(index, 1)[0];
    if (removed?.uploaded && removed.public_id) {
      setUser((u: any) => ({ ...u, _removePhotos: [...(u._removePhotos || []), removed.public_id] }));
    }
    setPhotos(copy);
  };

  const uploadNewPhotos = async () => {
    const token = localStorage.getItem('token');
    const toUpload = photos.filter(p => !p.uploaded && p.file);
    const uploaded: any[] = [];
    for (const item of toUpload) {
      const fd = new FormData();
      fd.append('photo', item.file);
      const res = await axios.post(`${API_URL}/api/users/photos`, fd, { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'multipart/form-data' } });
      uploaded.push(res.data.photo);
    }
    return uploaded;
  };

  const handleSave = async () => {
    const token = localStorage.getItem('token');
    if (!token) return alert('Not authenticated');
    setSaving(true);
    try {
      const newPhotos = await uploadNewPhotos();
      const uploadedPhotos = [
        ...photos.filter(p => p.uploaded && p.url).map(p => ({ url: p.url, public_id: p.public_id })),
        ...newPhotos
      ];
      const payload = { name: user.name, age: user.age, gender: user.gender, bio: user.bio, photos: uploadedPhotos, remove_public_ids: user._removePhotos || [] };
      const res = await axios.put(`${API_URL}/api/users/profile`, payload, { headers: { Authorization: `Bearer ${token}` } });
      setUser(res.data.user);
      localStorage.setItem('user', JSON.stringify(res.data.user));
      if (onSaved) onSaved(res.data.user);
      alert('Saved');
    } catch (err) {
      console.error(err); alert('Save failed');
    } finally { setSaving(false); }
  };

  if (loading) return <div style={{ padding: 20 }}>Loading...</div>;
  if (!user) return <div style={{ padding: 20 }}>Please log in</div>;

  return (
    <div style={{ padding: 16 }}>
      <h3>Edit Profile</h3>
      <input value={user.name || ''} onChange={(e) => setUser({ ...user, name: e.target.value })} placeholder="Name" />
      <input type="number" value={user.age || ''} onChange={(e) => setUser({ ...user, age: Number(e.target.value) })} placeholder="Age" />
      <select value={user.gender || ''} onChange={(e) => setUser({ ...user, gender: e.target.value })}>
        <option value="">Prefer not to say</option>
        <option value="male">Male</option>
        <option value="female">Female</option>
        <option value="other">Other</option>
      </select>
      <textarea value={user.bio || ''} onChange={(e) => setUser({ ...user, bio: e.target.value })} />

      <div style={{ marginTop: 12 }}>
        <strong>Photos</strong>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))', gap: 8 }}>
          {photos.map((p, i) => (
            <div key={i} style={{ position: 'relative' }}>
              <img src={p.preview || p.url || PLACEHOLDER} alt={`photo-${i}`} style={{ width: '100%', aspectRatio: '1', objectFit: 'cover' }} />
              <button onClick={() => removePhoto(i)} style={{ position: 'absolute', top: 6, right: 6 }}>X</button>
            </div>
          ))}
        </div>
        <input type="file" multiple accept="image/*" onChange={(e) => handleFiles(e.target.files)} />
      </div>

      <div style={{ marginTop: 12 }}>
        <button onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button>
      </div>
    </div>
  );
}
