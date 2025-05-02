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
router.get('/categories', questionSetController_1.getQuestionSetCategories);
router.get('/by-category/:category', questionSetController_1.getQuestionSetsByCategory);
router.post('/upload', authMiddleware_1.protect, authMiddleware_1.admin, questionSetController_1.uploadQuestionSets);
// 文件上传路由
router.post('/upload/file', authMiddleware_1.protect, authMiddleware_1.admin, (req, res, next) => {
    questionsUploadController_1.upload.single('file')(req, res, (err) => {
        if (err) {
            return res.status(400).json({ error: err.message });
        }
        next();
    });
}, questionsUploadController_1.uploadQuestionSetFile);
// ID参数路由
router.route('/:id')
    .get(questionSetController_1.getQuestionSetById)
    .put(authMiddleware_1.protect, authMiddleware_1.admin, questionSetController_1.updateQuestionSet)
    .delete(authMiddleware_1.protect, authMiddleware_1.admin, questionSetController_1.deleteQuestionSet);
// 题目相关路由
router.post('/:id/questions', authMiddleware_1.protect, authMiddleware_1.admin, questionSetController_1.addQuestionToQuestionSet);
// 精选状态更新
router.put('/:id/featured', authMiddleware_1.protect, authMiddleware_1.admin, homepageController_1.updateQuestionSetFeaturedStatus);
// 基本路由
router.route('/')
    .get(questionSetController_1.getAllQuestionSets)
    .post(authMiddleware_1.protect, authMiddleware_1.admin, questionSetController_1.createQuestionSet);
exports.default = router;
