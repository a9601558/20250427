import express from 'express';
import {
  generateRedeemCodes,
  getRedeemCodes,
  redeemCode,
  deleteRedeemCode,
  getUserRedeemCodes,
  fixRedeemCodeQuestionSet
} from '../controllers/redeemCodeController';
import { protect, admin } from '../middleware/authMiddleware';

const router = express.Router();

// @desc    Generate redeem codes
// @route   POST /api/redeem-codes/generate
// @access  Private/Admin
router.post('/generate', protect, admin, generateRedeemCodes);

// @desc    Get all redeem codes
// @route   GET /api/redeem-codes
// @access  Private/Admin
router.get('/', protect, admin, getRedeemCodes);

// @desc    Redeem a code
// @route   POST /api/redeem-codes/redeem
// @access  Private
router.post('/redeem', protect, redeemCode);

// @desc    Delete a redeem code
// @route   DELETE /api/redeem-codes/:id
// @access  Private/Admin
router.delete('/:id', protect, admin, deleteRedeemCode);

// @desc    Get user's redeemed codes
// @route   GET /api/redeem-codes/user
// @access  Private
router.get('/user', protect, getUserRedeemCodes);

// @desc    Fix redeem code question set association
// @route   PUT /api/redeem-codes/:id/fix-question-set
// @access  Private/Admin
router.put('/:id/fix-question-set', protect, admin, fixRedeemCodeQuestionSet);

export default router; 