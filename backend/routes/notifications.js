const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Notification = require('../models/Notification');

// ✅ CREATE NOTIFICATION (Missing from your previous code)
router.post('/', auth, async (req, res) => {
  try {
    const { recipient, sender, type, message, post } = req.body;
    if (!recipient || !sender || !type || !message) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    const notification = await Notification.create({
      recipient, sender, type, message, post: post || undefined
    });

    const populated = await Notification.findById(notification._id).populate('sender', 'name photos');
    res.status(201).json(populated);
  } catch (error) {
    console.error('Create notification error:', error);
    res.status(500).json({ message: error.message });
  }
});

// ✅ GET NOTIFICATIONS (Safe handling)
router.get('/', auth, async (req, res) => {
  try {
    const notifications = await Notification.find({ recipient: req.user.userId })
      .sort({ createdAt: -1 })
      .limit(100)
      .populate('sender', 'name photos')
      .populate('post', '_id');

    res.json(notifications);
  } catch (error) {
    console.error('Get notifications error:', error);
    res.status(500).json({ message: error.message });
  }
});

// MARK AS READ
router.put('/:id/read', auth, async (req, res) => {
  try {
    const note = await Notification.findOneAndUpdate(
      { _id: req.params.id, recipient: req.user.userId },
      { read: true },
      { new: true }
    );
    if (!note) return res.status(404).json({ message: 'Not found' });
    res.json(note);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// MARK ALL AS READ
router.put('/read-all', auth, async (req, res) => {
  try {
    await Notification.updateMany(
      { recipient: req.user.userId, read: false },
      { read: true }
    );
    res.json({ message: 'All marked as read' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// UNREAD COUNT
router.get('/unread-count', auth, async (req, res) => {
  try {
    const count = await Notification.countDocuments({
      recipient: req.user.userId,
      read: false
    });
    res.json({ count });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
