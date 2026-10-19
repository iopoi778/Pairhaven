const express = require('express');
const router = express.Router();
const Post = require('../models/Post');
const Notification = require('../models/Notification');
const User = require('../models/User');
const auth = require('../middleware/auth');

// GET /api/posts - Ensure all fields are returned
router.get('/', auth, async (req, res) => {
  try {
    const posts = await Post.find()
      .populate('author', 'name photos')
      .populate('likes', '_id')
      .populate('loves', '_id')
      .sort({ createdAt: -1 })
      .lean();

    const formattedPosts = posts.map(post => ({
      ...post,
      text: typeof post.text === 'string' ? post.text.trim() : '',
      mediaUrl: post.mediaUrl || null,
      mediaType: post.mediaType || null,
      likesCount: (post.likes || []).length,
      lovesCount: (post.loves || []).length,
      userLiked: (post.likes || []).some(u => u._id.toString() === req.user.userId),
      userLoved: (post.loves || []).some(u => u._id.toString() === req.user.userId)
    }));

    res.json(formattedPosts);
  } catch (error) {
    console.error('Get posts error:', error);
    res.status(500).json({ message: error.message });
  }
});

// ✅ SINGLE REACT ROUTE WITH NOTIFICATION LOGIC
router.post('/:postId/react', auth, async (req, res) => {
  try {
    const { type } = req.body;
    const post = await Post.findById(req.params.postId).populate('author', '_id name');
    
    if (!post) return res.status(404).json({ message: 'Post not found' });

    const userId = req.user.userId;
    const currentUser = await User.findById(userId);
    
    let isAdding = false;
    
    if (type === 'like') {
      const idx = post.likes.indexOf(userId);
      isAdding = idx === -1;
      if (isAdding) post.likes.push(userId);
      else post.likes.splice(idx, 1);
    } else if (type === 'love') {
      const idx = post.loves.indexOf(userId);
      isAdding = idx === -1;
      if (isAdding) post.loves.push(userId);
      else post.loves.splice(idx, 1);
    }

    await post.save();

    if (isAdding && post.author._id.toString() !== userId) {
      const actionText = type === 'like' ? 'liked your post' : 'loved your post';
      await Notification.create({
        recipient: post.author._id,
        sender: userId,
        type: type,
        message: `${currentUser.name} ${actionText}`,
        post: post._id
      });
    }

    res.json({ 
      likesCount: post.likes.length, 
      lovesCount: post.loves.length,
      userLiked: post.likes.includes(userId),
      userLoved: post.loves.includes(userId)
    });
  } catch (error) {
    console.error('React error:', error);
    res.status(500).json({ message: error.message });
  }
});

// ✅ STRICT POST CREATION - PREVENTS EMPTY POSTS
router.post('/', auth, async (req, res) => {
  try {
    const { text, mediaUrl, mediaType } = req.body;
    
    // Validate content exists
    const hasText = text && typeof text === 'string' && text.trim().length > 0;
    const hasMedia = mediaUrl && typeof mediaUrl === 'string' && mediaUrl.trim().length > 0;
    
    if (!hasText && !hasMedia) {
      return res.status(400).json({ 
        message: 'Post must contain text or media. Empty posts are not allowed.' 
      });
    }

    const newPost = new Post({
      author: req.user.userId,
      text: hasText ? text.trim() : '',
      mediaUrl: hasMedia ? mediaUrl.trim() : null,
      mediaType: hasMedia ? (mediaType || 'image') : null,
      likes: [],
      loves: []
    });
    
    await newPost.save();
    
    const populated = await Post.findById(newPost._id)
      .populate('author', 'name photos')
      .lean();
      
    res.status(201).json(populated);
  } catch (error) {
    console.error('Create post error:', error);
    res.status(500).json({ message: error.message });
  }
});

// ✅ DELETE POST - FIXES THE 404 ERROR
router.delete('/:postId', auth, async (req, res) => {
  try {
    const post = await Post.findById(req.params.postId);
    if (!post) return res.status(404).json({ message: 'Post not found' });
    
    if (post.author.toString() !== req.user.userId) {
      return res.status(403).json({ message: 'Unauthorized' });
    }
    
    await Post.findByIdAndDelete(req.params.postId);
    res.json({ message: 'Deleted successfully' });
  } catch (error) {
    console.error('Delete error:', error);
    res.status(500).json({ message: error.message });
  }
});

// GET /api/posts/feed - Smart Feed Filtering
router.get('/feed', auth, async (req, res) => {
  try {
    const currentUser = await User.findById(req.user.userId);
    
    let query = {};
    
    if (currentUser.following?.length > 0 || currentUser.matches?.length > 0) {
      query.author = { 
        $in: [...(currentUser.following || []), ...(currentUser.matches || [])] 
      };
    } else {
      query.visibility = 'everyone';
    }

    const posts = await Post.find(query)
      .sort({ createdAt: -1 })
      .limit(50)
      .populate('author', 'name photos age bio location')
      .populate('likes', '_id')
      .populate('loves', '_id');

    const visiblePosts = posts.filter(post => {
      if (post.visibility === 'everyone') return true;
      if (post.visibility === 'followers') return currentUser.following?.includes(post.author._id);
      if (post.visibility === 'matches') return currentUser.matches?.includes(post.author._id);
      return false;
    }).map(post => {
      const postObj = post.toObject();
      return {
        ...postObj,
        likesCount: post.likes.length,
        lovesCount: post.loves.length,
        userLiked: post.likes.some(u => u._id.toString() === req.user.userId),
        userLoved: post.loves.some(u => u._id.toString() === req.user.userId)
      };
    });

    res.json(visiblePosts);
  } catch (error) {
    console.error('Feed error:', error);
    res.status(500).json({ message: error.message });
  }
});

// Legacy like route (kept for backward compatibility)
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

module.exports = router;
