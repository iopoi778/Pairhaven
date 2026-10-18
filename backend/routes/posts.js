// backend/routes/posts.js
const express = require('express');
const router = express.Router();
const Post = require('../models/Post'); // CRITICAL: Ensure this model exists!
const auth = require('../middleware/auth');

// POST /api/posts/:postId/like - Toggle Like
router.post('/:postId/like', auth, async (req, res) => {
  try {
    const post = await Post.findById(req.params.postId);
    if (!post) return res.status(404).json({ message: 'Post not found' });

    const userId = req.user.userId;
    const likeIndex = post.likes.indexOf(userId);

    if (likeIndex === -1) {
      post.likes.push(userId);
    } else {
      post.likes.splice(likeIndex, 1);
    }

    await post.save();
    res.json({ likesCount: post.likes.length });
  } catch (error) {
    console.error('Like toggle error:', error);
    res.status(500).json({ message: error.message });
  }
});

// GET /api/posts - Fetch all posts
router.get('/', auth, async (req, res) => {
  try {
    const posts = await Post.find()
      .populate('author', 'name photos')
      .sort({ createdAt: -1 });
    res.json(posts);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// POST /api/posts - Create new post
router.post('/', auth, async (req, res) => {
  try {
    const { text, mediaUrl, mediaType } = req.body;
    const newPost = new Post({
      author: req.user.userId,
      text,
      mediaUrl,
      mediaType,
      likes: []
    });
    await newPost.save();
    const populated = await Post.findById(newPost._id).populate('author', 'name photos');
    res.status(201).json(populated);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
