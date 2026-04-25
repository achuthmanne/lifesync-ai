const Feedback = require('../models/Feedback');

// @desc    Submit feedback
// @route   POST /api/feedback
// @access  Private
exports.submitFeedback = async (req, res) => {
    try {
        const { category, rating, message } = req.body;

        const feedback = await Feedback.create({
            user: req.user.id,
            category,
            rating,
            message
        });

        res.status(201).json({
            success: true,
            data: feedback
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};
