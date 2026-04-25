const express = require('express');
const { protect } = require('../middleware/auth');
const { chatWithAI } = require('../services/aiService');

const router = express.Router();

router.post('/chat', protect, async (req, res) => {
    try {
        const { message, productId, history, currentScreen } = req.body;
        const response = await chatWithAI(req.user.id, message, productId, history, currentScreen);
        res.status(200).json({ success: true, data: response });
    } catch (error) {
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
