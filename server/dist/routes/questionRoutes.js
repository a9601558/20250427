"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const questionController_1 = require("../controllers/questionController");
const authMiddleware_1 = require("../middleware/authMiddleware");
const router = express_1.default.Router();
// 获取所有题库
router.get('/', questionController_1.getAllQuestionSets);
// 获取特定题库
router.get('/:id', questionController_1.getQuestionSetById);
// 创建题库 - 需要管理员权限
router.post('/', authMiddleware_1.protect, authMiddleware_1.admin, questionController_1.createQuestionSet);
// 更新题库 - 需要管理员权限 
router.put('/:id', authMiddleware_1.protect, authMiddleware_1.admin, questionController_1.updateQuestionSet);
// 删除题库 - 需要管理员权限
router.delete('/:id', authMiddleware_1.protect, authMiddleware_1.admin, questionController_1.deleteQuestionSet);
exports.default = router;
