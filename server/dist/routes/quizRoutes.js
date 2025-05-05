"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const userProgressController_1 = __importDefault(require("../controllers/userProgressController"));
const router = express_1.default.Router();
/**
 * @route   POST /api/quiz/submit
 * @desc    提交测验结果
 * @access  Public - 不需要身份验证，这是一个备用接口
 */
router.post('/submit', userProgressController_1.default.quizSubmit);
exports.default = router;
