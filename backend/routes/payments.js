const express = require('express');
const router = express.Router();
const Stripe = require('stripe');
const User = require('../models/User'); // Adjust path to your User model if needed
const auth = require('../middleware/auth'); // Your authentication middleware

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// POST /api/payments/create-checkout-session
router.post('/create-checkout-session', auth, async (req, res) => {
  try {
    const { plan } = req.body; // 'pro' ($2) or 'unlimited' ($5)
    
    let amount = 0;
    let planName = '';

    if (plan === 'pro') {
      amount = 200; // $2.00 in cents
      planName = 'Pro Membership';
    } else if (plan === 'unlimited') {
      amount = 500; // $5.00 in cents
      planName = 'Unlimited Membership';
    } else {
      return res.status(400).json({ message: 'Invalid subscription plan selected.' });
    }

    const frontendUrl = process.env.FRONTEND_URL || 'https://pairhaven-frontend.onrender.com';

    // Create Stripe Checkout Session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: `PairHaven ${planName}`,
            },
            unit_amount: amount,
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: `${frontendUrl}/#/?payment=success&plan=${plan}`,
      cancel_url: `${frontendUrl}/#/?payment=cancelled`,
      metadata: {
        userId: req.user.userId,
        plan: plan
      }
    });

    res.json({ url: session.url });
  } catch (error) {
    console.error('Stripe Checkout Error:', error);
    res.status(500).json({ message: error.message });
  }
});

// Optional: Webhook or success endpoint to finalize the tier upgrade
router.post('/verify-success', auth, async (req, res) => {
  try {
    const { plan } = req.body;
    const userId = req.user.userId;

    if (!['pro', 'unlimited'].includes(plan)) {
      return res.status(400).json({ message: 'Invalid plan' });
    }

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { 
        membershipTier: plan,
        isVip: true 
      },
      { new: true }
    ).select('-password');

    res.json({ message: 'Membership upgraded successfully!', user: updatedUser });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
