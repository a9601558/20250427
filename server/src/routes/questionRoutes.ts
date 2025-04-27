import express from 'express';
import { 
  getAllQuestionSets, 
  getQuestionSetById, 
  createQuestionSet, 
  updateQuestionSet, 
  deleteQuestionSet,
  createQuestion,
  updateQuestion,
  getQuestionById,
  deleteQuestion
} from '../controllers/questionController';
import { protect, admin } from '../middleware/authMiddleware';

const router = express.Router();

// 题库相关路由
// 获取所有题库
router.get('/sets', getAllQuestionSets);

// 获取特定题库
router.get('/sets/:id', getQuestionSetById);

// 创建题库 - 需要管理员权限
router.post('/sets', protect, admin, createQuestionSet);

// 更新题库 - 需要管理员权限 
router.put('/sets/:id', protect, admin, updateQuestionSet);

// 删除题库 - 需要管理员权限
router.delete('/sets/:id', protect, admin, deleteQuestionSet);

// 题目相关路由
// 获取特定题目
router.get('/:id', getQuestionById);

// 创建题目 - 需要管理员权限
router.post('/', protect, admin, createQuestion);

// 更新题目 - 需要管理员权限
router.put('/:id', protect, admin, updateQuestion);

// 删除题目 - 需要管理员权限
router.delete('/:id', protect, admin, deleteQuestion);

export default router; 