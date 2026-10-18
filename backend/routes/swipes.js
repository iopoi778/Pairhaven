// backend/routes/swipes.js
const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const User = require('../models/User');
const Match = require('../models/match');
const Notification = require('../models/Notification');

// POST /swipe -> { toUserId, action: 'like'|'pass' }
router.post('/', auth, async (req, res) => {
  try {
    const { toUserId, action } = req.body;
    if (!toUserId || !action) return res.status(400).json({ message: 'Missing fields' });

    const target = await User.findById(toUserId);
    const me = await User.findById(req.user.userId);
    if (!target) return res.status(404).json({ message: 'User not found' });

    if (action === 'like') {
      // Prevent duplicate likes
      const already = target.likesReceived.find(l => l.from.toString() === req.user.userId);
      if (already) return res.status(400).json({ message: 'Already liked' });

      target.likesReceived.push({ from: req.user.userId });
      await target.save();

      // Notify target
      await Notification.create({ recipient: toUserId, sender: req.user.userId, type: 'like', message: `${me.name} liked you` });

      // Check if reciprocal
      const reciprocal = me.likesReceived && me.likesReceived.find(l => l.from.toString() === toUserId);
      if (reciprocal) {
        // create match if not exists
        const exists = await Match.findOne({ $or: [ { user1: me._id, user2: target._id }, { user1: target._id, user2: me._id } ] });
        if (!exists) {
          const match = new Match({ user1: me._id, user2: target._id, status: 'accepted' });
          await match.save();

          me.matches.push(target._id);
          target.matches.push(me._id);
          await me.save();
          await target.save();

          await Notification.create({ recipient: toUserId, sender: req.user.userId, type: 'match', message: 'You have a new match!' });
          await Notification.create({ recipient: req.user.userId, sender: req.user.userId, type: 'match', message: 'You have a new match!' });

          return res.json({ message: 'Match created', matchId: match._id, matchedWith: toUserId });
        }
      }

      return res.json({ message: 'Liked' });
    }

    // pass action - we currently do nothing server-side besides maybe logging
    return res.json({ message: 'Passed' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
