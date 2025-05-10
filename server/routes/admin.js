const express = require('express');
const router = express.Router();
const { isAuthenticated, isAdmin } = require('../middleware/auth');
const uploadController = require('../controllers/admin/uploadController');

// All routes in this file require authentication and admin privileges
router.use(isAuthenticated);
router.use(isAdmin);

// Card image upload routes
router.post('/upload/card-image', uploadController.uploadCardImage);
router.delete('/upload/card-image/:questionSetId', uploadController.deleteCardImage);

module.exports = router; 