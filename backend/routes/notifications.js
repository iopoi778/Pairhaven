const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Notification = require('../models/Notification');

// GET /api/notifications
router.get('/', auth, async (req, res) => {
  try {
    const notes = await Notification.find({ recipient: req.user.userId })
      .sort({ createdAt: -1 })
      .limit(100)
      .populate('sender', 'name photos');
    res.json(notes);
  } catch (err) {
    console.error('notifications list error', err);
    res.status(500).json({ message: err.message });
  }
});

// PUT /api/notifications/:id/read
router.put('/:id/read', auth, async (req, res) => {
  try {
    const note = await Notification.findOneAndUpdate({ _id: req.params.id, recipient: req.user.userId }, { read: true }, { new: true });
    if (!note) return res.status(404).json({ message: 'Not found' });
    res.json(note);
  } catch (err) {
    console.error('notifications mark read error', err);
    res.status(500).json({ message: err.message });
  }
});

// PUT /api/notifications/read-all
router.put('/read-all', auth, async (req, res) => {
  try {
    await Notification.updateMany({ recipient: req.user.userId, read: false }, { read: true });
    res.json({ message: 'All notifications marked as read' });
  } catch (err) {
    console.error('notifications read-all error', err);
    res.status(500).json({ message: err.message });
  }
});

// GET unread count
router.get('/unread-count', auth, async (req, res) => {
  try {
    const count = await Notification.countDocuments({ recipient: req.user.userId, read: false });
    res.json({ count });
  } catch (err) {
    console.error('notifications unread-count error', err);
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
