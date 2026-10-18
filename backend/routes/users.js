const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Notification = require('../models/Notification');
const auth = require('../middleware/auth');

// GET USER PROFILE
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
      followersCount: user.followers.length,
      followingCount: user.following.length,
      likesReceivedCount: user.likesReceived.length,
      matchesCount: user.matches.length,
      isFollowing: user.followers.includes(req.user.userId),
      followers: user.followers,
      following: user.following
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// FOLLOW USER
router.post('/follow/:userId', auth, async (req, res) => {
  try {
    const userToFollow = await User.findById(req.params.userId);
    const currentUser = await User.findById(req.user.userId);

    if (!userToFollow) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (currentUser.following.includes(req.params.userId)) {
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
    res.status(500).json({ message: error.message });
  }
});

// UNFOLLOW USER
router.delete('/unfollow/:userId', auth, async (req, res) => {
  try {
    const currentUser = await User.findById(req.user.userId);
    const userToUnfollow = await User.findById(req.params.userId);

    currentUser.following = currentUser.following.filter(
      id => id.toString() !== req.params.userId
    );
    userToUnfollow.followers = userToUnfollow.followers.filter(
      id => id.toString() !== req.user.userId
    );

    await currentUser.save();
    await userToUnfollow.save();

    res.json({ message: 'Successfully unfollowed' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// LIKE USER (with mutual match detection)
router.post('/like/:userId', auth, async (req, res) => {
  try {
    const userToLike = await User.findById(req.params.userId);
    const currentUser = await User.findById(req.user.userId);
    
    if (!userToLike) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Check if already liked
    const alreadyLiked = userToLike.likesReceived.find(
      like => like.from.toString() === req.user.userId
    );

    if (alreadyLiked) {
      return res.status(400).json({ message: 'Already liked' });
    }

    // Add like
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
    const mutualLike = currentUser.likesReceived.find(
      like => like.from.toString() === req.params.userId
    );

    if (mutualLike) {
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
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
