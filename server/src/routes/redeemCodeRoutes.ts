import express from 'express';
import {
  generateRedeemCodes,
  getRedeemCodes,
  redeemCode,
  deleteRedeemCode
} from '../controllers/redeemCodeController';
import { protect, admin } from '../middleware/authMiddleware';

const router = express.Router();

// Protected routes
router.post('/redeem', protect, redeemCode);

// Admin routes
router.get('/', protect, admin, getRedeemCodes);
router.post('/generate', protect, admin, generateRedeemCodes);
router.delete('/:id', protect, admin, deleteRedeemCode);

export default router; 