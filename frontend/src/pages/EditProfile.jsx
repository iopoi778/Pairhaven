import React, { useState, useEffect } from "react";
import axios from "axios";

const API_URL = "https://pairhaven.onrender.com";
const PLACEHOLDER = "https://via.placeholder.com/400?text=No+Image";

export default function EditProfile({ onSaved }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [photos, setPhotos] = useState([]); // {file, preview, uploaded (bool), url, public_id}
  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;

  useEffect(() => {
    if (!token) {
      setLoading(false);
      return;
    }
    let mounted = true;
    axios
      .get(`${API_URL}/api/users/profile`, { headers: { Authorization: `Bearer ${token}` } })
      .then((res) => {
        if (!mounted) return;
        setUser(res.data.user ?? null);
        const initialPhotos = (res.data.user?.photos || []).map((p) => ({
          file: null,
          preview: typeof p === "string" ? p : (p.url || p.secure_url || p.location),
          uploaded: true,
          url: typeof p === "string" ? p : (p.url || p.secure_url || p.location),
          public_id: p.public_id || null,
        }));
        setPhotos(initialPhotos);
      })
      .catch((err) => {
        console.error("Failed to load profile:", err);
        try {
          const snapshot = JSON.parse(localStorage.getItem("user") || "null");
          if (snapshot) setUser(snapshot);
        } catch (_) {}
      })
      .finally(() => setLoading(false));
    return () => (mounted = false);
  }, [token]);

  const handleFieldChange = (k, v) => setUser((u) => ({ ...u, [k]: v }));

  const handleFiles = (files) => {
    const arr = Array.from(files).slice(0, 6 - photos.length); // limit to 6
    const mapped = arr.map((file) => ({
      file,
      preview: URL.createObjectURL(file),
      uploaded: false,
      url: null,
      public_id: null,
    }));
    setPhotos((p) => [...p, ...mapped]);
  };

  const removePhoto = (index) => {
    const p = [...photos];
    const removed = p.splice(index, 1)[0];
    // if already uploaded, mark for server deletion on save by storing public_id in user._removePhotos
    if (removed?.uploaded && removed.public_id) {
      setUser((u) => ({ ...u, _removePhotos: [...(u._removePhotos || []), removed.public_id] }));
    }
    setPhotos(p);
  };

  const uploadNewPhotos = async () => {
    const toUpload = photos.filter((p) => !p.uploaded && p.file);
    if (toUpload.length === 0) return [];
    const uploaded = [];
    for (const item of toUpload) {
      const fd = new FormData();
      fd.append("photo", item.file);
      try {
        const res = await axios.post(`${API_URL}/api/users/photos`, fd, {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "multipart/form-data",
          },
        });
        // server returns { photo: { url, public_id } }
        uploaded.push(res.data.photo);
      } catch (err) {
        console.error("Photo upload failed:", err);
        throw err;
      }
    }
    return uploaded;
  };

  const handleSave = async () => {
    if (!token) return alert("Not authenticated");
    setSaving(true);
    try {
      // 1. Upload new photos and gather returned photo objects
      const newPhotos = await uploadNewPhotos();
      // 2. Build payload: merge existing uploaded photo URLs with new ones and send profile fields
      const uploadedPhotos = [
        // already uploaded photos
        ...photos.filter((p) => p.uploaded && p.url).map((p) => ({ url: p.url, public_id: p.public_id })),
        // newly uploaded
        ...newPhotos,
      ];
      const payload = {
        name: user.name,
        age: user.age,
        gender: user.gender,
        bio: user.bio,
        photos: uploadedPhotos, // server will set this as the canonical list
        remove_public_ids: user._removePhotos || [],
      };
      const res = await axios.put(`${API_URL}/api/users/profile`, payload, {
        headers: { Authorization: `Bearer ${token}` },
      });
      // update local user snapshot
      setUser(res.data.user);
      localStorage.setItem("user", JSON.stringify(res.data.user));
      if (onSaved) onSaved(res.data.user);
      alert("Profile saved");
    } catch (err) {
      console.error("Save failed:", err);
      alert("Failed to save profile. Try again.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div style={{ padding: 20 }}>Loading profile...</div>;
  if (!user) return <div style={{ padding: 20 }}>Please log in.</div>;

  return (
    <div style={{ padding: 16 }}>
      <h2>Edit Profile</h2>
      <div style={{ marginBottom: 12 }}>
        <label>
          Name
          <input value={user.name || ""} onChange={(e) => handleFieldChange("name", e.target.value)} />
        </label>
      </div>
      <div style={{ marginBottom: 12 }}>
        <label>
          Age
          <input type="number" value={user.age ?? ""} onChange={(e) => handleFieldChange("age", Number(e.target.value))} />
        </label>
      </div>
      <div style={{ marginBottom: 12 }}>
        <label>
          Gender
          <select value={user.gender || ""} onChange={(e) => handleFieldChange("gender", e.target.value)}>
            <option value="">Prefer not to say</option>
            <option value="female">Female</option>
            <option value="male">Male</option>
            <option value="nonbinary">Non-binary</option>
            <option value="other">Other</option>
          </select>
        </label>
      </div>
      <div style={{ marginBottom: 12 }}>
        <label>
          Bio
          <textarea value={user.bio || ""} onChange={(e) => handleFieldChange("bio", e.target.value)} rows={4} />
        </label>
      </div>

      <div style={{ marginBottom: 12 }}>
        <strong>Photos</strong>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(100px, 1fr))", gap: 8, marginTop: 8 }}>
          {photos.length === 0 && (
            <div style={{ padding: 12, background: "#f5f5f5", borderRadius: 8 }}>No photos</div>
          )}
          {photos.map((p, i) => (
            <div key={i} style={{ position: "relative" }}>
              <img
                src={p.preview || p.url || PLACEHOLDER}
                alt={`photo-${i}`}
                style={{ width: "100%", aspectRatio: "1", objectFit: "cover", borderRadius: 8 }}
              />
              <button
                onClick={() => removePhoto(i)}
                style={{ position: "absolute", top: 6, right: 6, background: "#e53e3e", color: "#fff", border: "none", borderRadius: 6, padding: "4px 6px" }}
              >
                X
              </button>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 8 }}>
          <input type="file" accept="image/*" multiple onChange={(e) => handleFiles(e.target.files)} />
          <div style={{ fontSize: 12, color: "#666", marginTop: 6 }}>Max 6 photos. JPG/PNG recommended.</div>
        </div>
      </div>

      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={handleSave} disabled={saving} style={{ padding: "8px 12px", background: "#2b6cb0", color: "#fff", border: "none", borderRadius: 8 }}>
          {saving ? "Saving..." : "Save"}
        </button>
      </div>
    </div>
  );
}