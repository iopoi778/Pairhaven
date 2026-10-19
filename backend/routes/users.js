const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Post = require('../models/Post');
const Notification = require('../models/Notification');
const auth = require('../middleware/auth');

// GET USER PROFILE - Safe handling of new match request fields
router.get('/profile/:id', auth, async (req, res) => {
  try {
    const targetId = req.params.id === 'me' ? req.user.userId : req.params.id;
    const user = await User.findById(targetId).select('-password');

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // ✅ SAFE ARRAY HANDLING: Prevents 500 errors if arrays don't exist yet
    const matches = user.matches || [];
    const requestsSent = user.requestsSent || [];
    const requestsReceived = user.requestsReceived || [];
    
    const isOwnProfile = targetId.toString() === req.user.userId.toString();

    res.json({
      _id: user._id,
      name: user.name,
      phone: user.phone,
      email: user.email,
      photos: user.photos,
      location: user.location,
      age: user.age,
      gender: user.gender,
      bio: user.bio,
      interests: user.interests,
      verificationStatus: user.verificationStatus,
      isPrivate: user.isPrivate || false,
      
      // ✅ NEW MATCH REQUEST FIELDS
      matchesCount: matches.length,
      requestsSent,
      requestsReceived,
      
      // Legacy counts kept for backward compatibility but set to 0
      followersCount: 0,
      followingCount: 0,
      likesReceivedCount: 0,
      
      isOwnProfile,
      isFollowing: false // Removed follow logic
    });
  } catch (error) {
    console.error('Profile fetch error:', error);
    res.status(500).json({ message: error.message });
  }
});

// ✅ NEW: POTENTIAL MATCHES FOR MATCH TAB
router.get('/potential-matches', auth, async (req, res) => {
  try {
    const currentUser = await User.findById(req.user.userId);
    if (!currentUser) return res.status(404).json({ message: 'User not found' });

    // Get all users except yourself
    const users = await User.find({ _id: { $ne: req.user.userId } })
      .select('name photos age location bio');

    // Enrich with relationship status using safe optional chaining
    const enrichedUsers = users.map(user => {
      const userObj = user.toObject();
      
      userObj.isMatched = (currentUser.matches || []).includes(user._id);
      userObj.hasSentRequest = (currentUser.requestsSent || []).includes(user._id);
      userObj.hasReceivedRequest = (currentUser.requestsReceived || []).includes(user._id);
      
      return userObj;
    });

    res.json(enrichedUsers);
  } catch (error) {
    console.error("Potential matches error:", error);
    res.status(500).json({ message: error.message });
  }
});

// PATCH UPDATE PROFILE (Bio, Privacy)
router.patch('/profile/me', auth, async (req, res) => {
  try {
    const { bio, isPrivate } = req.body;
    const updateData = {};
    
    if (bio !== undefined) updateData.bio = bio;
    if (isPrivate !== undefined) updateData.isPrivate = isPrivate;

    const user = await User.findByIdAndUpdate(req.user.userId, updateData, { new: true })
      .select('-password');

    if (!user) return res.status(404).json({ message: 'User not found' });

    res.json({ 
      message: 'Profile updated successfully',
      bio: user.bio,
      isPrivate: user.isPrivate
    });
  } catch (error) {
    console.error('Profile update error:', error);
    res.status(500).json({ message: error.message });
  }
});

// GET USER POSTS (Respects Privacy)
router.get('/profile/:userId/posts', auth, async (req, res) => {
  try {
    const targetUser = await User.findById(req.params.userId);
    if (!targetUser) return res.status(404).json({ message: 'User not found' });

    // If private and viewer is NOT a follower/match, return empty array
    const isMatched = (targetUser.matches || []).some(m => m.toString() === req.user.userId);
    if (targetUser.isPrivate && !isMatched) {
      return res.json([]);
    }

    const posts = await Post.find({ author: req.params.userId })
      .sort({ createdAt: -1 })
      .populate('author', 'name photos');

    res.json(posts);
  } catch (error) {
    console.error('Fetch user posts error:', error);
    res.status(500).json({ message: error.message });
  }
});

// DELETE POST
router.delete('/posts/:postId', auth, async (req, res) => {
  try {
    const post = await Post.findById(req.params.postId);
    if (!post) return res.status(404).json({ message: 'Post not found' });
    
    if (post.author.toString() !== req.user.userId) {
      return res.status(403).json({ message: 'Not authorized to delete this post' });
    }

    await Post.findByIdAndDelete(req.params.postId);
    res.json({ message: 'Post deleted successfully' });
  } catch (error) {
    console.error('Delete post error:', error);
    res.status(500).json({ message: error.message });
  }
});

// SEND MATCH REQUEST
router.post('/request/:userId', auth, async (req, res) => {
  try {
    const targetUser = await User.findById(req.params.userId);
    const currentUser = await User.findById(req.user.userId);
    
    if (!targetUser || !currentUser) return res.status(404).json({ message: 'User not found' });
    
    // Check if already matched or requested
    if ((currentUser.matches || []).includes(req.params.userId)) {
      return res.status(400).json({ message: 'Already matched' });
    }
    if ((currentUser.requestsSent || []).includes(req.params.userId)) {
      return res.status(400).json({ message: 'Request already sent' });
    }

    // Add to pending requests safely
    currentUser.requestsSent = [...(currentUser.requestsSent || []), req.params.userId];
    targetUser.requestsReceived = [...(targetUser.requestsReceived || []), req.user.userId];
    
    await currentUser.save();
    await targetUser.save();

    await Notification.create({
      recipient: req.params.userId,
      sender: req.user.userId,
      type: 'match_request',
      message: `${currentUser.name} wants to match with you`
    });

    res.json({ message: 'Match request sent successfully' });
  } catch (error) {
    console.error('Send request error:', error);
    res.status(500).json({ message: error.message });
  }
});

// ACCEPT MATCH REQUEST
router.post('/accept-request/:userId', auth, async (req, res) => {
  try {
    const requester = await User.findById(req.params.userId);
    const currentUser = await User.findById(req.user.userId);
    
    if (!requester || !currentUser) return res.status(404).json({ message: 'User not found' });

    // Remove from pending lists safely
    currentUser.requestsReceived = (currentUser.requestsReceived || []).filter(id => id.toString() !== req.params.userId);
    requester.requestsSent = (requester.requestsSent || []).filter(id => id.toString() !== req.user.userId);

    // ADD TO MATCHES ARRAY
    currentUser.matches = [...(currentUser.matches || []), req.params.userId];
    requester.matches = [...(requester.matches || []), req.user.userId];
    
    await currentUser.save();
    await requester.save();

    await Notification.create({
      recipient: req.params.userId,
      sender: req.user.userId,
      type: 'match_accepted',
      message: `You matched with ${currentUser.name}! You can now chat.`
    });

    res.json({ message: 'Match accepted! You can now message each other.' });
  } catch (error) {
    console.error('Accept request error:', error);
    res.status(500).json({ message: error.message });
  }
});

// DECLINE/CANCEL REQUEST
router.delete('/request/:userId', auth, async (req, res) => {
  try {
    const currentUser = await User.findById(req.user.userId);
    const targetUser = await User.findById(req.params.userId);

    // Remove from both sent/received arrays safely
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
    console.error('Decline request error:', error);
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
