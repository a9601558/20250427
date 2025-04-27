import express from 'express';
import { getUserProgress, updateUserProgress } from '../controllers/userProgressController';
import { protect } from '../middleware/authMiddleware';

const router = express.Router();

// 获取用户所有进度
router.get('/', protect, getUserProgress);

// 更新用户进度 - POST方式 (ID在请求体中)
router.post('/', protect, updateUserProgress);

// 更新用户进度 - PUT方式 (ID在URL参数中)
router.put('/:questionSetId', protect, updateUserProgress);

// 获取特定题库的进度
router.get('/:questionSetId', protect, getUserProgress);

export default router; 