const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const multer = require('multer');

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// Photo storage configuration
const photoStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'pairhaven/photos',
    allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
    transformation: [{ width: 800, height: 800, crop: 'limit' }]
  }
});

// Video storage configuration
const videoStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'pairhaven/videos',
    resource_type: 'video',
    allowed_formats: ['mp4', 'mov', 'avi']
  }
});

const uploadPhotos = multer({ 
  storage: photoStorage,
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB
});

const uploadVideo = multer({ 
  storage: videoStorage,
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB
});

module.exports = { uploadPhotos, uploadVideo };