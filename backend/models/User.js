const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true },
  phone: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  isVip: { type: Boolean, default: false },
  matchesSentToday: { type: Number, default: 0 },
  lastMatchResetDate: { type: Date, default: Date.now }
});
  photos: [{
    url: { type: String, required: true },
    publicId: String,
    isPrimary: { type: Boolean, default: false }
  }],
  
  location: {
    type: { type: String, enum: ['Point'], default: 'Point' },
    coordinates: { type: [Number], default: [0, 0] },
    address: { type: String, default: '' }
  },
  
  age: { type: Number, required: true, min: 18 },
  gender: { type: String, enum: ['male', 'female', 'other'], required: true },
  bio: { type: String, maxlength: 500 },
  interests: [{ type: String }],
  verificationStatus: { type: String, enum: ['not_verified', 'verified'], default: 'not_verified' },
  isPrivate: { type: Boolean, default: false },
  
  // ✅ NEW MATCH REQUEST FIELDS (Required for matching system)
  matches: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  requestsSent: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  requestsReceived: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  
  preferences: {
    ageRange: { min: Number, max: Number },
    distance: { type: Number, default: 50 },
    gender: { type: String }
  },
  createdAt: { type: Date, default: Date.now }
}, { timestamps: true });

// Geospatial index for location-based matching
userSchema.index({ location: '2dsphere' });

module.exports = mongoose.model('User', userSchema);
