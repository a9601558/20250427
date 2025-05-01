"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const questionController_1 = require("../controllers/questionController");
const authMiddleware_1 = require("../middleware/authMiddleware");
const router = express_1.default.Router();
// 题目相关路由
router.get('/', questionController_1.getQuestions);
router.get('/count/:questionSetId', questionController_1.getQuestionCount);
router.get('/:id', questionController_1.getQuestionById);
router.post('/', authMiddleware_1.protect, authMiddleware_1.admin, questionController_1.createQuestion);
router.put('/:id', authMiddleware_1.protect, authMiddleware_1.admin, questionController_1.updateQuestion);
router.delete('/:id', authMiddleware_1.protect, authMiddleware_1.admin, questionController_1.deleteQuestion);
router.get('/random/:questionSetId', questionController_1.getRandomQuestion);
exports.default = router;
