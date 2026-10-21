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

// GET ALL CONVERSATIONS (for Messages tab) - OPTIMIZED WITH PERMANENT ADMIN PIN
router.get('/conversations', auth, async (req, res) => {
  try {
    const currentUser = await User.findById(req.user.userId)
      .populate('matches', 'name photos age lastSeen verificationStatus role email');

    const matches = currentUser.matches || [];
    const conversations = [];

    // 1. Fetch conversations for matched users
    for (const match of matches) {
      const lastMessage = await Message.findOne({
        $or: [
          { sender: req.user.userId, receiver: match._id },
          { sender: match._id, receiver: req.user.userId }
        ]
      }).sort({ createdAt: -1 }).lean();

      const unreadCount = await Message.countDocuments({
        sender: match._id,
        receiver: req.user.userId,
        read: false
      });

      conversations.push({
        user: match,
        lastMessage: lastMessage || null,
        unreadCount: unreadCount || 0
      });
    }

    // 2. Sort existing conversations by last activity
    conversations.sort((a, b) => {
      const dateA = a.lastMessage?.createdAt || new Date(0);
      const dateB = b.lastMessage?.createdAt || new Date(0);
      return new Date(dateB) - new Date(dateA);
    });

    // 3. 🛡️ ALWAYS ensure Admin/PairHaven Support is included at the top for ALL users
    const adminEmail = process.env.ADMIN_EMAIL || 'admin@pairhaven.com';
    const adminUser = await User.findOne({ 
      $or: [{ role: 'admin' }, { email: adminEmail }] 
    }).select('name photos age lastSeen verificationStatus role email');

    if (adminUser && adminUser._id.toString() !== req.user.userId.toString()) {
      const hasAdminInConvs = conversations.some(c => c.user._id.toString() === adminUser._id.toString());

      if (!hasAdminInConvs) {
        const lastAdminMsg = await Message.findOne({
          $or: [
            { sender: req.user.userId, receiver: adminUser._id },
            { sender: adminUser._id, receiver: req.user.userId }
          ]
        }).sort({ createdAt: -1 }).lean();

        const adminUnread = await Message.countDocuments({
          sender: adminUser._id,
          receiver: req.user.userId,
          read: false
        });

        // Pin Admin Support at the top
        conversations.unshift({
          user: adminUser,
          lastMessage: lastAdminMsg || { content: 'Need help? Chat with Support!' },
          unreadCount: adminUnread || 0
        });
      }
    }

    res.json(conversations);
  } catch (error) {
    console.error('Get conversations error:', error);
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
