const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { uploadPhotos } = require('../middleware/upload');

router.post('/register', uploadPhotos.array('photos', 5), async (req, res) => {
  try {
    const { name, email, phone, password, age, gender, bio, interests, location } = req.body;
    
    if (!req.files || req.files.length < 2) {
      return res.status(400).json({ message: 'At least 2 photos are required' });
    }
try {
  let loc = req.body.location;
  if (loc) {
    if (typeof loc === 'string') loc = JSON.parse(loc);
    if (Array.isArray(loc.coordinates) && loc.coordinates.length === 2) {
      user.location = {
        type: 'Point',
        coordinates: loc.coordinates,
        address: loc.address || ''
      };
    }
  }
} catch (err) {
  console.warn('Invalid location provided during registration', err);
}

// For dev convenience, consider auto-verify accounts (only when not production)
if (process.env.NODE_ENV !== 'production') {
  user.verificationStatus = 'verified';
}

// Save user
await user.save();

// Notify nearby users about the new user
try {
  const Notification = require('../models/Notification');
  // radius in meters (default 50km for notification; tune as needed)
  const notifyRadius = parseInt(process.env.NEW_USER_NOTIFY_RADIUS_METERS || '50000', 10);

  if (user.location && Array.isArray(user.location.coordinates)) {
    // Find users within radius, exclude the new user
    const nearby = await require('../models/User').find({
      _id: { $ne: user._id },
      location: {
        $near: {
          $geometry: { type: 'Point', coordinates: user.location.coordinates },
          $maxDistance: notifyRadius
        }
      }
    }).select('_id');

    // Create a notification for each nearby user
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
    const existingUser = await User.findOne({ $or: [{ email }, { phone }] });
    if (existingUser) {
      return res.status(400).json({ message: 'User already exists with this email or phone' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const [longitude, latitude] = JSON.parse(location.coordinates);

    const user = new User({
      name, email, phone, password: hashedPassword,
      photos: req.files.map((file, index) => ({
        url: file.path, publicId: file.filename, isPrimary: index === 0
      })),
      location: { type: 'Point', coordinates: [longitude, latitude], address: location.address },
      age: parseInt(age), gender, bio,
      interests: interests ? JSON.parse(interests) : []
    });

    await user.save();

    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' });

    res.status(201).json({
      message: 'Registration successful', token,
      user: { id: user._id, name: user.name, email: user.email, phone: user.phone, photos: user.photos, verificationStatus: user.verificationStatus, location: user.location }
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ message: 'Invalid credentials' });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ message: 'Invalid credentials' });

    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' });

    res.json({
      message: 'Login successful', token,
      user: { id: user._id, name: user.name, email: user.email, phone: user.phone, photos: user.photos, verificationStatus: user.verificationStatus, location: user.location, followersCount: user.followers.length, followingCount: user.following.length, likesReceivedCount: user.likesReceived.length }
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
