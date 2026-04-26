require('dotenv').config();
const express = require('express');
const http = require('http');
const socketio = require('socket.io');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const connectDB = require('./server/config/db');
const socketHandler = require('./server/sockets/socketHandler');

// 1. Verify and List Required Environment Variables
const requiredEnv = [
    'MONGO_URI',
    'EMAIL_USER',
    'EMAIL_PASSWORD',
    'GOOGLE_CLIENT_ID',
    'GROQ_API_KEY',
    'GEMINI_API_KEY'
];

console.log('--- Environment Check ---');
requiredEnv.forEach(env => {
    let exists = false;
    if (env === 'MONGO_URI') {
        exists = !!(process.env.MONGO_URI || process.env.MONGODB_URI);
    } else {
        exists = !!process.env[env];
    }
    
    if (exists) {
        console.log(`[OK] ${env} is set`);
    } else {
        console.warn(`[MISSING] ${env} is NOT set`);
    }
});
console.log('-------------------------');

// 2. MongoDB Connection
connectDB();

const app = express();
const server = http.createServer(app);

// 3. Socket.io setup (using same config as original)
const io = socketio(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// 4. Middleware
app.use(express.json());
app.use(cors());

// Initialize Sockets
socketHandler.init(io);

// Initialize Monitoring Engine
const monitoringService = require('./server/services/monitoringService');
monitoringService.init();

// 5. API Routes
app.use('/api/auth', require('./server/routes/auth'));
app.use('/api/products', require('./server/routes/products'));
app.use('/api/ai', require('./server/routes/ai'));
app.use('/api/notifications', require('./server/routes/notifications'));
app.use('/api/feedback', require('./server/routes/feedback'));
app.use('/api/admin', require('./server/routes/admin'));
app.use('/api/warranties', require('./server/routes/warranties'));

// 6. Serve static uploads
app.use('/uploads', express.static(path.join(__dirname, 'server/uploads')));

// 7. Serve Static Frontend (Support for 'public' and 'client')
// We check for 'public' first as per user request, fallback to 'client'
const publicPath = path.join(__dirname, 'public');
const clientPath = path.join(__dirname, 'client');

if (fs.existsSync(publicPath)) {
    console.log('[Static] Serving from public folder');
    app.use(express.static(publicPath));
} else if (fs.existsSync(clientPath)) {
    console.log('[Static] Serving from client folder');
    app.use(express.static(clientPath));
} else {
    console.warn('[Static] Warning: Neither "public" nor "client" folder found!');
}

// 8. Catch-all route for SPA (Final middleware)
app.use((req, res) => {
    const targetPath = fs.existsSync(publicPath) ? publicPath : clientPath;
    if (fs.existsSync(path.join(targetPath, 'index.html'))) {
        res.sendFile(path.join(targetPath, 'index.html'));
    } else {
        res.status(404).json({ success: false, message: 'Not Found' });
    }
});

// 9. Production Error Handling Middleware
app.use((err, req, res, next) => {
    console.error(`[Fatal Error] ${err.message}`);
    if (process.env.NODE_ENV !== 'production') {
        console.error(err.stack);
    }
    res.status(500).json({
        success: false,
        message: 'Something went wrong on the server',
        error: process.env.NODE_ENV === 'production' ? {} : err.message
    });
});

// 9. PORT Configuration
const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
    console.log(`[Server] LifeSync AI running on port ${PORT}`);
    console.log(`[Server] Environment: ${process.env.NODE_ENV || 'development'}`);
});

// Prevent app crash on unhandled errors
process.on('unhandledRejection', (reason, promise) => {
    console.error('[Unhandled Rejection] at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (err) => {
    console.error(`[Uncaught Exception] ${err.message}`);
    // Optional: exit if the state is corrupted
    // process.exit(1);
});
