const express = require('express');
const { protect } = require('../middleware/auth');
const { chatWithAI } = require('../services/aiService');

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
            } catch (e) {
                console.warn('Invalid token in AI chat, continuing as guest');
            }
        }

        const response = await chatWithAI(userId, message, productId, history, currentScreen);
        res.status(200).json({ success: true, data: response });
    } catch (error) {
        console.error('AI Chat Route Error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

router.get('/summary', protect, async (req, res) => {
    try {
        const { getInventorySummary } = require('../services/aiService');
        const response = await getInventorySummary(req.user.id);
        res.status(200).json({ success: true, data: response });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

module.exports = router;
