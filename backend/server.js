const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const matchRoutes = require('./routes/matches');
const postRoutes = require('./routes/posts');
const commentRoutes = require('./routes/comments');
const messageRoutes = require('./routes/messages');
const notificationRoutes = require('./routes/notifications');
const profileRoutes = require('./routes/profile');
const uploadsRoutes = require('./routes/uploads');
const swipesRoutes = require('./routes/swipes');
const adminRoutes = require('./routes/admin'); // ✅ Admin & Support Routes

const socketHandlers = require('./socketHandlers');
const User = require('./models/User');

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL || '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE']
  }
});

// ✅ Make io accessible globally via Express app for real-time popups
app.set('io', io);

// ✅ Initialize Socket handlers
socketHandlers(io);

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

app.get('/api/health', (req, res) => {
  res.json({ ok: true, service: 'PairHaven API' });
});

async function createDefaultAdmin() {
  try {
    const adminEmail = process.env.ADMIN_EMAIL || 'admin@pairhaven.com';
    const adminPassword = process.env.ADMIN_PASSWORD || 'AdminSecure123!';

    const existingAdmin = await User.findOne({ email: adminEmail });
    const hashedPassword = await bcrypt.hash(adminPassword, 10);
    
    if (!existingAdmin) {
      await User.create({
        name: 'PairHaven Support',
        email: adminEmail,
        password: hashedPassword,
        phone: 'admin_support_001',
        age: 1,
        gender: 'other',
        role: 'admin',
        verificationStatus: 'verified', // ✅ Permanent verified badge
        membershipTier: 'unlimited',
        isVip: true,
        photos: [{ url: 'https://via.placeholder.com/150', isPrimary: true }],
        location: { type: 'Point', coordinates: [0, 0] }
      });
      console.log(`✅ Default Admin account created with verified badge!`);
    } else {
      existingAdmin.role = 'admin';
      existingAdmin.verificationStatus = 'verified'; // ✅ Force verified badge on boot
      existingAdmin.membershipTier = 'unlimited';
      existingAdmin.isVip = true;
      await existingAdmin.save();
    }
  } catch (err) {
    console.error('Failed to create default admin account:', err);
  }
}

// Register API Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/matches', matchRoutes);
app.use('/api/posts', postRoutes);
app.use('/api/comments', commentRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/users', profileRoutes);
app.use('/api/uploads', uploadsRoutes);
app.use('/api/swipes', swipesRoutes);
app.use('/api/admin', adminRoutes); // ✅ Mounted Admin Endpoints
app.use('/api/notifications', require('./routes/notifications'));

// Global Error Handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: 'Something went wrong!' });
});

// Connect to MongoDB and start server
mongoose.connect(process.env.MONGODB_URI)
  .then(async () => {
    console.log('✅ Connected to MongoDB');
    
    // Seed the default admin/support account on boot
    await createDefaultAdmin();

    const PORT = process.env.PORT || 5000;
    server.listen(PORT, () => {
      console.log(`PairHaven server running on port ${PORT}`);
    });
  })
  .catch(err => console.error('❌ MongoDB connection error:', err));

module.exports = { app, io, server };
