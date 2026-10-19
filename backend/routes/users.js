const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Post = require('../models/Post'); // Ensure this model exists
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
      isPrivate: user.isPrivate || false, // NEW: Privacy setting
      followersCount: followers.length,
      followingCount: following.length,
      likesReceivedCount: likesReceived.length,
      matchesCount: matches.length,
      isFollowing: followers.some(f => f._id.toString() === req.user.userId),
      showFollowingCount: isOwnProfile, // NEW: Hide following for friends
      followers,
      following
    });
  } catch (error) {
    console.error('Profile fetch error:', error);
    res.status(500).json({ message: error.message });
  }
});

// PATCH UPDATE PROFILE (Bio, Privacy) - NEW ROUTE
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

// GET USER POSTS (Respects Privacy) - NEW ROUTE
router.get('/profile/:userId/posts', auth, async (req, res) => {
  try {
    const targetUser = await User.findById(req.params.userId);
    if (!targetUser) return res.status(404).json({ message: 'User not found' });

    // If private and viewer is NOT a follower, return empty array
    if (targetUser.isPrivate && !targetUser.followers?.includes(req.user.userId)) {
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

// DELETE POST - NEW ROUTE
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

// FOLLOW USER
router.post('/follow/:userId', auth, async (req, res) => {
  try {
    const userToFollow = await User.findById(req.params.userId);
    const currentUser = await User.findById(req.user.userId);

    if (!userToFollow || !currentUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (currentUser.following?.includes(req.params.userId)) {
      return res.status(400).json({ message: 'Already following' });
    }

    currentUser.following.push(req.params.userId);
    userToFollow.followers.push(req.user.userId);

    await currentUser.save();
    await userToFollow.save();

    await Notification.create({
      recipient: req.params.userId,
      sender: req.user.userId,
      type: 'follow',
      message: `${currentUser.name} started following you`
    });

    res.json({ 
      message: 'Successfully followed',
      followersCount: userToFollow.followers.length 
    });
  } catch (error) {
    console.error('Follow error:', error);
    res.status(500).json({ message: error.message });
  }
});

// UNFOLLOW USER
router.delete('/unfollow/:userId', auth, async (req, res) => {
  try {
    const currentUser = await User.findById(req.user.userId);
    const userToUnfollow = await User.findById(req.params.userId);

    if (!currentUser || !userToUnfollow) {
      return res.status(404).json({ message: 'User not found' });
    }

    currentUser.following = (currentUser.following || []).filter(
      id => id.toString() !== req.params.userId
    );
    userToUnfollow.followers = (userToUnfollow.followers || []).filter(
      id => id.toString() !== req.user.userId
    );

    await currentUser.save();
    await userToUnfollow.save();

    res.json({ message: 'Successfully unfollowed' });
  } catch (error) {
    console.error('Unfollow error:', error);
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
