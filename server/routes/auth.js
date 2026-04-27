const express = require('express');
const { register, login, getMe, googleLogin, forgotPassword, resetPassword, upgradePlan } = require('../controllers/authController');
const { protect } = require('../middleware/auth');

const router = express.Router();

router.post('/register', register);
router.post('/login', login);
router.post('/google', googleLogin);
router.post('/forgotpassword', forgotPassword);
router.post('/resetpassword', resetPassword);
router.get('/me', protect, getMe);
router.put('/upgrade', protect, upgradePlan);

module.exports = router;
