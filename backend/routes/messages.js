const express = require('express');
const router = express.Router();
const Message = require('../models/Message');
const User = require('../models/User');
const auth = require('../middleware/auth');

// SEND MESSAGE (only between matched users)
router.post('/send', auth, async (req, res) => {
  try {
    const { receiverId, content } = req.body;

    if (!receiverId || !content?.trim()) {
      return res.status(400).json({ message: 'Receiver ID and content are required' });
    }

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
      content: content.trim()
    });

    await message.save();

    // Populate sender info for immediate UI update (including verificationStatus)
    const populatedMessage = await Message.findById(message._id)
      .populate('sender', 'name photos verificationStatus');

    // ✅ Emit socket event to trigger real-time pop-up notification on recipient's screen
    const io = req.app.get('io');
    if (io) {
      io.to(receiverId.toString()).emit('receive-message', populatedMessage);
    }

    res.status(201).json(populatedMessage);
  } catch (error) {
    console.error('Send message error:', error);
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
    .populate('sender', 'name photos verificationStatus') // ✅ Includes verificationStatus
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

// GET ALL CONVERSATIONS (for Messages tab) - OPTIMIZED
router.get('/conversations', auth, async (req, res) => {
  try {
    const currentUser = await User.findById(req.user.userId)
      .populate('matches', 'name photos age lastSeen verificationStatus'); // ✅ Includes verificationStatus

    // Handle case where user has no matches yet
    const matches = currentUser.matches || [];
    
    if (matches.length === 0) {
      return res.json([]);
    }

    const conversations = [];

    for (const match of matches) {
      // Get last message safely
      const lastMessage = await Message.findOne({
        $or: [
          { sender: req.user.userId, receiver: match._id },
          { sender: match._id, receiver: req.user.userId }
        ]
      }).sort({ createdAt: -1 }).lean(); // .lean() improves performance

      // Count unread messages FROM this match TO current user
      const unreadCount = await Message.countDocuments({
        sender: match._id,
        receiver: req.user.userId,
        read: false
      });

      conversations.push({
        user: match,
        lastMessage: lastMessage || null, // Ensure null not undefined
        unreadCount: unreadCount || 0     // Ensure 0 not undefined
      });
    }

    // Sort by most recent activity (messages without timestamps go to bottom)
    conversations.sort((a, b) => {
      const dateA = a.lastMessage?.createdAt || new Date(0);
      const dateB = b.lastMessage?.createdAt || new Date(0);
      return new Date(dateB) - new Date(dateA);
    });

    res.json(conversations);
  } catch (error) {
    console.error('Get conversations error:', error);
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
