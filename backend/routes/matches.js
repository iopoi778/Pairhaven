const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const User = require('../models/User');
const Match = require('../models/match');

router.get('/random', auth, async (req, res) => {
  try {
    const me = await User.findById(req.user.userId);

    const excludedIds = [
      req.user.userId,
      ...(me.following || []),
      ...(me.matches || [])
    ].map(String);

    const query = { _id: { $nin: excludedIds } };

    if (process.env.NODE_ENV === 'production') {
      query.verificationStatus = 'verified';
    }

    const distanceKm = parseFloat(req.query.distance || me.preferences?.distance || 50);

    if (distanceKm && me.location && Array.isArray(me.location.coordinates) && me.location.coordinates.length === 2) {
      query.location = {
        $near: {
          $geometry: {
            type: 'Point',
            coordinates: me.location.coordinates
          },
          $maxDistance: Math.round(distanceKm * 1000)
        }
      };
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

router.get('/my-matches', auth, async (req, res) => {
  try {
    const me = await User.findById(req.user.userId).populate('matches', 'name photos age location verificationStatus');
    return res.json(me.matches || []);
  } catch (error) {
    console.error('my-matches error', error);
    return res.status(500).json({ message: error.message });
  }
});

module.exports = router;
