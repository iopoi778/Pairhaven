const express = require('express');
const router = express.Router();
const Post = require('../models/Post');
const Notification = require('../models/Notification');
const User = require('../models/User');
const auth = require('../middleware/auth');
const cloudinary = require('cloudinary').v2;
const multer = require('multer');

// ✅ SAFE CLOUDINARY CONFIGURATION
if (process.env.CLOUDINARY_CLOUD_NAME) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
  });
} else {
  console.warn("⚠️ Cloudinary credentials missing. Image uploads will fail.");
}

// Multer memory storage
const storage = multer.memoryStorage();
const upload = multer({ 
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    if (allowedTypes.test(file.mimetype)) return cb(null, true);
    cb(new Error('Only image files are allowed'));
  }
});

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

// REACT ROUTE - FIXED TO PREVENT 500 ERRORS
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

    // ✅ SAFE NOTIFICATION CREATION
    if (isAdding && post.author._id.toString() !== userId) {
      try {
        const actionText = type === 'like' ? 'liked your post' : 'loved your post';
        await Notification.create({
          recipient: post.author._id,
          sender: userId,
          type: type,
          message: `${currentUser.name} ${actionText}`,
          post: post._id
        });
      } catch (notifErr) {
        console.error('Failed to create notification:', notifErr);
        // Don't crash the reaction if notification fails
      }
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

// POST CREATION - FIXED WITH BETTER ERROR HANDLING
router.post('/', auth, upload.single('media'), async (req, res) => {
  try {
    const { text, mediaUrl, mediaType } = req.body;
    const uploadedFile = req.file;
    
    let finalMediaUrl = null;
    let finalMediaType = null;
    
    // Upload to Cloudinary if file provided
    if (uploadedFile) {
      if (!process.env.CLOUDINARY_CLOUD_NAME) {
        return res.status(500).json({ message: 'Server configuration error: Cloudinary not set up.' });
      }

      const result = await new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          { folder: 'pairhaven_posts' },
          (error, result) => {
            if (error) reject(error);
            else resolve(result);
          }
        );
        stream.end(uploadedFile.buffer);
      });
      
      finalMediaUrl = result.secure_url;
      finalMediaType = 'image';
    } else if (mediaUrl && typeof mediaUrl === 'string' && mediaUrl.trim().length > 0) {
      finalMediaUrl = mediaUrl.trim();
      finalMediaType = mediaType || 'image';
    }
    
    const hasText = text && typeof text === 'string' && text.trim().length > 0;
    const hasMedia = finalMediaUrl !== null;
    
    if (!hasText && !hasMedia) {
      return res.status(400).json({ 
        message: 'Post must contain text or media.' 
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
