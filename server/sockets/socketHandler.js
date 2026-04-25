let io;
const userSockets = new Map(); // Map to store userId -> socketId

exports.init = (socketIo) => {
    io = socketIo;

    io.on('connection', (socket) => {
        console.log('New client connected:', socket.id);

        socket.on('authenticate', (userId) => {
            userSockets.set(userId, socket.id);
            console.log(`User ${userId} authenticated on socket ${socket.id}`);
        });

        socket.on('disconnect', () => {
            for (let [userId, socketId] of userSockets.entries()) {
                if (socketId === socket.id) {
                    userSockets.delete(userId);
                    break;
                }
            }
            console.log('Client disconnected:', socket.id);
        });
    });
};

exports.notifyUser = (userId, event, data) => {
    const socketId = userSockets.get(userId.toString());
    if (socketId && io) {
        io.to(socketId).emit(event, data);
    }
};

exports.broadcastToUser = (userId, message) => {
    const socketId = userSockets.get(userId.toString());
    if (socketId && io) {
        io.to(socketId).emit('notification', {
            message,
            time: new Date()
        });
    }
};
