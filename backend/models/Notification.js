
// backend/models/Notification.js
const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  recipient: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // may be null for system notices
  type: { type: String, enum: ['follow','like','match','message','new-user'], required: true },
  message: { type: String },
  metadata: { type: mongoose.Schema.Types.Mixed }, // optional extra data, e.g., { userId, matchId }
  read: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Notification', notificationSchema);
