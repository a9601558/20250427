import express from 'express';
import { 
  getAllQuestionSets, 
  getQuestionSetById, 
  createQuestionSet, 
  updateQuestionSet, 
  deleteQuestionSet
} from '../controllers/questionController';
import { protect, admin } from '../middleware/authMiddleware';

const router = express.Router();

// 获取所有题库
router.get('/', getAllQuestionSets);

// 获取特定题库
router.get('/:id', getQuestionSetById);

// 创建题库 - 需要管理员权限
router.post('/', protect, admin, createQuestionSet);

// 更新题库 - 需要管理员权限 
router.put('/:id', protect, admin, updateQuestionSet);

// 删除题库 - 需要管理员权限
router.delete('/:id', protect, admin, deleteQuestionSet);

export default router; 