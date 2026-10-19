const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Post = require('../models/Post');
const Notification = require('../models/Notification');
const auth = require('../middleware/auth');

// GET USER PROFILE - 100% SAFE ARRAY ACCESS
router.get('/profile/:id', auth, async (req, res) => {
  try {
    const targetId = req.params.id === 'me' ? req.user.userId : req.params.id;
    const user = await User.findById(targetId).select('-password');

    if (!user) return res.status(404).json({ message: 'User not found' });

    // ✅ CRITICAL FIX: Initialize ALL arrays to prevent crashes
    const matches = user.matches || [];
    const requestsSent = user.requestsSent || [];
    const requestsReceived = user.requestsReceived || [];
    
    res.json({
      _id: user._id,
      name: user.name,
      photos: user.photos,
      location: user.location,
      age: user.age,
      bio: user.bio,
      isPrivate: user.isPrivate || false,
      matchesCount: matches.length,
      requestsSent,      // Always an array now
      requestsReceived,  // Always an array now
      followersCount: 0,
      followingCount: 0,
      isOwnProfile: targetId.toString() === req.user.userId.toString()
    });
  } catch (error) {
    console.error('Profile error:', error);
    res.status(500).json({ message: error.message });
  }
});

// POTENTIAL MATCHES - SAFE ENRICHMENT
router.get('/potential-matches', auth, async (req, res) => {
  try {
    const currentUser = await User.findById(req.user.userId);
    if (!currentUser) return res.status(404).json({ message: 'User not found' });

    const users = await User.find({ _id: { $ne: req.user.userId } })
      .select('name photos age location bio');

    // ✅ SAFE CHECKS: Use initialized arrays from above pattern
    const myMatches = currentUser.matches || [];
    const mySent = currentUser.requestsSent || [];
    const myReceived = currentUser.requestsReceived || [];

    const enrichedUsers = users.map(user => {
      const u = user.toObject();
      u.isMatched = myMatches.includes(user._id);
      u.hasSentRequest = mySent.includes(user._id);
      u.hasReceivedRequest = myReceived.includes(user._id);
      return u;
    });

    res.json(enrichedUsers);
  } catch (error) {
    console.error("Potential matches error:", error);
    res.status(500).json({ message: error.message });
  }
});

// PATCH PROFILE
router.patch('/profile/me', auth, async (req, res) => {
  try {
    const { bio, isPrivate } = req.body;
    const updateData = {};
    if (bio !== undefined) updateData.bio = bio;
    if (isPrivate !== undefined) updateData.isPrivate = isPrivate;

    const user = await User.findByIdAndUpdate(req.user.userId, updateData, { new: true }).select('-password');
    if (!user) return res.status(404).json({ message: 'User not found' });

    res.json({ message: 'Updated', bio: user.bio, isPrivate: user.isPrivate });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// GET POSTS
router.get('/profile/:userId/posts', auth, async (req, res) => {
  try {
    const targetUser = await User.findById(req.params.userId);
    if (!targetUser) return res.status(404).json({ message: 'User not found' });

    const isMatched = (targetUser.matches || []).some(m => m.toString() === req.user.userId);
    if (targetUser.isPrivate && !isMatched) return res.json([]);

    const posts = await Post.find({ author: req.params.userId })
      .sort({ createdAt: -1 })
      .populate('author', 'name photos');
    res.json(posts);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// DELETE POST
router.delete('/posts/:postId', auth, async (req, res) => {
  try {
    const post = await Post.findById(req.params.postId);
    if (!post) return res.status(404).json({ message: 'Not found' });
    if (post.author.toString() !== req.user.userId) return res.status(403).json({ message: 'Unauthorized' });

    await Post.findByIdAndDelete(req.params.postId);
    res.json({ message: 'Deleted' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ✅ SEND REQUEST - NEVER CRASHES
router.post('/request/:userId', auth, async (req, res) => {
  try {
    const targetUser = await User.findById(req.params.userId);
    const currentUser = await User.findById(req.user.userId);
    
    if (!targetUser || !currentUser) return res.status(404).json({ message: 'User not found' });
    
    // ✅ ALWAYS USE INITIALIZED ARRAYS
    const myMatches = currentUser.matches || [];
    const mySent = currentUser.requestsSent || [];
    const targetReceived = targetUser.requestsReceived || [];

    if (myMatches.includes(req.params.userId)) return res.status(400).json({ message: 'Already matched' });
    if (mySent.includes(req.params.userId)) return res.status(400).json({ message: 'Request already sent' });

    // ✅ SAFE UPDATE
    currentUser.requestsSent = [...mySent, req.params.userId];
    targetUser.requestsReceived = [...targetReceived, req.user.userId];
    
    await currentUser.save();
    await targetUser.save();

    // ✅ SAFE NOTIFICATION CREATION
    try {
      await Notification.create({
        recipient: req.params.userId,
        sender: req.user.userId,
        type: 'match_request',
        message: `${currentUser.name} wants to match with you`
      });
    } catch (notifErr) {
      console.error("Notification creation failed (non-fatal):", notifErr);
    }

    res.json({ message: 'Request sent' });
  } catch (error) {
    console.error('Request error:', error);
    res.status(500).json({ message: error.message });
  }
});

// ACCEPT REQUEST
router.post('/accept-request/:userId', auth, async (req, res) => {
  try {
    const requester = await User.findById(req.params.userId);
    const currentUser = await User.findById(req.user.userId);
    
    if (!requester || !currentUser) return res.status(404).json({ message: 'User not found' });

    // ✅ SAFE FILTERING
    currentUser.requestsReceived = (currentUser.requestsReceived || []).filter(id => id.toString() !== req.params.userId);
    requester.requestsSent = (requester.requestsSent || []).filter(id => id.toString() !== req.user.userId);

    currentUser.matches = [...(currentUser.matches || []), req.params.userId];
    requester.matches = [...(requester.matches || []), req.user.userId];
    
    await currentUser.save();
    await requester.save();

    try {
      await Notification.create({
        recipient: req.params.userId,
        sender: req.user.userId,
        type: 'match_accepted',
        message: `You matched with ${currentUser.name}!`
      });
    } catch (notifErr) {
      console.error("Match notification failed:", notifErr);
    }

    res.json({ message: 'Match accepted' });
  } catch (error) {
    console.error('Accept error:', error);
    res.status(500).json({ message: error.message });
  }
});

// DECLINE REQUEST
router.delete('/request/:userId', auth, async (req, res) => {
  try {
    const currentUser = await User.findById(req.user.userId);
    const targetUser = await User.findById(req.params.userId);

    currentUser.requestsSent = (currentUser.requestsSent || []).filter(id => id.toString() !== req.params.userId);
    currentUser.requestsReceived = (currentUser.requestsReceived || []).filter(id => id.toString() !== req.params.userId);
    
    if (targetUser) {
      targetUser.requestsReceived = (targetUser.requestsReceived || []).filter(id => id.toString() !== req.user.userId);
      targetUser.requestsSent = (targetUser.requestsSent || []).filter(id => id.toString() !== req.user.userId);
      await targetUser.save();
    }

    await currentUser.save();
    res.json({ message: 'Request removed' });
  } catch (error) {
    console.error('Decline error:', error);
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
