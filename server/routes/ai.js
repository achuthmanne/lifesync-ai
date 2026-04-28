const express = require('express');
const { protect } = require('../middleware/auth');
const { chatWithAI } = require('../services/aiService');

const { checkLimit, incrementUsage } = require('../middleware/limitMiddleware');

const router = express.Router();

router.post('/chat', async (req, res) => {
    try {
        const { message, productId, history, currentScreen } = req.body;
        
        // Extract user from token if available, but don't block if not
        let userId = null;
        const authHeader = req.headers.authorization;
        if (authHeader && authHeader.startsWith('Bearer ')) {
            const token = authHeader.split(' ')[1];
            try {
                const jwt = require('jsonwebtoken');
                const decoded = jwt.verify(token, process.env.JWT_SECRET);
                userId = decoded.id;

                // Check limit if logged in
                const User = require('../models/User');
                const user = await User.findById(userId);
                
                // Self-healing: Update old free limits
                if (user && user.plan === 'free' && user.limits.aiRequests < 50) {
                    user.limits.aiRequests = 50;
                    await user.save();
                }

                if (user && user.usage.aiRequests >= user.limits.aiRequests) {
                    return res.status(200).json({ 
                        success: true, 
                        data: { 
                            text: "You've reached your monthly AI request limit for the Free plan. Upgrade to Pro for unlimited insights! [SUGGESTIONS: Show pricing | What is in the Pro plan? | How to upgrade]",
                            provider: 'System',
                            limitReached: true
                        } 
                    });
                }
            } catch (e) {
                console.warn('Invalid token in AI chat, continuing as guest');
            }
        }

        const response = await chatWithAI(userId, message, productId, history, currentScreen);
        
        // Increment usage if user is logged in
        if (userId) {
            const User = require('../models/User');
            await User.findByIdAndUpdate(userId, { $inc: { 'usage.aiRequests': 1 } });
        }

        res.status(200).json({ success: true, data: response });
    } catch (error) {
        console.error('AI Chat Route Error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

router.get('/summary', protect, checkLimit('aiRequests'), async (req, res) => {
    try {
        const { getInventorySummary } = require('../services/aiService');
        const response = await getInventorySummary(req.user.id);
        
        // Increment usage
        const User = require('../models/User');
        await User.findByIdAndUpdate(req.user.id, { $inc: { 'usage.aiRequests': 1 } });

        res.status(200).json({ success: true, data: response });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

module.exports = router;
