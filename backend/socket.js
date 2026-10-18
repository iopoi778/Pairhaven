const socketIo = require('socket.io');

function initializeSocket(server) {
  const io = socketIo(server, {
    cors: { origin: process.env.CLIENT_URL || "http://localhost:3000", methods: ["GET", "POST"] }
  });

  io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    // Join a private chat room
    socket.on('joinChat', (roomId) => {
      socket.join(roomId);
    });

    // Send message
    socket.on('sendMessage', async (data) => {
      // Save message to MongoDB first
      // Then emit to room
      io.to(data.roomId).emit('receiveMessage', data);
    });

    socket.on('disconnect', () => {
      console.log('User disconnected');
    });
  });
}

module.exports = initializeSocket;