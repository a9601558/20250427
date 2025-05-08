import express from 'express';
import { protect, admin } from '../middleware/authMiddleware';
import * as homepageController from '../controllers/homepageController';

// 打印调试信息
console.log('Debug homepage routes:');
console.log('homepageController:', typeof homepageController);
for (const key in homepageController) {
  console.log(`${key}:`, typeof (homepageController as any)[key]);
}

const router = express.Router();

// 获取首页内容
router.get('/content', homepageController.getHomepageContent);

// 更新首页内容（需要管理员权限）
router.put('/content', protect, admin, homepageController.updateHomepageContent);

// 获取精选分类
router.get('/featured-categories', homepageController.getFeaturedCategories);

// 更新精选分类（需要管理员权限）
router.put('/featured-categories', protect, admin, homepageController.updateFeaturedCategories);

// 获取精选题库
router.get('/featured-question-sets', homepageController.getFeaturedQuestionSets);

export default router; 