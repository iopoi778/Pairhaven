const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Match = require('../models/match');
const Notification = require('../models/Notification');
const auth = require('../middleware/auth');

// GET /api/matches/random - Unified working version
router.get('/random', auth, async (req, res) => {
  try {
    const currentUser = await User.findById(req.user.userId);
    if (!currentUser) return res.status(404).json({ message: 'User not found' });

    // Build exclusion list: self + matches + sent likes
    const excludedIds = [
      req.user.userId,
      ...(currentUser.matches || []),
      ...(currentUser.likesSent || [])
    ];

    // Base query
    const query = { _id: { $nin: excludedIds } };

    // Only enforce verification in production
    if (process.env.NODE_ENV === 'production') {
      query.verificationStatus = 'verified';
    }

    // Geospatial filter (optional, based on user location)
    const distanceKm = parseFloat(req.query.distance || 50);
    const hasLocation = Array.isArray(currentUser.location?.coordinates) && 
                        currentUser.location.coordinates.length === 2;

    if (hasLocation && !isNaN(distanceKm) && distanceKm > 0) {
      query.location = {
        $near: {
          $geometry: { 
            type: 'Point', 
            coordinates: currentUser.location.coordinates.map(Number) 
          },
          $maxDistance: Math.round(distanceKm * 1000)
        }
      };
    }

    const potentialMatches = await User.find(query)
      .select('name photos age location bio gender interests verificationStatus')
      .limit(30)
      .sort({ createdAt: -1 });

    res.json(potentialMatches);
  } catch (error) {
    console.error('Random matches error:', error);
    res.status(500).json({ message: error.message });
  }
});

// POST /api/matches/match/filter - Filtered matching
router.post('/match/filter', auth, async (req, res) => {
  try {
    const { ageMin, ageMax, distance, gender } = req.body;
    const currentUser = await User.findById(req.user.userId);
    if (!currentUser) return res.status(404).json({ message: 'User not found' });

    const excluded = [
      String(req.user.userId),
      ...((currentUser.following || []).map(String)),
      ...((currentUser.matches || []).map(String))
    ];

    const query = { _id: { $nin: excluded } };

    if (ageMin || ageMax) {
      query.age = {};
      if (ageMin) query.age.$gte = parseInt(ageMin, 10);
      if (ageMax) query.age.$lte = parseInt(ageMax, 10);
    }

    if (gender) query.gender = gender;

    if (process.env.NODE_ENV === 'production') {
      query.verificationStatus = 'verified';
    }

    const distKm = parseFloat(distance || currentUser.preferences?.distance || 50);
    if (distKm && currentUser.location && Array.isArray(currentUser.location.coordinates)) {
      query.location = {
        $near: {
          $geometry: { type: 'Point', coordinates: currentUser.location.coordinates.map(Number) },
          $maxDistance: Math.round(distKm * 1000)
        }
      };
    }

    const matches = await User.find(query)
      .select('name photos age location bio interests verificationStatus')
      .limit(50);

    res.json(matches);
  } catch (error) {
    console.error('Match filter error:', error);
    res.status(500).json({ message: error.message });
  }
});

// POST /api/matches/create-match/:userId - Create mutual match
router.post('/create-match/:userId', auth, async (req, res) => {
  try {
    const existingMatch = await Match.findOne({
      $or: [
        { user1: req.user.userId, user2: req.params.userId },
        { user1: req.params.userId, user2: req.user.userId }
      ]
    });

    if (existingMatch) {
      return res.status(400).json({ message: 'Match already exists' });
    }

    const match = new Match({
      user1: req.user.userId,
      user2: req.params.userId,
      status: 'accepted'
    });

    await match.save();

    // Update both users' matches arrays
    await User.findByIdAndUpdate(req.user.userId, { $push: { matches: req.params.userId } });
    await User.findByIdAndUpdate(req.params.userId, { $push: { matches: req.user.userId } });

    // Notify both users
    await Notification.create({ 
      recipient: req.params.userId, 
      sender: req.user.userId, 
      type: 'match', 
      message: 'You have a new match!' 
    });
    await Notification.create({ 
      recipient: req.user.userId, 
      sender: req.params.userId, 
      type: 'match', 
      message: 'You have a new match!' 
    });

    res.json({ message: 'Match created successfully', match });
  } catch (error) {
    console.error('Create match error:', error);
    res.status(500).json({ message: error.message });
  }
});

// GET /api/matches/my-matches - Get current user's matches
router.get('/my-matches', auth, async (req, res) => {
  try {
    const currentUser = await User.findById(req.user.userId)
      .populate('matches', 'name photos age location verificationStatus');
    
    res.json(currentUser.matches || []);
  } catch (error) {
    console.error('My matches error:', error);
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
