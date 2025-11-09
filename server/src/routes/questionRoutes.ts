import express from 'express';
import { 
  getQuestions,
  getQuestionById,
  createQuestion,
  updateQuestion,
  deleteQuestion,
  getRandomQuestion,
  getQuestionCount,
  getBatchQuestionCounts,
  batchUploadQuestions,
  jsonUploadQuestions
} from '../controllers/questionController';
import { protect, admin } from '../middleware/authMiddleware';
import { upload } from '../middleware/fileUploadMiddleware';

const router = express.Router();

// 题目相关路由
router.get('/', getQuestions);
// 特殊路由放在通用路由前面
router.get('/count/:questionSetId', getQuestionCount);
router.post('/batch-count', getBatchQuestionCounts);  // 批量查询题目数量
router.get('/random/:questionSetId', getRandomQuestion);

// Batch upload route - ensure proper middleware and handling
router.post('/batch-upload/:questionSetId', protect, admin, upload.single('file'), batchUploadQuestions);

// JSON upload route - for importing complete question banks from JSON files
router.post('/json-upload', protect, admin, upload.single('file'), jsonUploadQuestions);

// 通用路由放在特殊路由后面
router.get('/:id', getQuestionById);
router.post('/', protect, admin, createQuestion);
router.put('/:id', protect, admin, updateQuestion);
router.delete('/:id', protect, admin, deleteQuestion);

export default router; 