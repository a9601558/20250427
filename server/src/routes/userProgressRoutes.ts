import express from 'express';
import { getUserProgress, updateUserProgress } from '../controllers/userProgressController';
import { protect } from '../middleware/authMiddleware';

const router = express.Router();

// 获取用户所有进度
router.get('/', protect, getUserProgress);

// 更新用户进度
router.post('/', protect, updateUserProgress);

// 获取特定题库的进度
router.get('/:questionSetId', protect, getUserProgress);

export default router; 