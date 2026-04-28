const User = require('../models/User');
const jwt = require('jsonwebtoken');
const sendEmail = require('../utils/sendEmail');

// @desc    Register user
// @route   POST /api/auth/register
// @access  Public
exports.register = async (req, res) => {
    try {
        const { name, email, password } = req.body;

        const userExists = await User.findOne({ email });
        if (userExists) {
            return res.status(400).json({ success: false, message: 'User already exists' });
        }

        const user = await User.create({ name, email, password });
        const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '30d' });

        res.status(201).json({
            success: true,
            token,
            user: { id: user._id, name: user.name, email: user.email }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
exports.login = async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ success: false, message: 'Please provide email and password' });
        }

        const user = await User.findOne({ email }).select('+password');
        if (!user || !(await user.matchPassword(password))) {
            return res.status(401).json({ success: false, message: 'Invalid credentials' });
        }

        const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '30d' });

        res.status(200).json({
            success: true,
            token,
            user: { id: user._id, name: user.name, email: user.email }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Google Login
// @route   POST /api/auth/google
// @access  Public
exports.googleLogin = async (req, res) => {
    try {
        const { credential } = req.body;
        
        // Verify with Google
        const response = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${credential}`);
        const googleUser = await response.json();

        if (googleUser.error) {
            return res.status(400).json({ success: false, message: 'Invalid Google token' });
        }

        const { email, name, sub: googleId, picture } = googleUser;

        // Find or create user
        let user = await User.findOne({ email });

        if (!user) {
            // Create user without password (social login)
            user = await User.create({
                name,
                email,
                password: Math.random().toString(36).slice(-12), // Random password for security
                googleId
            });
        }

        const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '30d' });

        res.status(200).json({
            success: true,
            token,
            user: { id: user._id, name: user.name, email: user.email }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Forgot Password - Send OTP via Real Email
// @route   POST /api/auth/forgotpassword
// @access  Public
exports.forgotPassword = async (req, res) => {
    try {
        const { email } = req.body;
        const user = await User.findOne({ email });

        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        // Generate 6-digit OTP
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        
        user.resetPasswordOTP = otp;
        user.resetPasswordExpire = Date.now() + 10 * 60 * 1000; // 10 minutes
        await user.save();

        // Send Real Email
        const message = `Your password reset code is: ${otp}. It will expire in 10 minutes.`;
        const html = `
            <div style="font-family: Arial, sans-serif; padding: 20px; border: 1px solid #eee; border-radius: 10px; max-width: 500px;">
                <h2 style="color: #6366f1;">LifeSync AI | Password Reset</h2>
                <p>Hello,</p>
                <p>You requested to reset your password. Please use the verification code below:</p>
                <div style="font-size: 32px; font-weight: bold; letter-spacing: 5px; color: #6366f1; text-align: center; margin: 30px 0; background: #f8fafc; padding: 20px; border-radius: 8px;">
                    ${otp}
                </div>
                <p style="color: #64748b; font-size: 14px;">This code will expire in 10 minutes. If you didn't request this, please ignore this email.</p>
                <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
                <p style="font-size: 12px; color: #94a3b8; text-align: center;">© 2026 LifeSync AI. All rights reserved.</p>
            </div>
        `;

        try {
            await sendEmail({
                email: user.email,
                subject: 'Your Password Reset Code - LifeSync AI',
                message,
                html
            });

            res.status(200).json({ success: true, message: 'Verification code sent to your email' });
        } catch (err) {
            console.error('Email send error:', err);
            user.resetPasswordOTP = undefined;
            user.resetPasswordExpire = undefined;
            await user.save();
            return res.status(500).json({ success: false, message: 'Email could not be sent. Please check your SMTP configuration.' });
        }
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Reset Password - Verify OTP
// @route   POST /api/auth/resetpassword
// @access  Public
exports.resetPassword = async (req, res) => {
    try {
        const { email, otp, newPassword } = req.body;
        
        const user = await User.findOne({ 
            email,
            resetPasswordOTP: otp,
            resetPasswordExpire: { $gt: Date.now() }
        });

        if (!user) {
            return res.status(400).json({ success: false, message: 'Invalid or expired verification code' });
        }

        // Set new password
        user.password = newPassword;
        user.resetPasswordOTP = undefined;
        user.resetPasswordExpire = undefined;
        await user.save();

        res.status(200).json({ success: true, message: 'Password reset successful. Please login.' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Upgrade Plan
// @route   PUT /api/auth/upgrade
// @access  Private
exports.upgradePlan = async (req, res) => {
    try {
        const { plan } = req.body;
        const user = await User.findById(req.user.id);
        
        if (!['free', 'pro', 'premium'].includes(plan)) {
            return res.status(400).json({ success: false, message: 'Invalid plan selected' });
        }

        let limits = {
            products: 5,
            aiRequests: 50,
            storage: 52428800 // 50MB
        };

        if (plan === 'pro') {
            limits = {
                products: 100,
                aiRequests: 200,
                storage: 1073741824 // 1GB
            };
        } else if (plan === 'premium') {
            limits = {
                products: 9999,
                aiRequests: 9999,
                storage: 10737418240 // 10GB
            };
        }

        user.plan = plan;
        user.limits = limits;
        await user.save();

        res.status(200).json({ success: true, data: user });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Get current user
// @route   GET /api/auth/me
// @access  Private
exports.getMe = async (req, res) => {
    try {
        let user = await User.findById(req.user.id);
        
        // Self-healing: Update old free limits for existing users
        if (user.plan === 'free' && user.limits.aiRequests < 50) {
            user.limits.aiRequests = 50;
            await user.save();
        }

        res.status(200).json({ success: true, data: user });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
