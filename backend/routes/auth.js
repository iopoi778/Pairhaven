const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Notification = require('../models/Notification');
const { uploadPhotos } = require('../middleware/upload');

router.post('/register', uploadPhotos.array('photos', 5), async (req, res) => {
  try {
    const { name, email, phone, password, age, gender, bio, interests } = req.body;

    if (!req.files || req.files.length < 2) {
      return res.status(400).json({ message: 'At least 2 photos are required' });
    }

    const existingUser = await User.findOne({ $or: [{ email }, { phone }] });
    if (existingUser) {
      return res.status(400).json({ message: 'User already exists with this email or phone' });
    }

    let parsedLocation = null;
    if (req.body.location) {
      try {
        parsedLocation = typeof req.body.location === 'string'
          ? JSON.parse(req.body.location)
          : req.body.location;
      } catch (err) {
        console.warn('Invalid location payload during register:', err);
      }
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    let coordinates = null;
    let address = '';
    if (parsedLocation && Array.isArray(parsedLocation.coordinates) && parsedLocation.coordinates.length === 2) {
      coordinates = parsedLocation.coordinates.map(Number);
      address = parsedLocation.address || '';
    }

    const user = new User({
      name,
      email,
      phone,
      password: hashedPassword,
      age: age ? parseInt(age, 10) : null,
      gender,
      bio,
      interests: interests
        ? (typeof interests === 'string' ? JSON.parse(interests) : interests)
        : [],
      photos: req.files.map((file, index) => ({
        url: file.path || file.secure_url || file.location || '',
        publicId: file.filename || file.public_id || null,
        isPrimary: index === 0
      })),
      location: coordinates ? {
        type: 'Point',
        coordinates,
        address
      } : {
        type: 'Point',
        coordinates: [0, 0]
      }
    });

    if (process.env.NODE_ENV !== 'production') {
      user.verificationStatus = 'verified';
    }

    await user.save();

    // Nearby user notifications
    try {
      const notifyRadius = parseInt(process.env.NEW_USER_NOTIFY_RADIUS_METERS || '50000', 10);

      if (user.location && Array.isArray(user.location.coordinates) && user.location.coordinates.length === 2) {
        const nearby = await User.find({
          _id: { $ne: user._id },
          location: {
            $near: {
              $geometry: { type: 'Point', coordinates: user.location.coordinates },$maxDistance: notifyRadius
            }
          }
        }).select('_id');

        if (nearby.length) {
          const notifications = nearby.map(u => ({
            recipient: u._id,
            sender: user._id,
            type: 'new-user',
            message: `${user.name} joined near you`,
            metadata: { newUserId: user._id }
          }));

          await Notification.insertMany(notifications);
        }
      }
    } catch (notifyErr) {
      console.warn('Failed to create new-user notifications', notifyErr);
    }

    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' });

    return res.status(201).json({
      message: 'Registration successful',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        photos: user.photos,
        verificationStatus: user.verificationStatus,
        location: user.location
      }
    });
  } catch (error) {
    console.error('Register error', error);
    return res.status(500).json({ message: error.message });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });

    if (!user) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' });

    return res.json({
      message: 'Login successful',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        photos: user.photos,
        verificationStatus: user.verificationStatus,
        location: user.location,
        followersCount: (user.followers || []).length,
        followingCount: (user.following || []).length,
        likesReceivedCount: (user.likesReceived || []).length
      }
    });
  } catch (error) {
    console.error('Login error', error);
    return res.status(500).json({ message: error.message });
  }
});
// Add these routes to your existing Express auth router

// 🌐 Google Auth Route
router.post('/google', async (req, res) => {
  try {
    const { email, name, googleId, photo } = req.body;
    
    let user = await User.findOne({ email });
    if (!user) {
      // Create a new user if they don't exist
      user = new User({
        name,
        email,
        googleId,
        photos: photo ? [{ url: photo, isPrimary: true }] : [],
        verificationStatus: 'verified',
        location: { type: 'Point', coordinates: [0, 0] }
      });
      await user.save();
    }

    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' });
    return res.json({
      message: 'Google login successful',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        photos: user.photos,
        verificationStatus: user.verificationStatus,
        location: user.location
      }
    });
  } catch (error) {
    console.error('Google auth error', error);
    return res.status(500).json({ message: error.message });
  }
});

// 🍎 Apple Auth Route
router.post('/apple', async (req, res) => {
  try {
    const { email, name, appleId } = req.body;
    
    let user = await User.findOne({ email });
    if (!user) {
      user = new User({
        name: name || 'Apple User',
        email,
        appleId,
        verificationStatus: 'verified',
        location: { type: 'Point', coordinates: [0, 0] }
      });
      await user.save();
    }

    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' });
    return res.json({
      message: 'Apple login successful',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        verificationStatus: user.verificationStatus,
        location: user.location
      }
    });
  } catch (error) {
    console.error('Apple auth error', error);
    return res.status(500).json({ message: error.message });
  }
});
module.exports = router;
