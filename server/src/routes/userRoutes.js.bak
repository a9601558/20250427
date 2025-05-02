const express = require('express');
const { 
  registerUser, 
  loginUser, 
  getUserProfile,
  updateUser,
} = require('../controllers/userController');
const { protect } = require('../middleware/authMiddleware');

const router = express.Router();

// 公开路由
router.post('/register', registerUser);
router.post('/login', loginUser);

// 受保护路由 (需要认证)
router.get('/me', protect, getUserProfile);
router.put('/:id', protect, updateUser);

module.exports = router; 
