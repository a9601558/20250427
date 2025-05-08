import express from 'express';
import userRoutes from './userRoutes';
import questionSetRoutes from './questionSetRoutes';
import questionRoutes from './questionRoutes';
import purchaseRoutes from './purchaseRoutes';
import redeemCodeRoutes from './redeemCodeRoutes';
import homepageRoutes from './homepageRoutes';
import userProgressRoutes from './userProgressRoutes';
import paymentRoutes from './payment';

const router = express.Router();

// 挂载各个路由
router.use('/users', userRoutes);
router.use('/question-sets', questionSetRoutes);
router.use('/questions', questionRoutes);
router.use('/purchases', purchaseRoutes);
router.use('/redeem-codes', redeemCodeRoutes);
router.use('/homepage', homepageRoutes);
router.use('/user-progress', userProgressRoutes);
router.use('/payments', paymentRoutes);

export default router; 