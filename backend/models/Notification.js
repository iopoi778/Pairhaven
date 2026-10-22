const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  recipient: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: false }, // Optional for system/welcome notifications
  type: { 
    type: String, 
    enum: [
      'like', 
      'love', 
      'pass', 
      'welcome', 
      'match', 
      'match_request', 
      'match_accepted', 
      'message', 
      'incoming_call', 
      'system'
    ], 
    required: true 
  },
  message: { type: String, required: true },
  post: { type: mongoose.Schema.Types.ObjectId, ref: 'Post' },
  read: { type: Boolean, default: false }
}, { timestamps: true });

module.exports = mongoose.model('Notification', notificationSchema);
