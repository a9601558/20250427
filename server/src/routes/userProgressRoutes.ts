import express from 'express';
import { protect as auth } from '../middleware/authMiddleware';
import userProgressController from '../controllers/userProgressController';

const router = express.Router();

// 公共路由 - 不需要认证
router.post('/beacon', userProgressController.syncProgressViaBeacon);
router.post('/update', userProgressController.updateProgress); // 移除认证中间件，允许未认证请求
router.post('/quiz/submit', userProgressController.quizSubmit);

// 需要认证的路由
router.get('/:userId', auth, userProgressController.getUserProgress);
router.get('/detailed/:userId/:questionSetId', auth, userProgressController.getDetailedProgress);
router.post('/detailed', auth, userProgressController.createDetailedProgress);
router.get('/stats/:userId', auth, userProgressController.getUserProgressStats);
router.get('/stats/:userId/:questionSetId', auth, userProgressController.getProgressStats);
router.get('/summary/:userId', auth, userProgressController.getProgressSummary);
router.get('/records/:userId', auth, userProgressController.getUserProgressRecords);

// 重置和删除操作需要认证
router.delete('/reset/:userId/:questionSetId', auth, userProgressController.resetProgress);
router.delete('/:userId/:progressId', auth, userProgressController.deleteProgressRecord);

// 添加缺失的用户进度路由
router.get('/:userId/:questionSetId', auth, userProgressController.getProgressByQuestionSetId);

// 添加别名路由解决缺失的 /api/users/:userId/progress 路由
router.get('/user/:userId', auth, userProgressController.getUserProgress);

export default router; 