import express from 'express';
import { 
  getQuestions,
  getQuestionById,
  createQuestion,
  updateQuestion,
  deleteQuestion,
  getRandomQuestion
} from '../controllers/questionController';
import { protect, admin } from '../middleware/authMiddleware';

const router = express.Router();

// 题目相关路由
router.get('/', getQuestions);
router.get('/:id', getQuestionById);
router.post('/', protect, admin, createQuestion);
router.put('/:id', protect, admin, updateQuestion);
router.delete('/:id', protect, admin, deleteQuestion);
router.get('/random/:questionSetId', getRandomQuestion);

export default router; 