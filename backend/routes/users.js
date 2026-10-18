const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Notification = require('../models/Notification');
const auth = require('../middleware/auth');

// GET USER PROFILE - Handles both /me and /:id
router.get('/profile/:id', auth, async (req, res) => {
  try {
    // Resolve 'me' to current user's ID
    const targetId = req.params.id === 'me' ? req.user.userId : req.params.id;
    
    const user = await User.findById(targetId)
      .select('-password')
      .populate('followers', 'name photos')
      .populate('following', 'name photos');

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Safe length checks to prevent 500 errors
    const followers = user.followers || [];
    const following = user.following || [];
    const likesReceived = user.likesReceived || [];
    const matches = user.matches || [];

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
      followersCount: followers.length,
      followingCount: following.length,
      likesReceivedCount: likesReceived.length,
      matchesCount: matches.length,
      isFollowing: req.params.id === 'me' ? false : followers.some(f => f._id.toString() === req.user.userId),
      followers,
      following
    });
  } catch (error) {
    console.error('Profile fetch error:', error);
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

    // Check if already liked
    const alreadyLiked = (userToLike.likesReceived || []).find(
      like => like.from?.toString() === req.user.userId
    );

    if (alreadyLiked) {
      return res.status(400).json({ message: 'Already liked' });
    }

    // Add like
    userToLike.likesReceived = userToLike.likesReceived || [];
    userToLike.likesReceived.push({ from: req.user.userId });
    await userToLike.save();

    // CREATE NOTIFICATION
    await Notification.create({
      recipient: req.params.userId,
      sender: req.user.userId,
      type: 'like',
      message: `${currentUser.name} liked your profile`
    });

    // CHECK FOR MUTUAL LIKE → CREATE MATCH
    const mutualLike = (currentUser.likesReceived || []).find(
      like => like.from?.toString() === req.params.userId
    );

    if (mutualLike) {
      // Initialize arrays if missing
      currentUser.matches = currentUser.matches || [];
      userToLike.matches = userToLike.matches || [];

      // Add to BOTH users' matches arrays
      if (!currentUser.matches.includes(req.params.userId)) {
        currentUser.matches.push(req.params.userId);
        await currentUser.save();
      }
      if (!userToLike.matches.includes(req.user.userId)) {
        userToLike.matches.push(req.user.userId);
        await userToLike.save();
      }

      // Create match notification for both
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
