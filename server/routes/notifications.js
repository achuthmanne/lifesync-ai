const express = require('express');
const {
    getNotifications,
    markAsRead,
    deleteNotification,
    clearAllNotifications
} = require('../controllers/notificationController');
const { protect } = require('../middleware/auth');

const router = express.Router();

router.use(protect);

router.route('/')
    .get(getNotifications)
    .delete(clearAllNotifications);

router.route('/:id')
    .put(markAsRead)
    .delete(deleteNotification);

module.exports = router;
