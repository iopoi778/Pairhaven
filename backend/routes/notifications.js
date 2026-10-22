const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Notification = require('../models/Notification');

// GET /api/notifications
router.get('/', auth, async (req, res) => {
  try {
    const notifs = await Notification.find({ recipient: req.user.userId })
      .sort({ createdAt: -1 })
      .limit(100)
      .populate('sender', 'name photos verificationStatus');
      
    res.json(notifs);
  } catch (error) { 
    console.error('Error fetching notifications:', error);
    res.status(500).json({ message: error.message }); 
  }
});

// POST /api/notifications
router.post('/', auth, async (req, res) => {
  try {
    const { recipient, type, message } = req.body;

    // Ensure we have a valid recipient and message
    const targetRecipient = recipient && recipient.trim() !== '' ? recipient : req.user.userId;
    const notificationMessage = message || 'You have a new update';

    const notification = await Notification.create({
      recipient: targetRecipient,
      sender: req.user.userId,
      type: type || 'system',
      message: notificationMessage,
      read: false
    });

    res.status(201).json(notification);
  } catch (error) {
    // 🔍 This will print the exact Mongoose schema validation error to your Render logs
    console.error('❌ Detailed Error creating notification:', error.errors || error);
    res.status(500).json({ message: error.message });
  }
});

// PUT /api/notifications/:id/read
router.put('/:id/read', auth, async (req, res) => {
  try {
    const note = await Notification.findOneAndUpdate(
      { _id: req.params.id, recipient: req.user.userId },
      { read: true },
      { new: true }
    );
    res.json(note || { message: 'Not found' });
  } catch (error) { 
    res.status(500).json({ message: error.message }); 
  }
});

// POST /api/notifications/call/notify (Incoming call alert)
router.post('/call/notify', auth, async (req, res) => {
  try {
    const { targetUserId, callType, channelName } = req.body;

    const notification = await Notification.create({
      recipient: targetUserId,
      sender: req.user.userId,
      type: 'incoming_call',
      message: `Incoming ${callType} call...`,
      metadata: { channelName, callType }
    });

    res.json({ success: true, notification });
  } catch (error) {
    console.error('Error creating call notification:', error);
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
