const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Post = require('../models/Post');
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

// POTENTIAL MATCHES
router.get('/potential-matches', auth, async (req, res) => {
  try {
    const currentUser = await User.findById(req.user.userId);
    if (!currentUser) return res.status(404).json({ message: 'User not found' });
    const users = await User.find({ _id: { $ne: req.user.userId } }).select('name photos age location bio');
    
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
    await current.save(); await requester.save();
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

// DELETE POST - FIX 404 ERROR
router.delete('/posts/:postId', auth, async (req, res) => {
  try {
    const post = await Post.findById(req.params.postId);
    if (!post) return res.status(404).json({ message: 'Post not found' });
    
    // Verify ownership
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

// ⚠️ TEMPORARY CLEANUP - DELETE AFTER USE
router.get('/cleanup-empty-posts', auth, async (req, res) => {
  try {
    const result = await Post.deleteMany({
      author: req.user.userId,
      $and: [
        { $or: [{ text: { $exists: false } }, { text: '' }, { text: null }] },
        { $or: [{ mediaUrl: { $exists: false } }, { mediaUrl: null }, { mediaUrl: '' }] }
      ]
    });
    res.json({ deleted: result.deletedCount, message: 'Empty posts removed' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
