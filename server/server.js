require('dotenv').config();
const express = require('express');
const http = require('http');
const socketio = require('socket.io');
const cors = require('cors');
const connectDB = require('./config/db');
const socketHandler = require('./sockets/socketHandler');

// Connect to database
connectDB();

const app = express();
const server = http.createServer(app);
const io = socketio(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// Middleware
app.use(express.json());
app.use(cors());

// Initialize Sockets
socketHandler.init(io);

// Initialize Monitoring Engine
const monitoringService = require('./services/monitoringService');
monitoringService.init();
console.log(`[System] Time Simulation: ${process.env.ENABLE_TIME_SIMULATION === 'true' ? 'ENABLED' : 'DISABLED'}`);

// Define Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/products', require('./routes/products'));
app.use('/api/ai', require('./routes/ai'));
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/feedback', require('./routes/feedback'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/warranties', require('./routes/warranties'));
app.use('/api/payments', require('./routes/payments'));
// Serve static assets
app.use('/uploads', express.static('server/uploads'));

if (process.env.NODE_ENV === 'production') {
    app.use(express.static('client'));
} else {
    app.use(express.static('client'));
}

const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
    console.log(`Server running in ${process.env.NODE_ENV} mode on port ${PORT}`);
});
