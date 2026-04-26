const mongoose = require('mongoose');

const connectDB = async () => {
    try {
        const dbUri = process.env.MONGO_URI || process.env.MONGODB_URI;
        if (!dbUri) {
            console.error('Error: MONGO_URI or MONGODB_URI is not defined in environment variables');
            process.exit(1);
        }
        const conn = await mongoose.connect(dbUri);
        console.log(`[Database] MongoDB Connected: ${conn.connection.host}`);
    } catch (error) {
        console.error(`[Database] Connection Error: ${error.message}`);
        // In production, we might want to retry instead of exiting immediately, 
        // but Render will restart the service if it exits.
        process.exit(1);
    }
};

module.exports = connectDB;
