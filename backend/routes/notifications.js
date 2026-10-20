const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Notification = require('../models/Notification');

router.get('/', auth, async (req, res) => {
  try {
    const notifs = await Notification.find({ recipient: req.user.userId })
      .sort({ createdAt: -1 }).limit(100)
      .populate('sender', 'name photos');
    res.json(notifs);
  } catch (error) { res.status(500).json({ message: error.message }); }
});

router.put('/:id/read', auth, async (req, res) => {
  try {
    const note = await Notification.findOneAndUpdate(
      { _id: req.params.id, recipient: req.user.userId },
      { read: true }, { new: true }
    );
    res.json(note || { message: 'Not found' });
  } catch (error) { res.status(500).json({ message: error.message }); }
});
// Backend endpoint to trigger incoming call alert
router.post('/call/notify', auth, async (req, res) => {
  const { targetUserId, callType, channelName } = req.body;

  await Notification.create({
    recipient: targetUserId,
    sender: req.user.userId,
    type: 'incoming_call',
    message: `Incoming ${callType} call...`,
    metadata: { channelName, callType }
  });

  res.json({ success: true });
});

module.exports = router;
