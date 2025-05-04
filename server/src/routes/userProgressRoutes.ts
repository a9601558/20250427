import express from 'express';
import userProgressController from '../controllers/userProgressController';
import { protect } from '../middleware/authMiddleware';

const router = express.Router();

// Beacon API endpoint - 将其放在protect前面，无需认证
router.post('/sync', userProgressController.syncProgressViaBeacon);

// 其他所有进度路由需要认证
router.use(protect);

// 详细进度记录路由 - 需要放在前面以避免和通用路由冲突
router.post('/record', userProgressController.createDetailedProgress);
router.get('/detailed', userProgressController.getDetailedProgress);
router.get('/stats', userProgressController.getProgressStats);
router.get('/stats/:userId', userProgressController.getUserProgressStats);
router.get('/records', userProgressController.getUserProgressRecords);
router.get('/records/:userId', userProgressController.getUserProgressRecords);
router.delete('/record/:id', userProgressController.deleteProgressRecord);
router.get('/summary', userProgressController.getProgressSummary);

// 通用更新进度路由
router.post('/', userProgressController.updateProgress);

// 特定题库进度路由
router.post('/:questionSetId', userProgressController.updateProgress);

// 用户整体进度路由 - 需要放在最后
router.get('/:userId', userProgressController.getUserProgress);
router.get('/:userId/:questionSetId', userProgressController.getProgressByQuestionSetId);
router.delete('/:userId/:questionSetId', userProgressController.resetProgress);

export default router; 