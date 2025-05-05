"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const authMiddleware_1 = require("../middleware/authMiddleware");
const userProgressController_1 = __importDefault(require("../controllers/userProgressController"));
const router = express_1.default.Router();
// 公共路由 - 不需要认证
router.post('/beacon', userProgressController_1.default.syncProgressViaBeacon);
router.post('/update', userProgressController_1.default.updateProgress); // 移除认证中间件，允许未认证请求
router.post('/quiz/submit', userProgressController_1.default.quizSubmit);
// 需要认证的路由
router.get('/:userId', authMiddleware_1.protect, userProgressController_1.default.getUserProgress);
router.get('/detailed/:userId/:questionSetId', authMiddleware_1.protect, userProgressController_1.default.getDetailedProgress);
router.post('/detailed', authMiddleware_1.protect, userProgressController_1.default.createDetailedProgress);
router.get('/stats/:userId', authMiddleware_1.protect, userProgressController_1.default.getUserProgressStats);
router.get('/stats/:userId/:questionSetId', authMiddleware_1.protect, userProgressController_1.default.getProgressStats);
router.get('/summary/:userId', authMiddleware_1.protect, userProgressController_1.default.getProgressSummary);
router.get('/records/:userId', authMiddleware_1.protect, userProgressController_1.default.getUserProgressRecords);
// 重置和删除操作需要认证
router.delete('/reset/:userId/:questionSetId', authMiddleware_1.protect, userProgressController_1.default.resetProgress);
router.delete('/:userId/:progressId', authMiddleware_1.protect, userProgressController_1.default.deleteProgressRecord);
// 添加缺失的用户进度路由
router.get('/:userId/:questionSetId', authMiddleware_1.protect, userProgressController_1.default.getProgressByQuestionSetId);
// 添加别名路由解决缺失的 /api/users/:userId/progress 路由
router.get('/user/:userId', authMiddleware_1.protect, userProgressController_1.default.getUserProgress);
exports.default = router;
