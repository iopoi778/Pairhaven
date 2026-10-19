const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Notification = require('../models/Notification');

// ✅ NEW: Create notification (called from posts.js react handler)
router.post('/', auth, async (req, res) => {
  try {
    const { recipient, sender, type, message, post } = req.body;

    if (!recipient || !sender || !type || !message) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    const notification = await Notification.create({
      recipient,
      sender,
      type,
      message,
      post: post || undefined
    });

    // Populate sender for immediate response
    const populated = await Notification.findById(notification._id)
      .populate('sender', 'name photos');

    res.status(201).json(populated);
  } catch (error) {
    console.error('Create notification error:', error);
    res.status(500).json({ message: error.message });
  }
});

// GET all notifications for current user
router.get('/', auth, async (req, res) => {
  try {
    const notifications = await Notification.find({ recipient: req.user.userId })
      .sort({ createdAt: -1 })
      .limit(100)
      .populate('sender', 'name photos')
      .populate('post', '_id'); // ✅ Added: Link back to post

    return res.json(notifications);
  } catch (error) {
    console.error('notifications list error', error);
    return res.status(500).json({ message: error.message });
  }
});

// Mark single notification as read
router.put('/:id/read', auth, async (req, res) => {
  try {
    const note = await Notification.findOneAndUpdate(
      { _id: req.params.id, recipient: req.user.userId },
      { read: true },
      { new: true }
    );

    if (!note) {
      return res.status(404).json({ message: 'Not found' });
    }

    return res.json(note);
  } catch (error) {
    console.error('notifications mark read error', error);
    return res.status(500).json({ message: error.message });
  }
});

// Mark ALL notifications as read
router.put('/read-all', auth, async (req, res) => {
  try {
    await Notification.updateMany(
      { recipient: req.user.userId, read: false },
      { read: true }
    );
    return res.json({ message: 'All notifications marked as read' });
  } catch (error) {
    console.error('notifications read-all error', error);
    return res.status(500).json({ message: error.message });
  }
});

// Get unread count (used by nav badge)
router.get('/unread-count', auth, async (req, res) => {
  try {
    const count = await Notification.countDocuments({
      recipient: req.user.userId,
      read: false
    });
    return res.json({ count });
  } catch (error) {
    console.error('notifications unread-count error', error);
    return res.status(500).json({ message: error.message });
  }
});

module.exports = router;
