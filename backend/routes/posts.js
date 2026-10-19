const express = require('express');
const router = express.Router();
const Post = require('../models/Post');
const Notification = require('../models/Notification');
const User = require('../models/User');
const auth = require('../middleware/auth');

// ✅ SAFE MULTER SETUP WITH FALLBACK
let upload;
try {
  const multer = require('multer');
  const path = require('path');
  const fs = require('fs');

  const uploadDir = './uploads';
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }

  const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => {
      const uniqueName = Date.now() + '-' + Math.round(Math.random() * 1E9);
      const ext = path.extname(file.originalname);
      cb(null, uniqueName + ext);
    }
  });

  upload = multer({ 
    storage,
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
      const allowedTypes = /jpeg|jpg|png|gif|webp/;
      const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
      const mimetype = allowedTypes.test(file.mimetype);
      if (mimetype && extname) return cb(null, true);
      cb(new Error('Only image files are allowed'));
    }
  });
} catch (e) {
  console.warn('Multer not available, file uploads disabled:', e.message);
  upload = null;
}

// GET /api/posts
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

// REACT ROUTE
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

// ✅ FIXED POST CREATION - HANDLES MULTER ERRORS GRACEFULLY
router.post('/', auth, async (req, res) => {
  try {
    // Apply multer middleware manually to catch errors
    if (upload) {
      await new Promise((resolve, reject) => {
        upload.single('media')(req, res, (err) => {
          if (err) {
            console.error('Multer error:', err);
            // Don't reject, just log - we'll handle missing file below
          }
          resolve();
        });
      });
    }

    const { text, mediaUrl, mediaType } = req.body;
    const uploadedFile = req.file;
    
    console.log('Post creation debug:', {
      hasText: !!text,
      textLength: text?.length,
      hasUploadedFile: !!uploadedFile,
      hasMediaUrl: !!mediaUrl,
      mediaUrlType: typeof mediaUrl
    });
    
    // Determine actual media URL and type
    let finalMediaUrl = null;
    let finalMediaType = null;
    
    if (uploadedFile) {
      finalMediaUrl = `/uploads/${uploadedFile.filename}`;
      finalMediaType = 'image';
    } else if (mediaUrl && typeof mediaUrl === 'string' && mediaUrl.trim().length > 0) {
      finalMediaUrl = mediaUrl.trim();
      finalMediaType = mediaType || 'image';
    }
    
    const hasText = text && typeof text === 'string' && text.trim().length > 0;
    const hasMedia = finalMediaUrl !== null;
    
    console.log('Validation result:', { hasText, hasMedia, finalMediaUrl });
    
    if (!hasText && !hasMedia) {
      return res.status(400).json({ 
        message: 'Post must contain text or media. Empty posts are not allowed.',
        debug: { textProvided: !!text, mediaProvided: !!mediaUrl, fileUploaded: !!uploadedFile }
      });
    }

    const newPost = new Post({
      author: req.user.userId,
      text: hasText ? text.trim() : '',
      mediaUrl: finalMediaUrl,
      mediaType: finalMediaType,
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

// DELETE POST
router.delete('/:postId', auth, async (req, res) => {
  try {
    const post = await Post.findById(req.params.postId);
    if (!post) return res.status(404).json({ message: 'Post not found' });
    
    const postAuthorId = post.author.toString();
    const currentUserId = req.user.userId.toString();
    
    if (postAuthorId !== currentUserId) {
      return res.status(403).json({ message: 'Unauthorized' });
    }
    
    await Post.findByIdAndDelete(req.params.postId);
    res.json({ message: 'Deleted successfully' });
  } catch (error) {
    console.error('Delete error:', error);
    res.status(500).json({ message: error.message });
  }
});

// FEED ROUTE
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

// LEGACY LIKE ROUTE
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
