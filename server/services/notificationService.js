const Notification = require('../models/Notification');
const socketIO = require('../sockets/socketHandler');

/**
 * Create a notification and notify user via socket
 * @param {Object} data Notification data
 * @param {string} data.user User ID
 * @param {string} data.title Notification title
 * @param {string} data.message Notification message
 * @param {string} [data.type='info'] Notification type (info, warning, danger, success)
 * @param {string} [data.category='system'] Category (warranty, health, security, system, maintenance)
 * @param {string} [data.productId] Optional product ID
 */
exports.createNotification = async (data) => {
    try {
        const notification = await Notification.create(data);
        
        // Notify user via socket
        socketIO.notifyUser(data.user, 'notification', {
            _id: notification._id,
            title: notification.title,
            message: notification.message,
            type: notification.type,
            category: notification.category,
            createdAt: notification.createdAt
        });

        return notification;
    } catch (err) {
        console.error('Error creating notification:', err);
    }
};
