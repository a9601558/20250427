const express = require('express');
const { 
  getUserProfile,
  updateUser,
  createOrGetCognitoUser
} = require('../controllers/userController');
const { protect } = require('../middleware/authMiddleware');

const router = express.Router();

// 所有用户路由现在都需要AWS Cognito认证
// 不再提供传统的/register和/login路由
// 认证通过AWS Cognito UI在前端处理

// 受保护路由 (需要AWS Cognito认证)
router.get('/me', protect, getUserProfile);
router.put('/:id', protect, updateUser);

module.exports = router; 