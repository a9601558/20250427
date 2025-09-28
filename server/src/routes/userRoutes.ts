import express from 'express';
import { 
  getUserProfile, 
  updateUserProfile,
  getUsers,
  deleteUser,
  getUserById,
  updateUser,
  createOrGetCognitoUser
} from '../controllers/userController';
import { protect, admin } from '../middleware/authMiddleware';

const router = express.Router();

// 所有用户路由现在都需要AWS Cognito认证
// 不再提供传统的/register和/login路由 (TypeScript版本)
// 认证通过AWS Cognito UI在前端处理

// Protected routes (requires AWS Cognito authentication)
router.get('/me', protect, getUserProfile);  // 改为/me以匹配前端API调用
router.put('/profile', protect, updateUserProfile);

// Admin routes (requires admin role)
router.get('/', protect, admin, getUsers);
router.get('/:id', protect, admin, getUserById);
router.put('/:id', protect, admin, updateUser);
router.delete('/:id', protect, admin, deleteUser);

export default router; 