const express = require('express');
const { isAdmin, isAuth } = require('../middleware/auth');
const homepageController = require('../controllers/homepageController');
const router = express.Router();

// 获取首页内容
router.get('/content', homepageController.getHomeContent);

// 更新首页内容（需要管理员权限）
router.put('/content', isAuth, isAdmin, homepageController.updateHomeContent);

// 获取精选分类
router.get('/featured-categories', homepageController.getFeaturedCategories);

// 更新精选分类（需要管理员权限）
router.put('/featured-categories', isAuth, isAdmin, homepageController.updateFeaturedCategories);

module.exports = router; 
