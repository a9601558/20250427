"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const userProgressController_1 = require("../controllers/userProgressController");
const authMiddleware_1 = require("../middleware/authMiddleware");
const router = express_1.default.Router();
// All progress routes require authentication
router.use(authMiddleware_1.protect);
// Progress routes
router.get('/', userProgressController_1.getUserProgress);
router.post('/', userProgressController_1.updateProgress);
// 更新用户进度 - PUT方式 (ID在URL参数中)
router.put('/:questionSetId', userProgressController_1.getUserProgress);
// 获取特定题库的进度
router.get('/:questionSetId', userProgressController_1.getUserProgress);
exports.default = router;
