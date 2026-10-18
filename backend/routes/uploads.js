// backend/routes/uploads.js
const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const { cloudinary } = require('../services/cloudinary');
const auth = require('../middleware/auth');

// Server-signed Cloudinary params for direct upload
router.post('/sign', auth, (req, res) => {
  const timestamp = Math.round(new Date().getTime() / 1000);
  // optional params from client
  const paramsToSign = { timestamp };
  if (req.body.folder) paramsToSign.folder = req.body.folder;

  // create signature string
  const signString = Object.keys(paramsToSign).sort().map((k) => `${k}=${paramsToSign[k]}`).join('&');
  const signature = crypto.createHash('sha1').update(signString + process.env.CLOUDINARY_API_SECRET).digest('hex');

  res.json({
    signature,
    api_key: process.env.CLOUDINARY_API_KEY,
    timestamp,
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME
  });
});

module.exports = router;
