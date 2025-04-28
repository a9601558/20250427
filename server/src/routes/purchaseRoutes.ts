import express from 'express';
import {
  createPurchase,
  getUserPurchases
} from '../controllers/purchaseController';
import { protect } from '../middleware/authMiddleware';

const router = express.Router();

// All purchase routes require authentication
router.use(protect);

// Purchase routes
router.post('/', createPurchase);
router.get('/', getUserPurchases);

export default router; 