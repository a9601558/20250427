"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const userProgressController_1 = require("../controllers/userProgressController");
const authMiddleware_1 = require("../middleware/authMiddleware");
const router = express_1.default.Router();
// 获取用户所有进度
router.get('/', authMiddleware_1.protect, userProgressController_1.getUserProgress);
// 更新用户进度 - POST方式 (ID在请求体中)
router.post('/', authMiddleware_1.protect, userProgressController_1.updateUserProgress);
// 更新用户进度 - PUT方式 (ID在URL参数中)
router.put('/:questionSetId', authMiddleware_1.protect, userProgressController_1.updateUserProgress);
// 获取特定题库的进度
router.get('/:questionSetId', authMiddleware_1.protect, userProgressController_1.getUserProgress);
exports.default = router;
