"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const userController_1 = require("../controllers/userController");
const authMiddleware_1 = require("../middleware/authMiddleware");
const router = express_1.default.Router();
// 所有用户路由现在都需要AWS Cognito认证
// 不再提供传统的/register和/login路由 (TypeScript版本)
// 认证通过AWS Cognito UI在前端处理
// Protected routes (requires AWS Cognito authentication)
router.get('/me', authMiddleware_1.protect, userController_1.getUserProfile); // 改为/me以匹配前端API调用
router.put('/profile', authMiddleware_1.protect, userController_1.updateUserProfile);
// Admin routes (requires admin role)
router.get('/', authMiddleware_1.protect, authMiddleware_1.admin, userController_1.getUsers);
router.get('/:id', authMiddleware_1.protect, authMiddleware_1.admin, userController_1.getUserById);
router.put('/:id', authMiddleware_1.protect, authMiddleware_1.admin, userController_1.updateUser);
router.delete('/:id', authMiddleware_1.protect, authMiddleware_1.admin, userController_1.deleteUser);
exports.default = router;
