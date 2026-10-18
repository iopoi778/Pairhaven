const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Match = require('../models/match');
const Notification = require('../models/Notification');
const auth = require('../middleware/auth');

// GET RANDOM PROFILES FOR HOME TAB
router.get('/random', auth, async (req, res) => {
  try {
    const currentUser = await User.findById(req.user.userId);
    if (!currentUser) return res.status(404).json({ message: 'User not found' });

    // build excluded ids safely
    const excludedIds = [
      String(req.user.userId),
      ...((currentUser.following || []).map(String)),
      ...((currentUser.matches || []).map(String))
    ];

    // base query excludes self, following and matches
    const query = { _id: { $nin: excludedIds } };

    // require verified accounts in production
    if (process.env.NODE_ENV === 'production') {
      query.verificationStatus = 'verified';
    }

    // distance in km (query param `distance` or user preference or default 50 km)
    const distanceKm = parseFloat(req.query.distance || req.body.distance || (currentUser.preferences && currentUser.preferences.distance) || 50);

    // apply geospatial filter only when running in production (enforce distance) or when a distance param is provided
    const shouldApplyGeo = Array.isArray(currentUser.location && currentUser.location.coordinates) && currentUser.location.coordinates.length === 2;

    if (shouldApplyGeo) {
      // convert to numbers to be safe
      const coords = currentUser.location.coordinates.map(Number);

      // Only add $near if distanceKm is a positive number
      if (!Number.isNaN(distanceKm) && distanceKm > 0) {
        query.location = {
          $near: {
            $geometry: { type: 'Point', coordinates: coords },
            $maxDistance: Math.round(distanceKm * 1000)
          }
        };
      }
    }

    const users = await User.find(query)
      .select('name photos age location bio interests verificationStatus')
      .limit(30)
      .sort({ createdAt: -1 });

    return res.json(users);
  } catch (error) {
    console.error('random matches error', error);
    return res.status(500).json({ message: error.message });
  }
});

// MATCH WITH FILTERS
router.post('/match/filter', auth, async (req, res) => {
  try {
    const { ageMin, ageMax, distance, gender } = req.body;
    const currentUser = await User.findById(req.user.userId);

    if (!currentUser) return res.status(404).json({ message: 'User not found' });

    const excluded = [String(req.user.userId), ...((currentUser.following || []).map(String)), ...((currentUser.matches || []).map(String))];

    const query = { _id: { $nin: excluded } };

    if (ageMin || ageMax) {
      query.age = {};
      if (ageMin) query.age.$gte = parseInt(ageMin, 10);
      if (ageMax) query.age.$lte = parseInt(ageMax, 10);
    }

    if (gender) {
      query.gender = gender;
    }

    // always require verified in production
    if (process.env.NODE_ENV === 'production') {
      query.verificationStatus = 'verified';
    }

    // distance filter: prefer explicit request distance, then user's pref, else default 50km
    const distanceKm = parseFloat(distance || currentUser.preferences?.distance || 50);

    if (distanceKm && currentUser.location && Array.isArray(currentUser.location.coordinates) && currentUser.location.coordinates.length === 2) {
      query.location = {
        $near: {
          $geometry: { type: 'Point', coordinates: currentUser.location.coordinates.map(Number) },
          $maxDistance: Math.round(distanceKm * 1000)
        }
      };
    }

    const matches = await User.find(query)
      .select('name photos age location bio interests verificationStatus')
      .limit(50);

    res.json(matches);
  } catch (error) {
    console.error('match filter error', error);
    res.status(500).json({ message: error.message });
  }
});

// CREATE MATCH
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

    await User.findByIdAndUpdate(req.user.userId, { $push: { matches: req.params.userId } });
    await User.findByIdAndUpdate(req.params.userId, { $push: { matches: req.user.userId } });

    await Notification.create({ recipient: req.params.userId, sender: req.user.userId, type: 'match', message: 'You have a new match!' });
    await Notification.create({ recipient: req.user.userId, sender: req.user.userId, type: 'match', message: 'You have a new match!' });

    res.json({ message: 'Match created successfully', match });
  } catch (error) {
    console.error('create match error', error);
    res.status(500).json({ message: error.message });
  }
});

// GET USER'S MATCHES
router.get('/my-matches', auth, async (req, res) => {
  try {
    const currentUser = await User.findById(req.user.userId).populate('matches', 'name photos age location verificationStatus');
    res.json(currentUser.matches);
  } catch (error) {
    console.error('my-matches error', error);
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
