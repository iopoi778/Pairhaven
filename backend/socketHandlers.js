module.exports = function(io) {
  const userSockets = new Map();

  io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    socket.on('join', (userId) => {
      userSockets.set(userId, socket.id);
      console.log(`User ${userId} joined socket ${socket.id}`);
    });

    socket.on('sendMessage', async (data) => {
      try {
        const Message = require('./models/Message');
        const Notification = require('./models/Notification');

        const msg = await Message.create({
          sender: data.senderId,
          receiver: data.receiverId,
          content: data.content
        });

        await Notification.create({
          recipient: data.receiverId,
          sender: data.senderId,
          type: 'message',
          message: 'New message received',
          metadata: { messageId: msg._id }
        });

        const receiverSocketId = userSockets.get(data.receiverId);
        if (receiverSocketId) {
          io.to(receiverSocketId).emit('newMessage', {
            ...msg.toObject(),
            senderId: data.senderId,
            receiverId: data.receiverId
          });
        }

        socket.emit('messageSent', {
          ...msg.toObject(),
          senderId: data.senderId,
          receiverId: data.receiverId
        });
      } catch (error) {
        console.error('Socket sendMessage error', error);
      }
    });

    socket.on('typing', (data) => {
      const receiverSocketId = userSockets.get(data.receiverId);
      if (receiverSocketId) {
        io.to(receiverSocketId).emit('userTyping', {
          userId: data.senderId,
          isTyping: data.isTyping
        });
      }
    });

    socket.on('disconnect', () => {
      for (const [userId, socketId] of userSockets.entries()) {
        if (socketId === socket.id) {
          userSockets.delete(userId);
          break;
        }
      }
    });
  });
};
