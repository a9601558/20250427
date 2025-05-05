import express from 'express';
import userProgressController from '../controllers/userProgressController';
import { protect } from '../middleware/authMiddleware';

const router = express.Router();

// 公共路由 - 不需要身份验证
router.post('/beacon', userProgressController.syncProgressViaBeacon);

// 其他所有进度路由需要认证
router.use(protect);

// 详细进度记录路由 - 需要放在前面以避免和通用路由冲突
router.get('/detailed/:userId/:questionSetId', userProgressController.getDetailedProgress);
router.post('/detailed', userProgressController.createDetailedProgress);

// 进度统计路由
router.get('/stats/:userId/:questionSetId', userProgressController.getProgressStats);
router.get('/stats/:userId', userProgressController.getUserProgressStats);
router.get('/summary/:userId', userProgressController.getProgressSummary);

// 进度记录路由
router.get('/records/:userId', userProgressController.getUserProgressRecords);

// 更新与重置路由
router.post('/update', userProgressController.updateProgress);
router.delete('/reset/:userId/:questionSetId', userProgressController.resetProgress);
router.delete('/:userId/:progressId', userProgressController.deleteProgressRecord);

// 基本进度查询路由
router.get('/:userId/:questionSetId', userProgressController.getProgressByQuestionSetId);
router.get('/:userId', userProgressController.getUserProgress);

export default router; 