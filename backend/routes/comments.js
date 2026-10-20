const express = require('express');
const router = express.Router();
const Comment = require('../models/Comment');
const Post = require('../models/Post');
const Notification = require('../models/Notification');
const auth = require('../middleware/auth');

// ADD COMMENT TO POST
router.post('/:postId', auth, async (req, res) => {
  try {
    const { text } = req.body;
    const post = await Post.findById(req.params.postId);

    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }

    const comment = new Comment({
      post: req.params.postId,
      user: req.user.userId,
      text
    });

    await comment.save();

    // Add comment to post
    post.comments.push(comment._id);
    await post.save();

    // Populate comment with user info
    const populatedComment = await Comment.findById(comment._id)
      .populate('user', 'name photos');

    // Create notification for post owner
    if (post.user.toString() !== req.user.userId) {
      await Notification.create({
        recipient: post.user,
        sender: req.user.userId,
        type: 'comment',
        message: 'Commented on your post',
        relatedId: req.params.postId
      });
    }

    res.status(201).json(populatedComment);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// GET COMMENTS FOR POST
router.get('/post/:postId', auth, async (req, res) => {
  try {
    const comments = await Comment.find({ post: req.params.postId })
      .populate('user', 'name photos verificationStatus')
      .sort({ createdAt: -1 });

    res.json(comments);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// DELETE COMMENT
router.delete('/:commentId', auth, async (req, res) => {
  try {
    const comment = await Comment.findById(req.params.commentId);

    if (!comment) {
      return res.status(404).json({ message: 'Comment not found' });
    }

    // Only allow deleting own comments
    if (comment.user.toString() !== req.user.userId) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    await comment.deleteOne();

    // Remove from post
    await Post.findByIdAndUpdate(comment.post, {
      $pull: { comments: req.params.commentId }
    });

    res.json({ message: 'Comment deleted' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;