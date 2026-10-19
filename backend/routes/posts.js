
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
// GET /api/posts/feed - Smart Feed Filtering
router.get('/feed', auth, async (req, res) => {
  try {
    const currentUser = await User.findById(req.user.userId);
    
    // Base query: Everyone's posts OR Followers' posts OR Matches' posts
    let query = {};
    
    if (currentUser.following?.length > 0 || currentUser.matches?.length > 0) {
      query.author = { 
        $in: [...(currentUser.following || []), ...(currentUser.matches || [])] 
      };
    } else {
      // If no connections, show everyone's public posts
      query.visibility = 'everyone';
    }

    const posts = await Post.find(query)
      .sort({ createdAt: -1 })
      .limit(50)
      .populate('author', 'name photos age bio location');

    // Filter out posts viewer shouldn't see (e.g., private followers-only from non-followers)
    const visiblePosts = posts.filter(post => {
      if (post.visibility === 'everyone') return true;
      if (post.visibility === 'followers') return currentUser.following?.includes(post.author._id);
      if (post.visibility === 'matches') return currentUser.matches?.includes(post.author._id);
      return false;
    });

    res.json(visiblePosts);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// POST /api/posts/:postId/react - Handle Like/Love Toggle
router.post('/:postId/react', auth, async (req, res) => {
  try {
    const { type } = req.body; // 'like' or 'love'
    const post = await Post.findById(req.params.postId);
    if (!post) return res.status(404).json({ message: 'Post not found' });

    const userId = req.user.userId;
    
    if (type === 'like') {
      const idx = post.likes.indexOf(userId);
      idx === -1 ? post.likes.push(userId) : post.likes.splice(idx, 1);
    } else if (type === 'love') {
      const idx = post.loves.indexOf(userId);
      idx === -1 ? post.loves.push(userId) : post.loves.splice(idx, 1);
    }

    await post.save();
    res.json({ 
      likesCount: post.likes.length, 
      lovesCount: post.loves.length,
      userLiked: post.likes.includes(userId),
      userLoved: post.loves.includes(userId)
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});
module.exports = router;
