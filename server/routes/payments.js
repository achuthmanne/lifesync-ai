const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const crypto = require('crypto');
const User = require('../models/User');

// Temporary in-memory fallback if razorpay isn't installed natively
// The user might need to run `npm install razorpay`
let Razorpay;
try {
    Razorpay = require('razorpay');
} catch (e) {
    console.warn('Razorpay package not found. Please run `npm install razorpay`');
}

// Map plans to prices (in INR)
const PLAN_PRICES = {
    pro: 499,
    premium: 999
};

// Map plans to limits
const PLAN_LIMITS = {
    free: { products: 5, aiRequests: 10, storage: 52428800 },
    pro: { products: 100, aiRequests: 200, storage: 1073741824 },
    premium: { products: 999999, aiRequests: 999999, storage: 10737418240 }
};

// @route   GET /api/payments/config
// @desc    Get Razorpay Key ID
// @access  Public
router.get('/config', (req, res) => {
    res.json({
        success: true,
        key: process.env.RAZORPAY_KEY_ID || 'rzp_test_YOUR_KEY_HERE'
    });
});

// @route   POST /api/payments/create-order
// @desc    Create Razorpay Order
// @access  Private
router.post('/create-order', protect, async (req, res) => {
    try {
        const { plan } = req.body;
        
        if (!PLAN_PRICES[plan]) {
            return res.status(400).json({ success: false, message: 'Invalid plan selected' });
        }

        if (!Razorpay) {
            return res.status(500).json({ success: false, message: 'Razorpay package not installed on server.' });
        }

        const instance = new Razorpay({
            key_id: process.env.RAZORPAY_KEY_ID || 'rzp_test_YOUR_KEY_HERE',
            key_secret: process.env.RAZORPAY_KEY_SECRET || 'YOUR_SECRET_HERE'
        });

        const options = {
            amount: PLAN_PRICES[plan] * 100, // amount in smallest currency unit (paise)
            currency: 'INR',
            receipt: `rcpt_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
            notes: {
                userId: req.user._id.toString(),
                plan: plan
            }
        };

        const order = await instance.orders.create(options);

        res.json({
            success: true,
            order
        });
    } catch (error) {
        console.error('Error creating order:', error);
        let errorMsg = 'Unknown Payment Error';
        if (error.error && error.error.description) {
            errorMsg = error.error.description;
        } else if (error.message) {
            errorMsg = error.message;
        }
        res.status(500).json({ success: false, message: 'Razorpay Error: ' + errorMsg });
    }
});

// @route   POST /api/payments/verify
// @desc    Verify Razorpay Payment and Upgrade Plan
// @access  Private
router.post('/verify', protect, async (req, res) => {
    try {
        const {
            razorpay_order_id,
            razorpay_payment_id,
            razorpay_signature,
            plan
        } = req.body;

        const secret = process.env.RAZORPAY_KEY_SECRET || 'YOUR_SECRET_HERE';

        // Create HMAC
        const hmac = crypto.createHmac('sha256', secret);
        hmac.update(razorpay_order_id + "|" + razorpay_payment_id);
        const generatedSignature = hmac.digest('hex');

        if (generatedSignature !== razorpay_signature) {
            return res.status(400).json({ success: false, message: 'Payment verification failed' });
        }

        // Signature is valid, upgrade the user
        if (!PLAN_LIMITS[plan]) {
            return res.status(400).json({ success: false, message: 'Invalid plan' });
        }

        const user = await User.findById(req.user.id);
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        user.plan = plan;
        user.limits = PLAN_LIMITS[plan];

        await user.save();

        res.json({
            success: true,
            message: `Successfully upgraded to ${plan.toUpperCase()}`,
            data: user
        });

    } catch (error) {
        console.error('Payment verification error:', error);
        res.status(500).json({ success: false, message: 'Server error during payment verification' });
    }
});

module.exports = router;
