const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { 
    getConfig, 
    createOrder, 
    verifyPayment, 
    handleWebhook 
} = require('../controllers/paymentController');

router.get('/config', getConfig);
router.post('/create-order', protect, createOrder);
router.post('/verify', protect, verifyPayment);
router.post('/webhook', handleWebhook);

module.exports = router;
