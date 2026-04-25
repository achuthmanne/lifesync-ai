const express = require('express');
const { protect, admin } = require('../middleware/auth');
const timeService = require('../services/timeService');
const socketIO = require('../sockets/socketHandler');
const monitoringService = require('../services/monitoringService');

const router = express.Router();

// All admin routes are protected
router.use(protect);
router.use(admin);

/**
 * @desc    Simulate future time
 * @route   POST /api/admin/simulate-time
 * @access  Private/Admin
 */
router.post('/simulate-time', async (req, res) => {
    try {
        const { days, reset } = req.body;

        if (reset) {
            timeService.setOffset(0);
        } else if (days) {
            timeService.addDays(parseInt(days));
        }

        // After shifting time, we trigger a background sync 
        // to update all products immediately.
        // We force AI sync if it's a reset to ensure "normal mode" is restored everywhere.
        await monitoringService.runMonitoringSync(reset);

        // Notify the admin user specifically about the shift
        socketIO.notifyUser(req.user.id, 'time_shift', {
            offsetDays: timeService.getOffset(),
            currentTime: timeService.getCurrentTime(),
            message: reset ? 'Time simulation reset to real-time.' : `Time shifted by ${days} days.`
        });

        res.status(200).json({
            success: true,
            data: {
                offsetDays: timeService.getOffset(),
                currentTime: timeService.getCurrentTime()
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

module.exports = router;
