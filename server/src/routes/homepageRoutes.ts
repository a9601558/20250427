import express from 'express';
import { 
  getHomepageContent, 
  updateHomepageContent, 
  getFeaturedCategories, 
  updateFeaturedCategories, 
  getFeaturedQuestionSets, 
  updateQuestionSetFeaturedStatus 
} from '../controllers/homepageController';
import { protect, admin } from '../middleware/authMiddleware';

const router = express.Router();

// 公共路由
router.get('/content', getHomepageContent);
router.get('/featured-categories', getFeaturedCategories);
router.get('/featured-question-sets', getFeaturedQuestionSets);

// 管理员路由
router.put('/content', protect, admin, updateHomepageContent);
router.put('/featured-categories', protect, admin, updateFeaturedCategories);
router.put('/featured-question-sets/:id', protect, admin, updateQuestionSetFeaturedStatus);

export default router; 