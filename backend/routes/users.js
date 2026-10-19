const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Post = require('../models/Post');
const auth = require('../middleware/auth');

// GET USER PROFILE - GUARANTEED ARRAY INITIALIZATION
router.get('/profile/:id', auth, async (req, res) => {
  try {
    const targetId = req.params.id === 'me' ? req.user.userId : req.params.id;
    const user = await User.findById(targetId).select('-password');

    if (!user) return res.status(404).json({ message: 'User not found' });

    // ✅ CRITICAL: Force initialize ALL arrays to prevent undefined
    const matches = Array.isArray(user.matches) ? user.matches : [];
    const requestsSent = Array.isArray(user.requestsSent) ? user.requestsSent : [];
    const requestsReceived = Array.isArray(user.requestsReceived) ? user.requestsReceived : [];

    res.json({
      _id: user._id,
      name: user.name,
      photos: user.photos,
      location: user.location,
      age: user.age,
      bio: user.bio,
      isPrivate: user.isPrivate || false,
      
      // ✅ ALWAYS ARRAYS, NEVER UNDEFINED
      matches,
      requestsSent,
      requestsReceived,
      matchesCount: matches.length,
      
      followersCount: 0,
      followingCount: 0,
      isOwnProfile: targetId.toString() === req.user.userId.toString()
    });
  } catch (error) {
    console.error('Profile error:', error);
    res.status(500).json({ message: error.message });
  }
});

// POTENTIAL MATCHES
router.get('/potential-matches', auth, async (req, res) => {
  try {
    const currentUser = await User.findById(req.user.userId);
    if (!currentUser) return res.status(404).json({ message: 'User not found' });

    const users = await User.find({ _id: { $ne: req.user.userId } }).select('name photos age location bio');
    const myMatches = currentUser.matches || [];
    const mySent = currentUser.requestsSent || [];
    const myReceived = currentUser.requestsReceived || [];

    const enriched = users.map(u => {
      const obj = u.toObject();
      obj.isMatched = myMatches.includes(u._id);
      obj.hasSentRequest = mySent.includes(u._id);
      obj.hasReceivedRequest = myReceived.includes(u._id);
      return obj;
    });
    res.json(enriched);
  } catch (error) { res.status(500).json({ message: error.message }); }
});

// SEND REQUEST - SAFE & NO NOTIFICATION CRASHES
router.post('/request/:userId', auth, async (req, res) => {
  try {
    const target = await User.findById(req.params.userId);
    const current = await User.findById(req.user.userId);
    if (!target || !current) return res.status(404).json({ message: 'User not found' });

    const myMatches = current.matches || [];
    const mySent = current.requestsSent || [];
    
    if (myMatches.includes(req.params.userId)) return res.status(400).json({ message: 'Already matched' });
    if (mySent.includes(req.params.userId)) return res.status(400).json({ message: 'Request already sent' });

    current.requestsSent = [...mySent, req.params.userId];
    target.requestsReceived = [...(target.requestsReceived || []), req.user.userId];
    
    await current.save();
    await target.save();

    // ✅ SAFE NOTIFICATION: Won't crash route if model is missing
    try {
      const Notification = require('../models/Notification');
      await Notification.create({
        recipient: req.params.userId, sender: req.user.userId,
        type: 'match_request', message: `${current.name} wants to match with you`
      });
    } catch (e) { console.error("Notification failed (non-fatal):", e.message); }

    res.json({ message: 'Request sent' });
  } catch (error) { res.status(500).json({ message: error.message }); }
});

// ACCEPT REQUEST
router.post('/accept-request/:userId', auth, async (req, res) => {
  try {
    const requester = await User.findById(req.params.userId);
    const current = await User.findById(req.user.userId);
    if (!requester || !current) return res.status(404).json({ message: 'User not found' });

    current.requestsReceived = (current.requestsReceived || []).filter(id => id.toString() !== req.params.userId);
    requester.requestsSent = (requester.requestsSent || []).filter(id => id.toString() !== req.user.userId);
    
    current.matches = [...(current.matches || []), req.params.userId];
    requester.matches = [...(requester.matches || []), req.user.userId];
    
    await current.save();
    await requester.save();

    try {
      const Notification = require('../models/Notification');
      await Notification.create({
        recipient: req.params.userId, sender: req.user.userId,
        type: 'match_accepted', message: `You matched with ${current.name}!`
      });
    } catch (e) { console.error("Match notification failed:", e.message); }

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

// PATCH PROFILE
router.patch('/profile/me', auth, async (req, res) => {
  try {
    const { bio, isPrivate } = req.body;
    const user = await User.findByIdAndUpdate(req.user.userId, { bio, isPrivate }, { new: true }).select('-password');
    res.json(user);
  } catch (error) { res.status(500).json({ message: error.message }); }
});

// ✅ FIXED: GET USER POSTS WITH VALIDATION
router.get('/profile/:userId/posts', auth, async (req, res) => {
  try {
    const targetUser = await User.findById(req.params.userId);
    if (!targetUser) return res.status(404).json({ message: 'User not found' });

    // Privacy check
    const isMatched = (targetUser.matches || []).some(m => m.toString() === req.user.userId);
    if (targetUser.isPrivate && !isMatched) {
      return res.json([]);
    }

    const posts = await Post.find({ author: req.params.userId })
      .sort({ createdAt: -1 })
      .populate('author', 'name photos')
      .lean(); // ✅ USE LEAN FOR BETTER PERFORMANCE

    // ✅ TRANSFORM TO GUARANTEE CONTENT FIELDS EXIST
    const safePosts = posts.map(post => ({
      ...post,
      text: post.text?.trim() || '',
      mediaUrl: post.mediaUrl || null,
      mediaType: post.mediaType || null
    }));

    res.json(safePosts);
  } catch (error) {
    console.error('Fetch user posts error:', error);
    res.status(500).json({ message: error.message });
  }
});

// ✅ FIXED: CREATE POST WITH VALIDATION
router.post('/', auth, async (req, res) => {
  try {
    const { text, mediaUrl, mediaType } = req.body;
    
    // ✅ VALIDATE: At least one of text or media must exist
    if (!text?.trim() && !mediaUrl) {
      return res.status(400).json({ message: 'Post must have text or media' });
    }

    const newPost = new Post({
      author: req.user.userId,
      text: text?.trim() || '',
      mediaUrl: mediaUrl || null,
      mediaType: mediaType || null,
      likes: [],
      loves: []
    });
    
    await newPost.save();
    
    // ✅ RETURN FULL POST WITH POPULATED AUTHOR
    const populated = await Post.findById(newPost._id)
      .populate('author', 'name photos')
      .lean();
      
    res.status(201).json(populated);
  } catch (error) {
    console.error('Create post error:', error);
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
  } catch (error) { res.status(500).json({ message: error.message }); }
});

module.exports = router;
