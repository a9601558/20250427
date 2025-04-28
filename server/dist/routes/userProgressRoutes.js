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
// 用户整体进度路由
router.get('/:userId', userProgressController_1.getUserProgress);
router.post('/', userProgressController_1.updateProgress);
// 特定题库进度路由
router.get('/:userId/:questionSetId', userProgressController_1.getProgressByQuestionSetId);
router.post('/:questionSetId', userProgressController_1.updateProgress);
router.delete('/:userId/:questionSetId', userProgressController_1.resetProgress);
// 详细进度记录路由
router.post('/record', userProgressController_1.createDetailedProgress);
router.get('/detailed', userProgressController_1.getDetailedProgress);
router.get('/stats', userProgressController_1.getProgressStats);
router.get('/stats/:userId', userProgressController_1.getUserProgressStats);
router.delete('/record/:id', userProgressController_1.deleteProgressRecord);
exports.default = router;
