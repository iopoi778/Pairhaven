const express = require('express');
const router = express.Router();
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const auth = require('../middleware/auth');
const User = require('../models/User');

const upload = multer();

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

const normalizePhoto = (photo) => {
  if (!photo) return null;
  if (typeof photo === 'string') {
    return { url: photo, public_id: null };
  }
  const url = photo.url || photo.secure_url || photo.location || '';
  const public_id = photo.public_id || photo.publicId || photo.publicID || null;
  if (!url) return null;
  return { url, public_id };
};

const normalizePhotos = (photos = []) => {
  if (!Array.isArray(photos)) return [];
  return photos
    .map(normalizePhoto)
    .filter(Boolean);
};

// GET /api/users/profile
router.get('/profile', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId).select('-password');

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const safeUser = user.toObject();
    safeUser.photos = normalizePhotos(user.photos);

    return res.json({ user: safeUser });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: error.message });
  }
});

// PUT /api/users/profile
router.put('/profile', auth, async (req, res) => {
  try {
    const { name, age, gender, bio, photos, remove_public_ids } = req.body;

    const user = await User.findById(req.user.userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Remove Cloudinary assets if requested
    if (Array.isArray(remove_public_ids) && remove_public_ids.length > 0) {
      for (const publicId of remove_public_ids) {
        try {
          await cloudinary.uploader.destroy(publicId);
        } catch (err) {
          console.warn('Cloudinary delete failed:', publicId, err.message);
        }
      }
    }

    if (typeof name !== 'undefined') user.name = name;
    if (typeof age !== 'undefined') user.age = age;
    if (typeof gender !== 'undefined') user.gender = gender;
    if (typeof bio !== 'undefined') user.bio = bio;

    if (Array.isArray(photos)) {
      user.photos = normalizePhotos(photos).map((p, index) => ({
        url: p.url,
        publicId: p.public_id || null,
        isPrimary: index === 0
      }));
    }

    await user.save();

    const safeUser = user.toObject();
    safeUser.photos = normalizePhotos(user.photos);

    return res.json({ user: safeUser });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: error.message });
  }
});

// POST /api/users/photos
router.post('/photos', auth, upload.single('photo'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No photo uploaded' });
    }

    const base64 = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;

    const result = await cloudinary.uploader.upload(base64, {
      folder: 'pairhaven/users',
      resource_type: 'image'
    });

    return res.status(201).json({
      photo: {
        url: result.secure_url,
        public_id: result.public_id
      }
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: error.message });
  }
});

module.exports = router;