const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const Post = require('../models/Post');
const User = require('../models/User');
const Notification = require('../models/Notification');
const Message = require('../models/Message'); // ✅ Import Message Model for Auto-Rules
const { uploadPhotos } = require('../middleware/upload');
const auth = require('../middleware/auth'); 

// Helper function to create welcome notification
async function createWelcomeNotification(userId, name) {
  try {
    await Notification.create({
      recipient: userId,
      sender: userId,
      type: 'welcome',
      message: `Welcome to PairHaven, ${name}! Explore profiles and find your match.`,
      read: false
    });
  } catch (err) {
    console.error('Failed to create welcome notification:', err);
  }
}

// 🤖 Helper function: Auto-Follow Admin & Send Automated Rules Message
async function autoConnectAndSendRules(newUser) {
  try {
    const adminEmail = process.env.ADMIN_EMAIL || 'admin@pairhaven.com';
    const adminUser = await User.findOne({ email: adminEmail });

    if (adminUser) {
      // 1. Auto-Follow / Pair user with Admin in matches array
      if (!newUser.matches.some(id => id.toString() === adminUser._id.toString())) {
        newUser.matches.push(adminUser._id);
        await newUser.save();
      }
      if (!adminUser.matches.some(id => id.toString() === newUser._id.toString())) {
        adminUser.matches.push(newUser._id);
        await adminUser.save();
      }

      // 2. Auto-Send Rules & Community Guidelines Message (Using 'content' field)
      const welcomeRulesText = 
        `Welcome to PairHaven, ${newUser.name}! 👋\n\n` +
        `Please adhere to our Community Rules:\n` +
        `1. Be respectful to all members.\n` +
        `2. No harassment, hate speech, or explicit violations.\n` +
        `3. You must be 18+ to use PairHaven.\n` +
        `4. Do not post spam or financial solicitation links.\n\n` +
        `If you have any issues or support requests, reply to this chat directly!`;

      await Message.create({
        sender: adminUser._id,
        receiver: newUser._id, // ✅ Schema uses 'receiver', not 'recipient'
        content: welcomeRulesText, // ✅ Schema uses 'content', not 'text'
        read: false
      });
    }
  } catch (err) {
    console.error('Failed auto-follow or rules dispatch:', err);
  }
}

// DELETE CURRENT USER PROFILE
router.delete('/profile/me', auth, async (req, res) => {
  try {
    const userId = req.user.userId;
    
    await Post.deleteMany({ author: userId });
    await User.findByIdAndDelete(userId);

    res.status(200).json({ message: 'Account deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// REGISTER ROUTE
router.post('/register', (req, res, next) => {
  uploadPhotos.array('photos', 5)(req, res, (err) => {
    if (err) {
      console.error('Multer/Cloudinary Upload Error:', err);
      return res.status(400).json({ message: err.message || 'Image upload failed.' });
    }
    next();
  });
}, async (req, res) => {
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

    let parsedInterests = [];
    if (interests) {
      try {
        parsedInterests = typeof interests === 'string' ? JSON.parse(interests) : interests;
      } catch (e) {
        parsedInterests = [];
      }
    }

    const user = new User({
      name,
      email,
      phone,
      password: hashedPassword,
      age: age ? parseInt(age, 10) : null,
      gender,
      bio,
      interests: parsedInterests,
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

    // Trigger Welcome Notification
    await createWelcomeNotification(user._id, user.name);

    // 🤖 Auto-Follow Admin & Dispatch Welcome Rules
    await autoConnectAndSendRules(user);

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
        location: user.location,
        role: user.role,                  // ✅ Returned role
        membershipTier: user.membershipTier, // ✅ Returned tier
        isVip: user.isVip                  // ✅ Returned VIP status
      }
    });
  } catch (error) {
    console.error('Register error:', error);
    return res.status(500).json({ message: error.message || 'Server error during registration' });
  }
});

// LOGIN ROUTE
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
        role: user.role,                  // ✅ Returned role
        membershipTier: user.membershipTier, // ✅ Returned tier
        isVip: user.isVip                  // ✅ Returned VIP status
      }
    });
  } catch (error) {
    console.error('Login error', error);
    return res.status(500).json({ message: error.message });
  }
});

// Google Auth Route
router.post('/google', async (req, res) => {
  try {
    const { email, name, googleId, photo, age, gender, phone } = req.body;
    
    let user = await User.findOne({ email });
    if (!user) {
      user = new User({
        name,
        email,
        googleId,
        age: age || 25,
        gender: gender || 'other',
        phone: phone || ('google_' + Date.now()),
        photos: photo ? [{ url: photo, isPrimary: true }] : [{ url: 'https://via.placeholder.com/150', isPrimary: true }],
        verificationStatus: 'verified',
        location: { type: 'Point', coordinates: [0, 0] }
      });
      await user.save();
      await createWelcomeNotification(user._id, user.name);
      await autoConnectAndSendRules(user); // 🤖 Auto-follow & send rules
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
        location: user.location,
        role: user.role,
        membershipTier: user.membershipTier,
        isVip: user.isVip
      }
    });
  } catch (error) {
    console.error('Google auth error', error);
    return res.status(500).json({ message: error.message });
  }
});

// Apple Auth Route
router.post('/apple', async (req, res) => {
  try {
    const { email, name, appleId, age, gender, phone } = req.body;
    
    let user = await User.findOne({ email });
    if (!user) {
      user = new User({
        name: name || 'Apple User',
        email,
        appleId,
        age: age || 25,
        gender: gender || 'other',
        phone: phone || ('apple_' + Date.now()),
        photos: [{ url: 'https://via.placeholder.com/150', isPrimary: true }],
        verificationStatus: 'verified',
        location: { type: 'Point', coordinates: [0, 0] }
      });
      await user.save();
      await createWelcomeNotification(user._id, user.name);
      await autoConnectAndSendRules(user); // 🤖 Auto-follow & send rules
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
        location: user.location,
        role: user.role,
        membershipTier: user.membershipTier,
        isVip: user.isVip
      }
    });
  } catch (error) {
    console.error('Apple auth error', error);
    return res.status(500).json({ message: error.message });
  }
});

module.exports = router;
