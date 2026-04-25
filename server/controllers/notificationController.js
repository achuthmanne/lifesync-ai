const Notification = require('../models/Notification');
const Product = require('../models/Product');

// @desc    Get all notifications for user
// @route   GET /api/notifications
// @access  Private
exports.getNotifications = async (req, res) => {
    try {
        let notifications = await Notification.find({ user: req.user.id }).sort({ createdAt: -1 });

        // If no notifications, generate some useful ones for demo/onboarding
        if (notifications.length === 0) {
            const products = await Product.find({ user: req.user.id });
            
            const initialNotifs = [
                {
                    user: req.user.id,
                    title: 'Welcome to LifeSync AI',
                    message: 'Your personal AI-powered lifecycle manager is ready. Add products to start receiving insights.',
                    type: 'success',
                    category: 'system'
                },
                {
                    user: req.user.id,
                    title: 'Security Alert: New Login',
                    message: `A new login was detected for your account from a new browser.`,
                    type: 'warning',
                    category: 'security'
                }
            ];

            // If user has products, generate product-specific notifications
            if (products.length > 0) {
                const prod = products[0];
                initialNotifs.push({
                    user: req.user.id,
                    title: 'Maintenance Reminder',
                    message: `Your ${prod.name} is due for a routine check-up to ensure optimal performance.`,
                    type: 'info',
                    category: 'maintenance',
                    productId: prod._id
                });
            }

            notifications = await Notification.insertMany(initialNotifs);
        }

        res.status(200).json({
            success: true,
            count: notifications.length,
            data: notifications
        });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
};

// @desc    Mark notification as read
// @route   PUT /api/notifications/:id
// @access  Private
exports.markAsRead = async (req, res) => {
    try {
        let notification = await Notification.findById(req.params.id);

        if (!notification) {
            return res.status(404).json({ success: false, message: 'Notification not found' });
        }

        if (notification.user.toString() !== req.user.id) {
            return res.status(401).json({ success: false, message: 'Not authorized' });
        }

        notification = await Notification.findByIdAndUpdate(
            req.params.id,
            { isRead: true },
            { new: true }
        );

        res.status(200).json({ success: true, data: notification });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
};

// @desc    Delete notification
// @route   DELETE /api/notifications/:id
// @access  Private
exports.deleteNotification = async (req, res) => {
    try {
        const notification = await Notification.findById(req.params.id);

        if (!notification) {
            return res.status(404).json({ success: false, message: 'Notification not found' });
        }

        if (notification.user.toString() !== req.user.id) {
            return res.status(401).json({ success: false, message: 'Not authorized' });
        }

        await notification.deleteOne();

        res.status(200).json({ success: true, data: {} });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
};

// @desc    Clear all notifications
// @route   DELETE /api/notifications
// @access  Private
exports.clearAllNotifications = async (req, res) => {
    try {
        await Notification.deleteMany({ user: req.user.id });
        res.status(200).json({ success: true, data: {} });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
};
