const express = require('express');
const router = express.Router();

// Import route modules
const userRoutes = require('./users');
const questionRoutes = require('./questions');
const questionSetRoutes = require('./question-sets');
const optionRoutes = require('./options');
const purchaseRoutes = require('./purchases');
const redeemRoutes = require('./redeem');
const homeContentRoutes = require('./home-content');
const adminRoutes = require('./admin'); // Add admin routes

// Set up static file serving for uploads
router.use('/uploads', express.static('server/uploads'));

// API routes
router.use('/api/users', userRoutes);
router.use('/api/questions', questionRoutes);
router.use('/api/question-sets', questionSetRoutes);
router.use('/api/options', optionRoutes);
router.use('/api/purchases', purchaseRoutes);
router.use('/api/redeem', redeemRoutes);
router.use('/api/home-content', homeContentRoutes);
router.use('/api/admin', adminRoutes); // Mount admin routes

module.exports = router; 