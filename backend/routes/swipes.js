const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const User = require('../models/User');
const Match = require('../models/match');
const Notification = require('../models/Notification');

router.post('/', auth, async (req, res) => {
  try {
    const { toUserId, action } = req.body;

    if (!toUserId || !action) {
      return res.status(400).json({ message: 'toUserId and action are required' });
    }

    if (!['like', 'pass'].includes(action)) {
      return res.status(400).json({ message: 'action must be like or pass' });
    }

    const me = await User.findById(req.user.userId);
    const target = await User.findById(toUserId);

    if (!me) return res.status(404).json({ message: 'Current user not found' });
    if (!target) return res.status(404).json({ message: 'Target user not found' });

    if (action === 'pass') {
      // Optionally you can record passes
      return res.json({ message: 'Pass recorded', matched: false });
    }

    // Prevent duplicate like
    const alreadyLiked = target.likesReceived?.some(l => l.from && l.from.toString() === me._id.toString());
    if (alreadyLiked) {
      return res.status(400).json({ message: 'You already liked this user' });
    }

    // Record like on target
    target.likesReceived = target.likesReceived || [];
    target.likesReceived.push({ from: me._id, createdAt: new Date() });
    await target.save();

    // Notify target of the like
    await Notification.create({
      recipient: target._id,
      sender: me._id,
      type: 'like',
      message: `${me.name} liked you`,
      metadata: { from: me._id }
    });

    // Check reciprocal: has current user previously been liked by target?
    const isMutual = (me.likesReceived || []).some(l => l.from && l.from.toString() === target._id.toString());

    if (isMutual) {
      // Ensure a match does not already exist
      const existingMatch = await Match.findOne({
        $or: [
          { user1: me._id, user2: target._id },
          { user1: target._id, user2: me._id }
        ]
      });

      if (!existingMatch) {
        const match = new Match({ user1: me._id, user2: target._id, status: 'accepted' });
        await match.save();

        // push match ids into users (avoid duplicates)
        me.matches = me.matches || [];
        target.matches = target.matches || [];
        if (!me.matches.find(id => id.toString() === target._id.toString())) me.matches.push(target._id);
        if (!target.matches.find(id => id.toString() === me._id.toString())) target.matches.push(me._id);

        await me.save();
        await target.save();

        // create notifications for both
        await Notification.create({
          recipient: target._id,
          sender: me._id,
          type: 'match',
          message: `You matched with ${me.name}`,
          metadata: { matchId: match._id, userId: me._id }
        });

        await Notification.create({
          recipient: me._id,
          sender: target._id,
          type: 'match',
          message: `You matched with ${target.name}`,
          metadata: { matchId: match._id, userId: target._id }
        });

        return res.json({ message: 'Match created', matched: true, matchId: match._id });
      }
    }

    return res.json({ message: 'Like recorded', matched: false });
  } catch (error) {
    console.error('Swipe error', error);
    return res.status(500).json({ message: error.message });
  }
});

module.exports = router;
