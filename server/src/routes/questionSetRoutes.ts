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
  addQuestionToQuestionSet,
  setFeaturedQuestionSet
} from '../controllers/questionSetController';
import { upload, uploadQuestionSetFile } from '../controllers/questionsUploadController';
import { protect, admin } from '../middleware/authMiddleware';

const router = express.Router();

// 调试中间件
router.use((req, res, next) => {
  console.log('题库路由收到请求:', req.method, req.originalUrl);
  next();
});

// 测试路由
router.post('/test', (req, res) => {
  res.status(200).json({ success: true, message: '测试POST请求成功' });
});

// 特定路由需要放在通用路由之前，以避免路径冲突
router.get('/categories', getQuestionSetCategories);
router.get('/by-category/:category', getQuestionSetsByCategory);
router.post('/upload', protect, admin, uploadQuestionSets);

// 文件上传路由
router.post('/upload/file', protect, admin, (req, res, next) => {
  upload.single('file')(req, res, (err) => {
    if (err) {
      return res.status(400).json({ error: err.message });
    }
    next();
  });
}, uploadQuestionSetFile);

// ID参数路由
router.route('/:id')
  .get(getQuestionSetById)
  .put(protect, admin, updateQuestionSet)
  .delete(protect, admin, deleteQuestionSet);

// 题目相关路由
router.post('/:id/questions', protect, admin, addQuestionToQuestionSet);

// 精选状态更新
router.put('/:id/featured', protect, admin, setFeaturedQuestionSet);

// 基本路由
router.route('/')
  .get(getAllQuestionSets)
  .post(protect, admin, createQuestionSet);

export default router; 
