// backend/socketHandlers.js
module.exports = function(io) {
  const userSockets = new Map();

  io.on('connection', (socket) => {
    console.log('Socket connected', socket.id);

    socket.on('join', (userId) => {
      userSockets.set(userId, socket.id);
      console.log(`User ${userId} joined socket ${socket.id}`);
    });

    socket.on('sendMessage', async (data) => {
      // data: { senderId, receiverId, content }
      // persist message
      try {
        const Message = require('./models/Message');
        const msg = await Message.create({ sender: data.senderId, receiver: data.receiverId, content: data.content });
        const receiverSocketId = userSockets.get(data.receiverId);
        if (receiverSocketId) {
          io.to(receiverSocketId).emit('newMessage', msg);
        }
        // ack sender
        socket.emit('messageSent', msg);
      } catch (err) {
        console.error('sendMessage error', err);
      }
    });

    socket.on('disconnect', () => {
      for (const [userId, sid] of userSockets.entries()) {
        if (sid === socket.id) userSockets.delete(userId);
      }
    });
  });
};
