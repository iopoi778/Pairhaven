// backend/services/cloudinary.js
const cloudinary = require('cloudinary').v2;

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

function uploadBuffer(buffer, options = {}) {
  return new Promise((resolve, reject) => {
    const streamifier = require('streamifier');
    const uploadStream = cloudinary.uploader.upload_stream(options, (err, result) => {
      if (err) return reject(err);
      resolve(result);
    });
    streamifier.createReadStream(buffer).pipe(uploadStream);
  });
}

async function destroy(public_id) {
  try {
    return await cloudinary.uploader.destroy(public_id);
  } catch (err) {
    throw err;
  }
}

module.exports = { cloudinary, uploadBuffer, destroy };
