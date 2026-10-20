const mongoose = require('mongoose');

const postSchema = new mongoose.Schema({
  author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  text: { type: String, maxlength: 2200 },
  mediaUrl: String,
  mediaType: { type: String, enum: ['image', 'video'] },
  
  // NEW: Privacy Settings
  visibility: { 
    type: String, 
    enum: ['everyone', 'followers', 'matches'], 
    default: 'everyone' 
  },
  
  // NEW: Dual Reactions
  likes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  loves: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Post', postSchema);
