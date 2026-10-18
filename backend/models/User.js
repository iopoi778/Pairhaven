// backend/models/User.js
const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true },
  phone: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  photos: [{
    url: { type: String, required: true },
    publicId: String,
    isPrimary: { type: Boolean, default: false }
  }],
 location: {
  type: { type: String, enum: ['Point'], default: 'Point' },
  coordinates: { type: [Number], default: [0, 0] }, // Removed required: true
  address: { type: String, default: '' }            // Removed required: true
},
  age: { type: Number, required: true, min: 18 },
  gender: { type: String, enum: ['male', 'female', 'other'], required: true },
  bio: { type: String, maxlength: 500 },
  interests: [{ type: String }],
  verificationStatus: { type: String, enum: ['not_verified', 'verified'], default: 'not_verified' },
  followers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  following: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  likesReceived: [{
    from: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    createdAt: { type: Date, default: Date.now }
  }],
  matches: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  preferences: {
    ageRange: { min: Number, max: Number },
    distance: { type: Number, default: 50 },
    gender: { type: String }
  },
  createdAt: { type: Date, default: Date.now }
});

// Geospatial index still works even with default [0,0] coordinates
userSchema.index({ location: '2dsphere' });

module.exports = mongoose.model('User', userSchema);