import express from 'express';
import {
  createPurchase,
  getUserPurchases,
  checkAccess,
  getActivePurchases,
  forceCreatePurchase
} from '../controllers/purchaseController';
import { protect } from '../middleware/authMiddleware';
import * as purchaseService from '../services/purchaseService';
import logger from '../utils/logger';
import { CustomError } from '../utils/errors';

const router = express.Router();

// All purchase routes require authentication
router.use(protect);

// Purchase routes
router.post('/', createPurchase);
router.get('/', getUserPurchases);
router.get('/check/:questionSetId', checkAccess);
router.get('/active', getActivePurchases);
router.post('/force-create', forceCreatePurchase);

/**
 * 检查用户对题库的访问权限
 * GET /api/purchases/check/:questionSetId
 */
router.get('/check/:questionSetId', async (req, res) => {
  try {
    const { questionSetId } = req.params;
    const userId = req.query.userId as string || req.body.userId;
    
    if (!userId) {
      return res.status(400).json({
        success: false,
        message: '缺少用户ID'
      });
    }
    
    logger.info(`API - 检查用户 ${userId} 对题库 ${questionSetId} 的访问权限`);
    
    // 检查数据库中的购买记录
    const hasAccess = await purchaseService.hasAccessToQuestionSet(userId, questionSetId);
    
    // 如果有访问权限，获取剩余天数
    let remainingDays = null;
    if (hasAccess) {
      const purchase = await purchaseService.getLatestPurchaseForQuestionSet(userId, questionSetId);
      if (purchase && purchase.expiryDate) {
        const now = new Date();
        const expiryDate = new Date(purchase.expiryDate);
        const diffTime = expiryDate.getTime() - now.getTime();
        remainingDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      }
    }
    
    return res.json({
      success: true,
      data: {
        hasAccess,
        remainingDays,
        timestamp: Date.now()
      }
    });
    
  } catch (error) {
    logger.error('检查题库访问权限API错误:', error);
    return res.status(500).json({
      success: false,
      message: error instanceof CustomError ? error.message : '检查访问权限失败'
    });
  }
});

/**
 * 获取用户的所有购买记录
 * GET /api/purchases/user/:userId
 */
router.get('/user/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    
    logger.info(`API - 获取用户 ${userId} 的所有购买记录`);
    
    // 获取用户的购买记录
    const purchases = await purchaseService.getActivePurchasesByUserId(userId);
    
    return res.json({
      success: true,
      data: purchases
    });
    
  } catch (error) {
    logger.error('获取用户购买记录API错误:', error);
    return res.status(500).json({
      success: false,
      message: error instanceof CustomError ? error.message : '获取购买记录失败'
    });
  }
});

export default router; 