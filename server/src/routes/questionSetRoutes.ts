import express from 'express';
import {
  getAllQuestionSets,
  getQuestionSetById,
  createQuestionSet,
  updateQuestionSet,
  deleteQuestionSet,
  uploadQuestionSets,
  getQuestionSetCategories,
  getQuestionSetsByCategory,
  addQuestionToQuestionSet
} from '../controllers/questionSetController';
import { upload, uploadQuestionSetFile } from '../controllers/questionsUploadController';
import { protect, admin } from '../middleware/authMiddleware';
import { updateQuestionSetFeaturedStatus } from '../controllers/homepageController';

const router = express.Router();

// 调试中间件 - 记录所有请求
router.use((req, res, next) => {
  console.log('题库路由收到请求:', req.method, req.originalUrl);
  console.log('请求头:', JSON.stringify(req.headers));
  if (req.method === 'POST' || req.method === 'PUT') {
    console.log('请求体:', JSON.stringify(req.body));
  }
  next();
});

// Public routes
router.get('/', getAllQuestionSets);
router.get('/categories', getQuestionSetCategories);

// Admin routes
router.post('/upload', protect, admin, uploadQuestionSets);

// File upload route
router.post('/upload/file', protect, admin, upload.single('file'), uploadQuestionSetFile);

// Admin routes with ID parameters
router.put('/:id', protect, admin, updateQuestionSet);
router.delete('/:id', protect, admin, deleteQuestionSet);

// 题目相关路由
router.post('/:id/questions', protect, admin, addQuestionToQuestionSet);

// Featured status update route
router.put('/:id/featured', protect, admin, updateQuestionSetFeaturedStatus);

// Base routes
router.post('/', protect, admin, createQuestionSet);
router.get('/:id', getQuestionSetById);

// 按分类获取题库
router.get('/by-category/:category', getQuestionSetsByCategory);

// 添加测试路由，确认POST请求能够正常工作
router.post('/test', (req, res) => {
  console.log('测试POST请求成功接收');
  console.log('请求体:', req.body);
  res.status(200).json({
    success: true,
    message: '测试POST请求成功',
    receivedData: req.body
  });
});

export default router; 