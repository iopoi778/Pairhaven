const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const auth = require('../middleware/auth');

router.post('/sign', auth, (req, res) => {
  try {
    const timestamp = Math.round(Date.now() / 1000);
    const folder = req.body.folder || 'pairhaven/users';

    const params = {
      folder,
      timestamp
    };

    const sorted = Object.keys(params)
      .sort()
      .map(key => `${key}=${params[key]}`)
      .join('&');

    const signature = crypto
      .createHmac('sha1', process.env.CLOUDINARY_API_SECRET)
      .update(sorted)
      .digest('hex');

    return res.json({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      timestamp,
      signature,
      folder
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

module.exports = router;