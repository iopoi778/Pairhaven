const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Post = require('../models/Post');
const Notification = require('../models/Notification'); // ✅ Import Notification model
const auth = require('../middleware/auth');

// GET USER PROFILE
router.get('/profile/:id', auth, async (req, res) => {
  try {
    const targetId = req.params.id === 'me' ? req.user.userId : req.params.id;
    const user = await User.findById(targetId).select('-password');
    if (!user) return res.status(404).json({ message: 'User not found' });

    const matches = Array.isArray(user.matches) ? user.matches : [];
    const requestsSent = Array.isArray(user.requestsSent) ? user.requestsSent : [];
    const requestsReceived = Array.isArray(user.requestsReceived) ? user.requestsReceived : [];

    res.json({
      _id: user._id, name: user.name, photos: user.photos, location: user.location,
      age: user.age, bio: user.bio, isPrivate: user.isPrivate || false,
      matches, requestsSent, requestsReceived, matchesCount: matches.length,
      followersCount: 0, followingCount: 0,
      isOwnProfile: targetId.toString() === req.user.userId.toString()
    });
  } catch (error) { res.status(500).json({ message: error.message }); }
});

// POTENTIAL MATCHES (With query filters support: minAge, maxAge, location, maxDistance)
router.get('/potential-matches', auth, async (req, res) => {
  try {
    const currentUser = await User.findById(req.user.userId);
    if (!currentUser) return res.status(404).json({ message: 'User not found' });

    const { minAge, maxAge, location } = req.query;
    
    // Build filter query
    let query = { 
      _id: { 
        $ne: req.user.userId, 
        $nin: currentUser.blockedUsers || [] 
      } 
    };

    if (minAge || maxAge) {
      query.age = {};
      if (minAge) query.age.$gte = Number(minAge);
      if (maxAge) query.age.$lte = Number(maxAge);
    }

    if (location && location.trim() !== '') {
      // Matches location string or location object address field loosely
      query.$or = [
        { location: { $regex: location,$options: 'i' } },
        { 'location.address': { $regex: location,$options: 'i' } }
      ];
    }

    const users = await User.find(query).select('name photos age location bio');
    
    const enriched = users.map(u => {
      const obj = u.toObject();
      obj.isMatched = (currentUser.matches || []).includes(u._id);
      obj.hasSentRequest = (currentUser.requestsSent || []).includes(u._id);
      obj.hasReceivedRequest = (currentUser.requestsReceived || []).includes(u._id);
      return obj;
    });
    
    res.json(enriched);
  } catch (error) { res.status(500).json({ message: error.message }); }
});
router.post('/upgrade', auth, async (req, res) => {
  try {
    const { plan, paymentMethod, cardDetails } = req.body;
    
    if (!['pro', 'unlimited'].includes(plan)) {
      return res.status(400).json({ message: 'Invalid subscription plan selected.' });
    }

    const user = await User.findById(req.user.userId);
    if (!user) return res.status(404).json({ message: 'User not found' });

    if (paymentMethod === 'card') {
      // Basic card field validation
      if (!cardDetails || !cardDetails.number || !cardDetails.expiry || !cardDetails.cvc) {
        return res.status(400).json({ message: 'Please provide valid card details.' });
      }
      // Instant upgrade for card payment
      user.isVip = true;
      user.membershipTier = plan;
      await user.save();
      return res.status(200).json({ message: `Successfully upgraded to ${plan.toUpperCase()} plan!` });
    } else if (paymentMethod === 'bank') {
      // Mark as upgraded or pending transfer confirmation
      user.isVip = true;
      user.membershipTier = plan;
      await user.save();
      return res.status(200).json({ message: 'Bank transfer request registered. Upgrade applied!' });
    } else {
      return res.status(400).json({ message: 'Invalid payment method.' });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});
router.post('/request/:userId', auth, async (req, res) => {
  try {
    const current = await User.findById(req.user.userId);
    const target = await User.findById(req.params.userId);
    
    if (!target || !current) return res.status(404).json({ message: 'User not found' });

    // Check & Reset daily limit if 24 hours have passed
    const today = new Date().toDateString();
    const lastReset = new Date(current.lastMatchResetDate).toDateString();
    if (today !== lastReset) {
      current.matchesSentToday = 0;
      current.lastMatchResetDate = new Date();
    }

    // Limit check: Non-VIP users are capped at 20 matches per day
    const DAILY_LIMIT = 20;
    if (!current.isVip && current.matchesSentToday >= DAILY_LIMIT) {
      return res.status(403).json({ 
        message: 'Daily match limit reached (20/20). Upgrade to VIP for unlimited matches or watch an ad to get 3 free matches!' 
      });
    }

    if ((current.matches || []).includes(req.params.userId)) return res.status(400).json({ message: 'Already matched' });
    if ((current.requestsSent || []).includes(req.params.userId)) return res.status(400).json({ message: 'Request already sent' });

    // Increment count and save
    current.matchesSentToday += 1;
    current.requestsSent = [...(current.requestsSent || []), req.params.userId];
    target.requestsReceived = [...(target.requestsReceived || []), req.user.userId];
    
    await current.save(); 
    await target.save();
    
    res.json({ message: 'Request sent', matchesSentToday: current.matchesSentToday });
  } catch (error) { 
    res.status(500).json({ message: error.message }); 
  }
});
// SEND REQUEST
router.post('/request/:userId', auth, async (req, res) => {
  try {
    const target = await User.findById(req.params.userId);
    const current = await User.findById(req.user.userId);
    if (!target || !current) return res.status(404).json({ message: 'User not found' });
    if ((current.matches || []).includes(req.params.userId)) return res.status(400).json({ message: 'Already matched' });
    if ((current.requestsSent || []).includes(req.params.userId)) return res.status(400).json({ message: 'Request already sent' });

    current.requestsSent = [...(current.requestsSent || []), req.params.userId];
    target.requestsReceived = [...(target.requestsReceived || []), req.user.userId];
    await current.save(); await target.save();
    res.json({ message: 'Request sent' });
  } catch (error) { res.status(500).json({ message: error.message }); }
});
router.post('/reward-ad-matches', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    if (!user) return res.status(404).json({ message: 'User not found' });

    // Grant 3 extra matches by subtracting 3 from today's count (minimum 0)
    user.matchesSentToday = Math.max(0, user.matchesSentToday - 3);
    await user.save();

    res.json({ message: 'Added 3 free matches!', matchesSentToday: user.matchesSentToday });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});
// ✅ ACCEPT REQUEST - WITH NOTIFICATION
router.post('/accept-request/:userId', auth, async (req, res) => {
  try {
    const requester = await User.findById(req.params.userId);
    const current = await User.findById(req.user.userId);
    if (!requester || !current) return res.status(404).json({ message: 'User not found' });

    current.requestsReceived = (current.requestsReceived || []).filter(id => id.toString() !== req.params.userId);
    requester.requestsSent = (requester.requestsSent || []).filter(id => id.toString() !== req.user.userId);
    current.matches = [...(current.matches || []), req.params.userId];
    requester.matches = [...(requester.matches || []), req.user.userId];
    await current.save(); await requester.save();

    // ✅ CREATE MATCH ACCEPTANCE NOTIFICATION
    try {
      await Notification.create({
        recipient: req.params.userId,
        sender: req.user.userId,
        type: 'match_accepted',
        message: `${current.name} accepted your match request! You can now chat.`,
        read: false
      });
    } catch (notifErr) {
      console.error('Failed to create match notification:', notifErr);
    }

    res.json({ message: 'Match accepted' });
  } catch (error) { res.status(500).json({ message: error.message }); }
});

// DECLINE REQUEST
router.delete('/request/:userId', auth, async (req, res) => {
  try {
    const current = await User.findById(req.user.userId);
    const target = await User.findById(req.params.userId);
    current.requestsSent = (current.requestsSent || []).filter(id => id.toString() !== req.params.userId);
    current.requestsReceived = (current.requestsReceived || []).filter(id => id.toString() !== req.params.userId);
    if (target) {
      target.requestsReceived = (target.requestsReceived || []).filter(id => id.toString() !== req.user.userId);
      target.requestsSent = (target.requestsSent || []).filter(id => id.toString() !== req.user.userId);
      await target.save();
    }
    await current.save();
    res.json({ message: 'Request removed' });
  } catch (error) { res.status(500).json({ message: error.message }); }
});

// DELETE /api/users/match/:id (Fixed auth property lookup to req.user.userId)
router.delete('/match/:id', auth, async (req, res) => {
  try {
    const targetUserId = req.params.id;
    const currentUser = await User.findById(req.user.userId);
    const targetUser = await User.findById(targetUserId);

    if (!targetUser) {
      return res.status(404).json({ message: "User not found" });
    }

    currentUser.matches = (currentUser.matches || []).filter(id => id.toString() !== targetUserId);
    targetUser.matches = (targetUser.matches || []).filter(id => id.toString() !== currentUser._id.toString());

    await currentUser.save();
    await targetUser.save();

    res.status(200).json({ message: "Unmatched successfully" });
  } catch (err) {
    res.status(500).json({ message: "Server error unmatching", error: err.message });
  }
});

// POST /api/users/block/:id (Fixed auth property lookup to req.user.userId)
router.post('/block/:id', auth, async (req, res) => {
  try {
    const userIdToBlock = req.params.id;
    const currentUser = await User.findById(req.user.userId);

    if (!currentUser.blockedUsers) {
      currentUser.blockedUsers = [];
    }

    if (!currentUser.blockedUsers.includes(userIdToBlock)) {
      currentUser.blockedUsers.push(userIdToBlock);
      
      currentUser.matches = (currentUser.matches || []).filter(id => id.toString() !== userIdToBlock);
      currentUser.requestsSent = (currentUser.requestsSent || []).filter(id => id.toString() !== userIdToBlock);
      currentUser.requestsReceived = (currentUser.requestsReceived || []).filter(id => id.toString() !== userIdToBlock);
      
      await currentUser.save();
    }

    res.status(200).json({ message: "User blocked successfully" });
  } catch (err) {
    res.status(500).json({ message: "Server error blocking user", error: err.message });
  }
});

// PATCH PROFILE
router.patch('/profile/me', auth, async (req, res) => {
  try {
    const { bio, isPrivate } = req.body;
    const user = await User.findByIdAndUpdate(req.user.userId, { bio, isPrivate }, { new: true }).select('-password');
    res.json(user);
  } catch (error) { res.status(500).json({ message: error.message }); }
});

// GET USER POSTS
router.get('/profile/:userId/posts', auth, async (req, res) => {
  try {
    const targetUser = await User.findById(req.params.userId);
    if (!targetUser) return res.status(404).json({ message: 'User not found' });
    const isMatched = (targetUser.matches || []).some(m => m.toString() === req.user.userId);
    if (targetUser.isPrivate && !isMatched) return res.json([]);

    const posts = await Post.find({ author: req.params.userId })
      .sort({ createdAt: -1 })
      .populate('author', 'name photos')
      .lean();

    res.json(posts.map(post => ({
      ...post,
      text: typeof post.text === 'string' ? post.text.trim() : '',
      mediaUrl: post.mediaUrl || null,
      mediaType: post.mediaType || null
    })));
  } catch (error) { res.status(500).json({ message: error.message }); }
});

// ✅ STRICT POST CREATION (Prevents empty posts)
router.post('/', auth, async (req, res) => {
  try {
    const { text, mediaUrl, mediaType } = req.body;
    const hasText = text && typeof text === 'string' && text.trim().length > 0;
    const hasMedia = mediaUrl && typeof mediaUrl === 'string' && mediaUrl.trim().length > 0;
    
    if (!hasText && !hasMedia) {
      return res.status(400).json({ message: 'Post must contain text or media.' });
    }

    const newPost = new Post({
      author: req.user.userId,
      text: hasText ? text.trim() : '',
      mediaUrl: hasMedia ? mediaUrl.trim() : null,
      mediaType: hasMedia ? (mediaType || 'image') : null,
      likes: [], loves: []
    });
    await newPost.save();
    
    const populated = await Post.findById(newPost._id).populate('author', 'name photos').lean();
    res.status(201).json(populated);
  } catch (error) { res.status(500).json({ message: error.message }); }
});
// DELETE CURRENT USER PROFILE
router.delete('/profile/me', auth, async (req, res) => {
  try {
    const userId = req.user.userId;
    
    // Delete user posts and the user document
    await Post.deleteMany({ author: userId });
    await User.findByIdAndDelete(userId);

    res.status(200).json({ message: 'Account deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});
// DELETE POST - FIX 404 ERROR
router.delete('/posts/:postId', auth, async (req, res) => {
  try {
    const post = await Post.findById(req.params.postId);
    if (!post) return res.status(404).json({ message: 'Post not found' });
    
    if (post.author.toString() !== req.user.userId) {
      return res.status(403).json({ message: 'Unauthorized' });
    }
    
    await Post.findByIdAndDelete(req.params.postId);
    res.json({ message: 'Deleted successfully' });
  } catch (error) {
    console.error('Delete error:', error);
    res.status(500).json({ message: error.message });
  }
});
// DELETE CURRENT USER PROFILE & CLEAN UP REFERENCES
router.delete('/profile/me', auth, async (req, res) => {
  try {
    const userId = req.user.userId;
    
    // 1. Delete user posts and notifications
    await Post.deleteMany({ author: userId });
    await Notification.deleteMany({ $or: [{ recipient: userId }, { sender: userId }] });

    // 2. Remove this user from everyone else's matches, requests, and blocks
    await User.updateMany(
      {},
      { 
        $pull: { 
          matches: userId, 
          requestsSent: userId, 
          requestsReceived: userId, 
          blockedUsers: userId 
        } 
      }
    );
    
    // 3. Finally, delete the user document itself
    await User.findByIdAndDelete(userId);

    res.status(200).json({ message: 'Account and references deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});
// ⚠️ TEMPORARY CLEANUP - DELETE AFTER USE
router.get('/cleanup-empty-posts', auth, async (req, res) => {
  try {
    const result = await Post.deleteMany({
      author: req.user.userId,
      $and: [
        { $or: [{ text: {$exists: false } }, { text: '' }, { text: null }] },
        { $or: [{ mediaUrl: {$exists: false } }, { mediaUrl: null }, { mediaUrl: '' }] }
      ]
    });
    res.json({ deleted: result.deletedCount, message: 'Empty posts removed' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
