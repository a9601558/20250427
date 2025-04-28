"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const questionSetController_1 = require("../controllers/questionSetController");
const questionsUploadController_1 = require("../controllers/questionsUploadController");
const authMiddleware_1 = require("../middleware/authMiddleware");
const homepageController_1 = require("../controllers/homepageController");
const router = express_1.default.Router();
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
router.get('/', questionSetController_1.getAllQuestionSets);
router.get('/categories', questionSetController_1.getQuestionSetCategories);
// Admin routes
router.post('/upload', authMiddleware_1.protect, authMiddleware_1.admin, questionSetController_1.uploadQuestionSets);
// File upload route
router.post('/upload/file', authMiddleware_1.protect, authMiddleware_1.admin, questionsUploadController_1.upload.single('file'), questionsUploadController_1.uploadQuestionSetFile);
// Protected routes that use ID parameters
router.post('/:id/progress', authMiddleware_1.protect, questionSetController_1.saveProgress);
// Admin routes with ID parameters
router.put('/:id', authMiddleware_1.protect, authMiddleware_1.admin, questionSetController_1.updateQuestionSet);
router.delete('/:id', authMiddleware_1.protect, authMiddleware_1.admin, questionSetController_1.deleteQuestionSet);
// Featured status update route
router.put('/:id/featured', authMiddleware_1.protect, authMiddleware_1.admin, homepageController_1.updateQuestionSetFeaturedStatus);
// Base routes
router.post('/', authMiddleware_1.protect, authMiddleware_1.admin, questionSetController_1.createQuestionSet);
router.get('/:id', questionSetController_1.getQuestionSetById);
// 按分类获取题库
router.get('/by-category/:category', questionSetController_1.getQuestionSetsByCategory);
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
exports.default = router;
