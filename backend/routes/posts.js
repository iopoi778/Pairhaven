const express = require('express');
const router = express.Router();
const Post = require('../models/Post');
const User = require('../models/User');
const { uploadVideo } = require('../middleware/upload');
const auth = require('../middleware/auth');

// CREATE VIDEO POST
router.post('/', auth, uploadVideo.single('video'), async (req, res) => {
  try {
    const { caption } = req.body;

    if (!req.file) {
      return res.status(400).json({ message: 'Video is required' });
    }

    const post = new Post({
      user: req.user.userId,
      videoUrl: req.file.path,
      thumbnail: req.file.path + '?thumbnail=true',
      caption
    });

    await post.save();

    const populatedPost = await Post.findById(post._id)
      .populate('user', 'name photos verificationStatus');

    res.status(201).json(populatedPost);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// GET ALL POSTS (Feed)
router.get('/feed', auth, async (req, res) => {
  try {
    const posts = await Post.find()
      .populate('user', 'name photos verificationStatus')
      .populate({
        path: 'comments',
        populate: { path: 'user', select: 'name photos' }
      })
      .sort({ createdAt: -1 })
      .limit(50);

    res.json(posts);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// GET USER'S POSTS
router.get('/user/:userId', auth, async (req, res) => {
  try {
    const posts = await Post.find({ user: req.params.userId })
      .populate('user', 'name photos verificationStatus')
      .populate({
        path: 'comments',
        populate: { path: 'user', select: 'name photos' }
      })
      .sort({ createdAt: -1 });

    res.json(posts);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// LIKE A POST
router.post('/:postId/like', auth, async (req, res) => {
  try {
    const post = await Post.findById(req.params.postId);
    
    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }

    const alreadyLiked = post.likes.includes(req.user.userId);
    
    if (alreadyLiked) {
      post.likes = post.likes.filter(id => id.toString() !== req.user.userId);
    } else {
      post.likes.push(req.user.userId);
    }

    await post.save();

    res.json({ 
      likesCount: post.likes.length,
      liked: !alreadyLiked 
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;