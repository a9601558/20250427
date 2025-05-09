import express from 'express';
import { 
  getQuestions,
  getQuestionById,
  createQuestion,
  updateQuestion,
  deleteQuestion,
  getRandomQuestion,
  getQuestionCount
} from '../controllers/questionController';
import { protect, admin } from '../middleware/authMiddleware';

const router = express.Router();

// 题目相关路由
router.get('/', getQuestions);
// 特殊路由放在通用路由前面
router.get('/count/:questionSetId', getQuestionCount);
router.get('/random/:questionSetId', getRandomQuestion);
// 通用路由放在特殊路由后面
router.get('/:id', getQuestionById);
router.post('/', protect, admin, createQuestion);
router.put('/:id', protect, admin, updateQuestion);
router.delete('/:id', protect, admin, deleteQuestion);

export default router; 