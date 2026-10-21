const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Post = require('../models/Post');
const Notification = require('../models/Notification');
const auth = require('../middleware/auth');
const adminAuth = require('../middleware/adminAuth');

// 1. GET ALL USERS (Supports search by name or email)
router.get('/users', auth, adminAuth, async (req, res) => {
  try {
    const { search } = req.query;
    let query = {};
    if (search) {
      query = {
        $or: [
          { name: { $regex: search,$options: 'i' } },
          { email: { $regex: search,$options: 'i' } }
        ]
      };
    }
    const users = await User.find(query).select('-password').sort({ createdAt: -1 }).limit(100);
    res.json(users);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// 2. UPDATE USER TIER / GIVE PRO OR UNLIMITED
router.patch('/users/:id/tier', auth, adminAuth, async (req, res) => {
  try {
    const { tier } = req.body; // 'standard', 'pro', or 'unlimited'
    if (!['standard', 'pro', 'unlimited'].includes(tier)) {
      return res.status(400).json({ message: 'Invalid subscription tier' });
    }

    const targetUser = await User.findById(req.params.id);
    if (!targetUser) return res.status(404).json({ message: 'User not found' });

    targetUser.membershipTier = tier;
    targetUser.isVip = tier !== 'standard';
    await targetUser.save();

    res.json({ message: `Successfully updated ${targetUser.name}'s plan to ${tier.toUpperCase()}` });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});
// 4. ADMIN: DELETE ANY POST (Inappropriate content moderation)
router.delete('/posts/:postId', auth, adminAuth, async (req, res) => {
  try {
    const post = await Post.findByIdAndDelete(req.params.postId);
    if (!post) return res.status(404).json({ message: 'Post not found' });
    res.json({ message: 'Post deleted successfully by admin.' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// 5. ADMIN: UPDATE USER PROFILE / PHOTOS / BIO
router.patch('/users/:id/profile', auth, adminAuth, async (req, res) => {
  try {
    const { bio, photos, name } = req.body;
    const targetUser = await User.findById(req.params.id);
    if (!targetUser) return res.status(404).json({ message: 'User not found' });

    if (bio !== undefined) targetUser.bio = bio;
    if (name !== undefined) targetUser.name = name;
    if (photos !== undefined) targetUser.photos = photos; // Remove or replace bad photos

    await targetUser.save();
    res.json({ message: 'User profile updated successfully by admin.', user: targetUser });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});
// 3. DELETE USER ACCOUNT (For Terms of Service violations)
router.delete('/users/:id', auth, adminAuth, async (req, res) => {
  try {
    const userId = req.params.id;
    
    // Clean up user posts, notifications, and references
    await Post.deleteMany({ author: userId });
    await Notification.deleteMany({ $or: [{ recipient: userId }, { sender: userId }] });

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
    
    await User.findByIdAndDelete(userId);

    res.json({ message: 'User account deleted successfully by support team.' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
