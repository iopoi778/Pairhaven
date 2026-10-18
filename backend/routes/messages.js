const express = require('express');
const router = express.Router();
const Message = require('../models/Message');
const User = require('../models/User');
const auth = require('../middleware/auth');

// SEND MESSAGE (only between matched users)
router.post('/send', auth, async (req, res) => {
  try {
    const { receiverId, content } = req.body;

    // Check if users are matched
    const currentUser = await User.findById(req.user.userId);
    
    if (!currentUser.matches.includes(receiverId)) {
      return res.status(403).json({ 
        message: 'Can only message matched users' 
      });
    }

    const message = new Message({
      sender: req.user.userId,
      receiver: receiverId,
      content
    });

    await message.save();

    // Populate sender info
    const populatedMessage = await Message.findById(message._id)
      .populate('sender', 'name photos');

    res.status(201).json(populatedMessage);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// GET CONVERSATION WITH USER
router.get('/conversation/:userId', auth, async (req, res) => {
  try {
    const messages = await Message.find({
      $or: [
        { sender: req.user.userId, receiver: req.params.userId },
        { sender: req.params.userId, receiver: req.user.userId }
      ]
    })
    .populate('sender', 'name photos')
    .sort({ createdAt: 1 });

    // Mark messages as read
    await Message.updateMany(
      { 
        sender: req.params.userId, 
        receiver: req.user.userId,
        read: false 
      },
      { read: true }
    );

    res.json(messages);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// GET ALL CONVERSATIONS (for Messages tab)
router.get('/conversations', auth, async (req, res) => {
  try {
    const currentUser = await User.findById(req.user.userId)
      .populate('matches', 'name photos lastSeen');

    const conversations = [];

    for (const match of currentUser.matches) {
      const lastMessage = await Message.findOne({
        $or: [
          { sender: req.user.userId, receiver: match._id },
          { sender: match._id, receiver: req.user.userId }
        ]
      }).sort({ createdAt: -1 });

      const unreadCount = await Message.countDocuments({
        sender: match._id,
        receiver: req.user.userId,
        read: false
      });

      conversations.push({
        user: match,
        lastMessage,
        unreadCount
      });
    }

    res.json(conversations);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;