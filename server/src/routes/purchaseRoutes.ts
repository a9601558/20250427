import express from 'express';
import {
  createPurchase,
  getUserPurchases,
  checkAccess,
  getActivePurchases
} from '../controllers/purchaseController';
import { protect } from '../middleware/authMiddleware';

const router = express.Router();

// All purchase routes require authentication
router.use(protect);

// Purchase routes
router.post('/', createPurchase);
router.get('/', getUserPurchases);
router.get('/check/:questionSetId', checkAccess);
router.get('/active', getActivePurchases);

export default router; 