const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Please add a name']
    },
    email: {
        type: String,
        required: [true, 'Please add an email'],
        unique: true,
        match: [
            /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/,
            'Please add a valid email'
        ]
    },
    password: {
        type: String,
        required: [true, 'Please add a password'],
        minlength: 6,
        select: false
    },
    isAdmin: {
        type: Boolean,
        default: false
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    resetPasswordOTP: String,
    resetPasswordExpire: Date,
    plan: {
        type: String,
        enum: ['free', 'pro', 'premium'],
        default: 'free'
    },
    usage: {
        products: { type: Number, default: 0 },
        aiRequests: { type: Number, default: 0 },
        storage: { type: Number, default: 0 } // in bytes
    },
    limits: {
        products: { type: Number, default: 5 },
        aiRequests: { type: Number, default: 10 },
        storage: { type: Number, default: 52428800 } // 50MB in bytes
    },
    subscription: {
        status: { type: String, enum: ['active', 'inactive', 'past_due'], default: 'inactive' },
        razorpayOrderId: String,
        razorpayPaymentId: String,
        lastPaymentDate: Date,
        expiryDate: Date
    }
});

// Encrypt password using bcrypt
userSchema.pre('save', async function() {
    if (!this.isModified('password')) {
        return;
    }
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
});

// Match user entered password to hashed password in database
userSchema.methods.matchPassword = async function(enteredPassword) {
    return await bcrypt.compare(enteredPassword, this.password);
};

module.exports = mongoose.model('User', userSchema);
