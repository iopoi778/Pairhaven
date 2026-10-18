const mongoose = require('mongoose');
const postSchema = new mongoose.Schema({
  author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  text: { type: String },
  mediaUrl: { type: String },
  mediaPublicId: { type: String },
  mediaType: { type: String }, // 'image'|'video'
  createdAt: { type: Date, default: Date.now }
});
module.exports = mongoose.model('Post', postSchema);
