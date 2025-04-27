import express from 'express';
import {
  createPurchase,
  completePurchase,
  getUserPurchases,
  checkPurchaseAccess
} from '../controllers/purchaseController';
import { protect } from '../middleware/authMiddleware';

const router = express.Router();

// All purchase routes require authentication
router.use(protect);

router.post('/', createPurchase);
router.post('/complete', completePurchase);
router.get('/user', getUserPurchases);
router.get('/check/:questionSetId', checkPurchaseAccess);

export default router; 