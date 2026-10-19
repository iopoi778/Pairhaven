const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Post = require('../models/Post');
const Notification = require('../models/Notification');
const auth = require('../middleware/auth');

// GET USER PROFILE - Enhanced with privacy & safe counts
router.get('/profile/:id', auth, async (req, res) => {
  try {
    const targetId = req.params.id === 'me' ? req.user.userId : req.params.id;
    const user = await User.findById(targetId)
      .select('-password')
      .populate('followers', 'name photos')
      .populate('following', 'name photos');

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const followers = user.followers || [];
    const following = user.following || [];
    const likesReceived = user.likesReceived || [];
    const matches = user.matches || [];

    // Determine if viewer can see "Following" count (only self can see it)
    const isOwnProfile = targetId === req.user.userId;

    res.json({
      id: user._id,
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
      followersCount: followers.length,
      followingCount: following.length,
      likesReceivedCount: likesReceived.length,
      matchesCount: matches.length,
      isFollowing: followers.some(f => f._id.toString() === req.user.userId),
      showFollowingCount: isOwnProfile,
      followers,
      following
    });
  } catch (error) {
    console.error('Profile fetch error:', error);
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
    // Populate followers to correctly check ObjectIds against req.user.userId
    const targetUser = await User.findById(req.params.userId).populate('followers', '_id');
    if (!targetUser) return res.status(404).json({ message: 'User not found' });

    // If private and viewer is NOT a follower, return empty array
    const isFollower = targetUser.followers.some(f => f._id.toString() === req.user.userId);
    if (targetUser.isPrivate && !isFollower) {
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
    
    // Only author can delete
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

// SEND MATCH REQUEST (Replaces 'Like')
router.post('/request/:userId', auth, async (req, res) => {
  try {
    const targetUser = await User.findById(req.params.userId);
    const currentUser = await User.findById(req.user.userId);
    
    if (!targetUser || !currentUser) return res.status(404).json({ message: 'User not found' });
    
    // Check if already matched or requested
    if (currentUser.matches.includes(req.params.userId)) {
      return res.status(400).json({ message: 'Already matched' });
    }
    if (currentUser.requestsSent?.includes(req.params.userId)) {
      return res.status(400).json({ message: 'Request already sent' });
    }

    // Add to pending requests
    currentUser.requestsSent = [...(currentUser.requestsSent || []), req.params.userId];
    targetUser.requestsReceived = [...(targetUser.requestsReceived || []), req.user.userId];
    
    await currentUser.save();
    await targetUser.save();

    // Send notification
    await Notification.create({
      recipient: req.params.userId,
      sender: req.user.userId,
      type: 'match_request',
      message: `${currentUser.name} wants to match with you`
    });

    res.json({ message: 'Match request sent successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ACCEPT MATCH REQUEST (Creates the actual match + enables chat)
router.post('/accept-request/:userId', auth, async (req, res) => {
  try {
    const requester = await User.findById(req.params.userId);
    const currentUser = await User.findById(req.user.userId);
    
    if (!requester || !currentUser) return res.status(404).json({ message: 'User not found' });

    // Remove from pending lists
    currentUser.requestsReceived = (currentUser.requestsReceived || []).filter(id => id.toString() !== req.params.userId);
    requester.requestsSent = (requester.requestsSent || []).filter(id => id.toString() !== req.user.userId);

    // ADD TO MATCHES ARRAY (This enables messaging)
    currentUser.matches = [...(currentUser.matches || []), req.params.userId];
    requester.matches = [...(requester.matches || []), req.user.userId];
    
    await currentUser.save();
    await requester.save();

    // Send mutual match notification
    await Notification.create({
      recipient: req.params.userId,
      sender: req.user.userId,
      type: 'match_accepted',
      message: `You matched with ${currentUser.name}! You can now chat.`
    });

    res.json({ message: 'Match accepted! You can now message each other.' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// DECLINE/CANCEL REQUEST
router.delete('/request/:userId', auth, async (req, res) => {
  try {
    const currentUser = await User.findById(req.user.userId);
    const targetUser = await User.findById(req.params.userId);

    // Remove from both sent/received arrays
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
    res.status(500).json({ message: error.message });
  }
});
// LIKE USER (with mutual match detection)
router.post('/like/:userId', auth, async (req, res) => {
  try {
    const userToLike = await User.findById(req.params.userId);
    const currentUser = await User.findById(req.user.userId);
    
    if (!userToLike || !currentUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    const alreadyLiked = (userToLike.likesReceived || []).find(
      like => like.from?.toString() === req.user.userId
    );

    if (alreadyLiked) {
      return res.status(400).json({ message: 'Already liked' });
    }

    userToLike.likesReceived = userToLike.likesReceived || [];
    userToLike.likesReceived.push({ from: req.user.userId });
    await userToLike.save();

    await Notification.create({
      recipient: req.params.userId,
      sender: req.user.userId,
      type: 'like',
      message: `${currentUser.name} liked your profile`
    });

    const mutualLike = (currentUser.likesReceived || []).find(
      like => like.from?.toString() === req.params.userId
    );

    if (mutualLike) {
      currentUser.matches = currentUser.matches || [];
      userToLike.matches = userToLike.matches || [];

      if (!currentUser.matches.includes(req.params.userId)) {
        currentUser.matches.push(req.params.userId);
        await currentUser.save();
      }
      if (!userToLike.matches.includes(req.user.userId)) {
        userToLike.matches.push(req.user.userId);
        await userToLike.save();
      }

      await Notification.create({
        recipient: req.params.userId,
        sender: req.user.userId,
        type: 'match',
        message: `You matched with ${currentUser.name}!`
      });
      await Notification.create({
        recipient: req.user.userId,
        sender: req.params.userId,
        type: 'match',
        message: `You matched with ${userToLike.name}!`
      });
    }

    res.json({ 
      message: mutualLike ? 'It\'s a match!' : 'Liked successfully',
      isMatch: !!mutualLike,
      likesCount: userToLike.likesReceived.length 
    });
  } catch (error) {
    console.error('Like error:', error);
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
