const express = require('express');
const router = express.Router();
const axios = require('axios');
const User = require('../models/User');
const auth = require('../middleware/auth');

// POST /api/payments/verify-flutterwave
router.post('/verify-flutterwave', auth, async (req, res) => {
  try {
    const { transactionId, plan } = req.body;

    if (!['pro', 'unlimited'].includes(plan)) {
      return res.status(400).json({ message: 'Invalid membership plan selected.' });
    }

    // Verify transaction with Flutterwave API
    const flwResponse = await axios.get(
      `https://api.flutterwave.com/v3/transactions/${transactionId}/verify`,
      {
        headers: {
          Authorization: `Bearer ${process.env.FLUTTERWAVE_SECRET_KEY}`
        }
      }
    );

    const transactionData = flwResponse.data;

    // Check if transaction was successful
    if (transactionData.status === 'success' && transactionData.data.status === 'successful') {
      
      // Update user membership in MongoDB
      const updatedUser = await User.findByIdAndUpdate(
        req.user.userId,
        { 
          membershipTier: plan,
          isVip: true 
        },
        { new: true }
      ).select('-password');

      if (!updatedUser) {
        return res.status(404).json({ message: 'User not found.' });
      }

      return res.json({ 
        message: 'Payment verified and membership upgraded successfully!', 
        user: updatedUser 
      });
    } else {
      return res.status(400).json({ message: 'Flutterwave transaction verification failed.' });
    }
  } catch (error) {
    console.error('Flutterwave Verification Error:', error.response?.data || error.message);
    res.status(500).json({ message: 'Server error during payment verification.' });
  }
});

module.exports = router;
