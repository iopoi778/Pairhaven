// backend/routes/profile.js
const express = require('express');
const router = express.Router();
const multer = require('multer');
const upload = multer(); // memory
const { uploadBuffer, destroy } = require('../services/cloudinary');
const auth = require('../middleware/auth');
const User = require('../models/User');

// GET current user's profile
router.get('/profile', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId).select('-password');
    if (!user) return res.status(404).json({ error: 'Not found' });
    res.json({ user });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT update profile
router.put('/profile', auth, express.json(), async (req, res) => {
  try {
    const { name, age, gender, bio, photos, remove_public_ids } = req.body;
    const user = await User.findById(req.user.userId);
    if (!user) return res.status(404).json({ error: 'Not found' });

    // delete removed photos from cloudinary
    if (Array.isArray(remove_public_ids)) {
      for (const pid of remove_public_ids) {
        try { await destroy(pid); } catch (e) { console.warn('Failed to destroy', pid, e); }
      }
    }

    user.name = name ?? user.name;
    user.age = (typeof age !== 'undefined') ? age : user.age;
    user.gender = gender ?? user.gender;
    user.bio = bio ?? user.bio;
    // Expect photos: [{ url, public_id }]
    if (Array.isArray(photos)) {
      user.photos = photos.map(p => ({ url: p.url, publicId: p.public_id || p.publicId || null, isPrimary: false }));
    }

    await user.save();
    res.json({ user });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /photos - upload single photo (server->cloudinary)
router.post('/photos', auth, upload.single('photo'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file' });
    const result = await uploadBuffer(req.file.buffer, { folder: 'pairhaven/users', resource_type: 'image' });
    const photo = { url: result.secure_url, public_id: result.public_id };
    return res.status(201).json({ photo });
  } catch (err) {
    console.error('Upload failed', err);
    res.status(500).json({ error: 'Upload failed' });
  }
});

module.exports = router;
