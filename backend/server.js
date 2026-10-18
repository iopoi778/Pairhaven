const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const http = require('http');
const socketIo = require('socket.io');
require('dotenv').config();

// Import routes
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const matchRoutes = require('./routes/matches');
const postRoutes = require('./routes/posts');
const commentRoutes = require('./routes/comments');
const messageRoutes = require('./routes/messages');
const notificationRoutes = require('./routes/notifications');

// New routes for profile/photo/swipe flow
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

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health-check
app.get('/api/health', (req, res) => {
  res.json({ ok: true, service: 'PairHaven API' });
});

// Database connection
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('✅ Connected to MongoDB'))
  .catch(err => console.error('❌ MongoDB connection error:', err));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes); // existing user routes
app.use('/api/matches', matchRoutes);
app.use('/api/posts', postRoutes);
app.use('/api/comments', commentRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/notifications', notificationRoutes);

// New profile/photo/swipe endpoints
app.use('/api/users', profileRoutes);   // GET /api/users/profile
app.use('/api/uploads', uploadsRoutes); // POST /api/uploads/sign
app.use('/api/swipes', swipesRoutes);   // POST /api/swipes

// Socket.IO setup
socketHandlers(io);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: 'Something went wrong!' });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`PairHaven server running on port ${PORT}`);
});

module.exports = { app, io };
