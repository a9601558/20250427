import express from 'express';
import { 
  getUserProgress, 
  updateProgress, 
  getProgressByQuestionSetId,
  resetProgress,
  createDetailedProgress,
  getDetailedProgress,
  getProgressStats,
  deleteProgressRecord,
  getUserProgressStats,
  getUserProgressRecords,
  getProgressSummary,
  syncProgressViaBeacon
} from '../controllers/userProgressController';
import { protect } from '../middleware/authMiddleware';

const router = express.Router();

// All progress routes require authentication
router.use(protect);

// 详细进度记录路由 - 需要放在前面以避免和通用路由冲突
router.post('/record', createDetailedProgress);
router.get('/detailed', getDetailedProgress);
router.get('/stats', getProgressStats);
router.get('/stats/:userId', getUserProgressStats);
router.get('/records', getUserProgressRecords);
router.delete('/record/:id', deleteProgressRecord);

// Beacon API endpoint for reliable sync during page unload
router.post('/sync', syncProgressViaBeacon);

// 通用更新进度路由
router.post('/', updateProgress);

// 特定题库进度路由
router.post('/:questionSetId', updateProgress);

// 用户整体进度路由 - 需要放在最后
router.get('/:userId', getUserProgress);
router.get('/:userId/:questionSetId', getProgressByQuestionSetId);
router.delete('/:userId/:questionSetId', resetProgress);

router.get('/summary', getProgressSummary);

export default router; 