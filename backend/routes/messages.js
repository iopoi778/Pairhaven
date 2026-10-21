const express = require('express');
const router = express.Router();
const Message = require('../models/Message');
const User = require('../models/User');
const auth = require('../middleware/auth');

// SEND MESSAGE (between matched users OR directly with Admin Support)
router.post('/send', auth, async (req, res) => {
  try {
    const { receiverId, content } = req.body;

    if (!receiverId || !content?.trim()) {
      return res.status(400).json({ message: 'Receiver ID and content are required' });
    }

    const currentUser = await User.findById(req.user.userId);
    const receiverUser = await User.findById(receiverId);

    if (!receiverUser) {
      return res.status(404).json({ message: 'Receiver not found' });
    }

    // 🛡️ Check if either sender or receiver is an Admin / Support account
    const adminEmail = process.env.ADMIN_EMAIL || 'admin@pairhaven.com';
    const isReceiverAdmin = receiverUser.role === 'admin' || receiverUser.email === adminEmail;
    const isSenderAdmin = currentUser.role === 'admin' || currentUser.email === adminEmail;

    // 🔒 If neither user is Admin, enforce the match check
    if (!isReceiverAdmin && !isSenderAdmin) {
      const isMatched = currentUser.matches.some(id => id.toString() === receiverId.toString());
      if (!isMatched) {
        return res.status(403).json({ message: 'Can only message matched users' });
      }
    }

    // 💬 Create and save message
    const message = new Message({
      sender: req.user.userId,
      receiver: receiverId,
      content: content.trim()
    });

    await message.save();

    // Auto-add admin to user's matches if not present for clean UI sync
    if (isReceiverAdmin && !currentUser.matches.some(id => id.toString() === receiverId.toString())) {
      currentUser.matches.push(receiverId);
      await currentUser.save();
    }

    const populatedMessage = await Message.findById(message._id)
      .populate('sender', 'name photos verificationStatus role email');

    // 🔔 Emit socket event for instant real-time delivery
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
