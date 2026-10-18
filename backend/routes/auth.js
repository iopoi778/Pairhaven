const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Notification = require('../models/Notification');
const { uploadPhotos } = require('../middleware/upload'); // your multer/cloudinary middleware

// Register route (multipart/form-data; files in req.files)
router.post('/register', uploadPhotos.array('photos', 5), async (req, res) => {
  try {
    const { name, email, phone, password, age, gender, bio, interests } = req.body;
    // location may be provided as JSON string in req.body.location
    let location = null;
    if (req.body.location) {
      try {
        location = typeof req.body.location === 'string' ? JSON.parse(req.body.location) : req.body.location;
      } catch (err) {
        console.warn('Invalid location JSON, ignoring', err);
      }
    }

    // require photos count
    if (!req.files || req.files.length < 2) {
      return res.status(400).json({ message: 'At least 2 photos are required' });
    }

    // check duplicates
    const existingUser = await User.findOne({ $or: [{ email }, { phone }] });
    if (existingUser) {
      return res.status(400).json({ message: 'User already exists with this email or phone' });
    }

    // hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // parse coordinates safely if provided
    let coordinates = null;
    let address = '';
    if (location && Array.isArray(location.coordinates) && location.coordinates.length === 2) {
      coordinates = location.coordinates.map(Number);
      address = location.address || '';
    }

    // Build user object
    const userData = {
      name,
      email,
      phone,
      password: hashedPassword,
      photos: req.files.map((file, index) => ({
        url: file.path || file.secure_url || file.location || '',
        publicId: file.filename || file.public_id || null,
        isPrimary: index === 0
      })),
      location: coordinates ? { type: 'Point', coordinates, address } : undefined,
      age: age ? parseInt(age, 10) : undefined,
      gender,
      bio,
      interests: interests ? (typeof interests === 'string' ? JSON.parse(interests) : interests) : []
    };

    // For dev convenience, auto-verify when not production (optional)
    if (process.env.NODE_ENV !== 'production') {
      userData.verificationStatus = 'verified';
    }

    const user = new User(userData);
    await user.save();

    // Notify nearby users about the new user (if user has location)
    try {
      const notifyRadius = parseInt(process.env.NEW_USER_NOTIFY_RADIUS_METERS || '50000', 10);

      if (user.location && Array.isArray(user.location.coordinates) && user.location.coordinates.length === 2) {
        const nearby = await User.find({
          _id: { $ne: user._id },
          location: {
            $near: {
              $geometry: { type: 'Point', coordinates: user.location.coordinates },
              $maxDistance: notifyRadius
            }
          }
        }).select('_id');

        const notifications = nearby.map(u => ({
          recipient: u._id,
          sender: user._id,
          type: 'new-user',
          message: `${user.name} joined near you`,
          metadata: { newUserId: user._id }
        }));

        if (notifications.length) {
          await Notification.insertMany(notifications);
        }
      }
    } catch (notifyErr) {
      console.warn('Failed to create new-user notifications', notifyErr);
    }

    // issue token and return user summary
    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' });

    res.status(201).json({
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
    res.status(500).json({ message: error.message });
  }
});

// Login route
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email }).lean();
    if (!user) return res.status(400).json({ message: 'Invalid credentials' });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ message: 'Invalid credentials' });

    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' });

    res.json({
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
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
