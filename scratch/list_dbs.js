const mongoose = require('mongoose');

async function listDBs() {
    try {
        await mongoose.connect('mongodb://127.0.0.1:27017');
        const admin = new mongoose.mongo.Admin(mongoose.connection.db);
        const dbs = await admin.listDatabases();
        console.log('Available Databases:');
        dbs.databases.forEach(db => console.log(` - ${db.name}`));
        process.exit(0);
    } catch (err) {
        console.error('Error connecting to local MongoDB:', err.message);
        process.exit(1);
    }
}

listDBs();
