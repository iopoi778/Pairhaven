const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Notification = require('../models/Notification');
const auth = require('../middleware/auth');

// GET USER PROFILE
router.get('/profile/:id', auth, async (req, res) => {
  try {
    const user = await User.findById(req.params.id)
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

// LIKE USER
router.post('/like/:userId', auth, async (req, res) => {
  try {
    const userToLike = await User.findById(req.params.userId);
    
    if (!userToLike) {
      return res.status(404).json({ message: 'User not found' });
    }

    const alreadyLiked = userToLike.likesReceived.find(
      like => like.from.toString() === req.user.userId
    );

    if (alreadyLiked) {
      return res.status(400).json({ message: 'Already liked' });
    }

    userToLike.likesReceived.push({ from: req.user.userId });
    await userToLike.save();

    await Notification.create({
      recipient: req.params.userId,
      sender: req.user.userId,
      type: 'like',
      message: `Someone liked your profile`
    });

    res.json({ 
      message: 'Liked successfully',
      likesCount: userToLike.likesReceived.length 
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;