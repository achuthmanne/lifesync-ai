const User = require('../models/User');

exports.checkLimit = (type) => async (req, res, next) => {
    try {
        const user = await User.findById(req.user.id);
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        // Check if limit is reached
        if (user.usage[type] >= user.limits[type]) {
            return res.status(403).json({
                success: false,
                type: 'LIMIT_REACHED',
                limitType: type,
                message: `You have reached your ${type} limit for the ${user.plan} plan. Please upgrade to continue.`,
                currentUsage: user.usage[type],
                limit: user.limits[type]
            });
        }

        next();
    } catch (error) {
        res.status(500).json({ success: false, message: 'Limit check failed' });
    }
};

exports.incrementUsage = (type) => async (req, res, next) => {
    try {
        await User.findByIdAndUpdate(req.user.id, {
            $inc: { [`usage.${type}`]: 1 }
        });
        if (next) next();
    } catch (error) {
        console.error(`Failed to increment ${type} usage:`, error);
        if (next) next();
    }
};
