const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Notification = require('../models/Notification');

router.get('/', auth, async (req, res) => {
  try {
    const notifications = await Notification.find({ recipient: req.user.userId })
      .sort({ createdAt: -1 })
      .limit(100)
      .populate('sender', 'name photos');

    return res.json(notifications);
  } catch (error) {
    console.error('notifications list error', error);
    return res.status(500).json({ message: error.message });
  }
});

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
