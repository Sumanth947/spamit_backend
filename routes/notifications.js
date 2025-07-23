// routes/notifications.js
const express = require('express');
const router = express.Router();
const auth = require('../middleware/authMiddleware');
const notificationController = require('../controllers/notificationController');

// Database notification routes only
router.get('/', auth, notificationController.getNotifications);
router.put('/mark-read', auth, notificationController.markAsRead);

module.exports = router;
