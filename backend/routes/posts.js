
const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { v2: cloudinary } = require('cloudinary');
const streamifier = require('streamifier');
const Post = require('../models/Post'); // create simple Post model

// multer-like: rely on memory buffer via multer in upload middleware or use upload.single in this route
const multer = require('multer');
const upload = multer(); // memory storage

router.post('/', auth, upload.single('media'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'No file uploaded' });

    // Upload to Cloudinary as video
    const result = await new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        { resource_type: 'video', folder: 'pairhaven/posts' },
        (err, res) => (err ? reject(err) : resolve(res))
      );
      streamifier.createReadStream(req.file.buffer).pipe(uploadStream);
    });

    const post = await Post.create({
      author: req.user.userId,
      text: req.body.text || '',
      mediaUrl: result.secure_url,
      mediaPublicId: result.public_id,
      mediaType: 'video',
      createdAt: new Date()
    });

    return res.status(201).json({ post });
  } catch (err) {
    console.error('post upload error', err);
    return res.status(500).json({ message: 'Upload failed', error: err.message });
  }
});

// GET feed
router.get('/', auth, async (req, res) => {
  try {
    const posts = await Post.find().populate('author', 'name photos').sort({ createdAt: -1 }).limit(50);
    res.json(posts);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
