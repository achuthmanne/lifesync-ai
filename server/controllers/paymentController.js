const Razorpay = require('razorpay');
const crypto = require('crypto');
const User = require('../models/User');

const instance = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET
});

const PLAN_PRICES = {
    pro: 499,
    premium: 999
};

const PLAN_LIMITS = {
    free: { products: 5, aiRequests: 50, storage: 52428800 },
    pro: { products: 100, aiRequests: 200, storage: 1073741824 },
    premium: { products: 999999, aiRequests: 999999, storage: 10737418240 }
};

exports.getConfig = (req, res) => {
    res.json({
        success: true,
        key: process.env.RAZORPAY_KEY_ID
    });
};

exports.createOrder = async (req, res) => {
    try {
        const { plan } = req.body;
        
        if (!PLAN_PRICES[plan]) {
            return res.status(400).json({ success: false, message: 'Invalid plan selected' });
        }

        const options = {
            amount: PLAN_PRICES[plan] * 100,
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
        res.status(500).json({ success: false, message: 'Payment gateway error' });
    }
};

exports.verifyPayment = async (req, res) => {
    try {
        const {
            razorpay_order_id,
            razorpay_payment_id,
            razorpay_signature,
            plan
        } = req.body;

        const generatedSignature = crypto
            .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
            .update(razorpay_order_id + "|" + razorpay_payment_id)
            .digest('hex');

        if (generatedSignature !== razorpay_signature) {
            return res.status(400).json({ success: false, message: 'Payment verification failed' });
        }

        // Update user
        const expiryDate = new Date();
        expiryDate.setFullYear(expiryDate.getFullYear() + 1); // 1 year validity

        const user = await User.findByIdAndUpdate(req.user.id, {
            plan: plan,
            limits: PLAN_LIMITS[plan],
            subscription: {
                status: 'active',
                razorpayOrderId: razorpay_order_id,
                razorpayPaymentId: razorpay_payment_id,
                lastPaymentDate: new Date(),
                expiryDate: expiryDate
            }
        }, { new: true });

        res.json({
            success: true,
            message: `Successfully upgraded to ${plan.toUpperCase()}`,
            data: user
        });

    } catch (error) {
        console.error('Payment verification error:', error);
        res.status(500).json({ success: false, message: 'Server error during verification' });
    }
};

exports.handleWebhook = async (req, res) => {
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
    const signature = req.headers['x-razorpay-signature'];

    const expectedSignature = crypto
        .createHmac('sha256', webhookSecret)
        .update(JSON.stringify(req.body))
        .digest('hex');

    if (expectedSignature === signature) {
        const event = req.body.event;
        const payload = req.body.payload.payment.entity;

        if (event === 'payment.captured') {
            const userId = payload.notes.userId;
            const plan = payload.notes.plan;

            const expiryDate = new Date();
            expiryDate.setFullYear(expiryDate.getFullYear() + 1);

            await User.findByIdAndUpdate(userId, {
                plan: plan,
                limits: PLAN_LIMITS[plan],
                subscription: {
                    status: 'active',
                    razorpayOrderId: payload.order_id,
                    razorpayPaymentId: payload.id,
                    lastPaymentDate: new Date(),
                    expiryDate: expiryDate
                }
            });
        }
        res.status(200).send('OK');
    } else {
        res.status(400).send('Invalid signature');
    }
};
