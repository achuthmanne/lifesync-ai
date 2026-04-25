require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./server/models/User');

const promoteAllToAdmin = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to MongoDB...');

        const result = await User.updateMany({}, { isAdmin: true });
        console.log(`Successfully promoted ${result.modifiedCount} users to Admin.`);
        
        process.exit(0);
    } catch (err) {
        console.error('Error:', err.message);
        process.exit(1);
    }
};

promoteAllToAdmin();
