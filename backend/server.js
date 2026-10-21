const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const http = require('http');
const socketIo = require('socket.io');
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

const socketHandlers = require('./socketHandlers');

const app = express();
const server = http.createServer(app);

const io = socketIo(server, {
  cors: {
    origin: process.env.CLIENT_URL || 'http://localhost:3000',
    methods: ['GET', 'POST']
  }
});

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/api/health', (req, res) => {
  res.json({ ok: true, service: 'PairHaven API' });
});

mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('✅ Connected to MongoDB'))
  .catch(err => console.error('❌ MongoDB connection error:', err));

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

socketHandlers(io);

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: 'Something went wrong!' });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`PairHaven server running on port ${PORT}`);
});
const bcrypt = require('bcryptjs');
const User = require('./models/User'); // Adjust path to your User model

async function createDefaultAdmin() {
  try {
    const adminEmail = process.env.ADMIN_EMAIL || 'admin@pairhaven.com';
    const adminPassword = process.env.ADMIN_PASSWORD || 'AdminSecure123!';

    const existingAdmin = await User.findOne({ email: adminEmail });
    
    if (!existingAdmin) {
      const hashedPassword = await bcrypt.hash(adminPassword, 10);
      
      await User.create({
        name: 'PairHaven Support',
        email: adminEmail,
        password: hashedPassword,
        phone: 'admin_support_001',
        age: 30,
        gender: 'other',
        role: 'admin', // Sets them as an admin automatically
        verificationStatus: 'verified',
        membershipTier: 'unlimited',
        isVip: true,
        photos: [{ url: 'https://via.placeholder.com/150', isPrimary: true }],
        location: { type: 'Point', coordinates: [0, 0] }
      });
      
      console.log(`✅ Default Admin account created successfully! Email: ${adminEmail}`);
    } else {
      // Ensure existing account has admin role if it was a regular user before
      if (existingAdmin.role !== 'admin') {
        existingAdmin.role = 'admin';
        await existingAdmin.save();
        console.log(`✅ Updated existing account ${adminEmail} to admin role.`);
      }
    }
  } catch (err) {
    console.error('Failed to create default admin account:', err);
  }
}
module.exports = { app, io };
