import express from 'express';
import { getUserProgress, updateProgress } from '../controllers/userProgressController';
import { protect } from '../middleware/authMiddleware';

const router = express.Router();

// All progress routes require authentication
router.use(protect);

// Progress routes
router.get('/', getUserProgress);
router.post('/', updateProgress);

// 更新用户进度 - PUT方式 (ID在URL参数中)
router.put('/:questionSetId', getUserProgress);

// 获取特定题库的进度
router.get('/:questionSetId', getUserProgress);

export default router; 