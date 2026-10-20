module.exports = function(io) {
  const userSockets = new Map();

  io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    socket.on('join', (userId) => {
      if (userId) {
        userSockets.set(userId.toString(), socket.id);
        console.log(`✅ User ${userId} registered with socket ID ${socket.id}`);
      }
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

        const receiverSocketId = userSockets.get(data.receiverId?.toString());
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
      const receiverSocketId = userSockets.get(data.receiverId?.toString());
      if (receiverSocketId) {
        io.to(receiverSocketId).emit('userTyping', {
          userId: data.senderId,
          isTyping: data.isTyping
        });
      }
    });

    // ✅ ROBUST CALL SIGNAL HANDLER
    socket.on('start-call', (data) => {
      const { recipientId } = data;
      const receiverSocketId = userSockets.get(recipientId?.toString());
      
      if (receiverSocketId) {
        console.log(`📞 Forwarding call to user ${recipientId} at socket ${receiverSocketId}`);
        io.to(receiverSocketId).emit('incoming-call', data);
      } else {
        console.log(`⚠️ User ${recipientId} not found in userSockets map. Active sessions:`, Array.from(userSockets.keys()));
      }
    });

    socket.on('end-call', (data) => {
      const { recipientId } = data;
      const receiverSocketId = userSockets.get(recipientId?.toString());
      if (receiverSocketId) {
        io.to(receiverSocketId).emit('call-ended', data);
      }
    });

    socket.on('disconnect', () => {
      for (const [userId, socketId] of userSockets.entries()) {
        if (socketId === socket.id) {
          userSockets.delete(userId);
          console.log(`🔌 User ${userId} disconnected`);
          break;
        }
      }
    });
  });
};
