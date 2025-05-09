"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const questionController_1 = require("../controllers/questionController");
const authMiddleware_1 = require("../middleware/authMiddleware");
const fileUploadMiddleware_1 = require("../middleware/fileUploadMiddleware");
const router = express_1.default.Router();
// 题目相关路由
router.get('/', questionController_1.getQuestions);
// 特殊路由放在通用路由前面
router.get('/count/:questionSetId', questionController_1.getQuestionCount);
router.get('/random/:questionSetId', questionController_1.getRandomQuestion);
router.post('/batch-upload/:questionSetId', authMiddleware_1.protect, authMiddleware_1.admin, fileUploadMiddleware_1.upload.single('file'), questionController_1.batchUploadQuestions);
// 通用路由放在特殊路由后面
router.get('/:id', questionController_1.getQuestionById);
router.post('/', authMiddleware_1.protect, authMiddleware_1.admin, questionController_1.createQuestion);
router.put('/:id', authMiddleware_1.protect, authMiddleware_1.admin, questionController_1.updateQuestion);
router.delete('/:id', authMiddleware_1.protect, authMiddleware_1.admin, questionController_1.deleteQuestion);
exports.default = router;
