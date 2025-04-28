import express from 'express';
import { 
  getUserProgress, 
  updateProgress, 
  getProgressByQuestionSetId,
  resetProgress,
  createDetailedProgress,
  getDetailedProgress,
  getProgressStats,
  deleteProgressRecord
} from '../controllers/userProgressController';
import { protect } from '../middleware/authMiddleware';

const router = express.Router();

// All progress routes require authentication
router.use(protect);

// 用户整体进度路由
router.get('/', getUserProgress);
router.post('/', updateProgress);

// 特定题库进度路由
router.get('/:questionSetId', getProgressByQuestionSetId);
router.put('/:questionSetId', updateProgress);
router.delete('/:questionSetId', resetProgress);

// 详细进度记录路由
router.post('/record', createDetailedProgress);
router.get('/detailed', getDetailedProgress);
router.get('/stats', getProgressStats);
router.delete('/record/:id', deleteProgressRecord);

export default router; 