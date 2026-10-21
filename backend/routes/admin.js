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
// Helper to notify all admins
async function notifyAdmins(type, message, metadata = {}) {
  try {
    const admins = await User.find({ role: 'admin' });
    const notifications = admins.map(admin => ({
      recipient: admin._id,
      sender: metadata.userId || admin._id,
      type,
      message,
      metadata,
      read: false
    }));
    await Notification.insertMany(notifications);
  } catch (err) {
    console.error("Failed to notify admins:", err);
  }
}

// 1. User submits live selfie verification
router.post('/verify-selfie', auth, async (req, res) => {
  try {
    const { image } = req.body;
    const user = await User.findById(req.user.userId);
    user.verificationStatus = 'pending';
    user.selfieSnap = image; // Base64 or uploaded URL
    await user.save();

    // Notify admins of new verification submission
    await notifyAdmins('verification_request', `📸 ${user.name} submitted a live selfie for verification!`, { userId: user._id });

    res.json({ message: 'Selfie submitted for verification.' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PATCH /api/admin/users/:id/tier - Update user membership tier
router.patch('/users/:id/tier', auth, adminAuth, async (req, res) => {
  try {
    const { tier } = req.body;
    if (!['standard', 'pro', 'unlimited'].includes(tier)) {
      return res.status(400).json({ message: 'Invalid membership tier' });
    }

    const updatedUser = await User.findByIdAndUpdate(
      req.params.id,
      { 
        membershipTier: tier,
        isVip: tier !== 'standard' 
      },
      { new: true }
    ).select('-password');

    if (!updatedUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({ message: 'Tier updated successfully', user: updatedUser });
  } catch (err) {
    console.error('Update tier error:', err);
    res.status(500).json({ message: err.message });
  }
});

// 3. Trigger Admin Notifications on Payments / Ad Watches
router.post('/reward-ad', auth, async (req, res) => {
  // ... ad reward logic ...
  const user = await User.findById(req.user.userId);
  await notifyAdmins('ad_watched', `📺 ${user.name} watched an ad and claimed coin rewards!`, { userId: user._id });
  res.json({ message: 'Ad reward granted' });
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
router.patch('/users/:id/verify', auth, adminAuth, async (req, res) => {
  try {
    const { status } = req.body; // 'verified' or 'not_verified'
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    user.verificationStatus = status;
    await user.save();

    res.json({ message: `Verification status updated to ${status}`, user });
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
