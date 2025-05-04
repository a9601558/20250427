"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const userProgressController_1 = __importDefault(require("../controllers/userProgressController"));
const authMiddleware_1 = require("../middleware/authMiddleware");
const router = express_1.default.Router();
// Beacon API endpoint - 将其放在protect前面，无需认证
router.post('/sync', userProgressController_1.default.syncProgressViaBeacon);
// 其他所有进度路由需要认证
router.use(authMiddleware_1.protect);
// 详细进度记录路由 - 需要放在前面以避免和通用路由冲突
router.post('/record', userProgressController_1.default.createDetailedProgress);
router.get('/detailed', userProgressController_1.default.getDetailedProgress);
router.get('/stats', userProgressController_1.default.getProgressStats);
router.get('/stats/:userId', userProgressController_1.default.getUserProgressStats);
router.get('/records', userProgressController_1.default.getUserProgressRecords);
router.get('/records/:userId', userProgressController_1.default.getUserProgressRecords);
router.delete('/record/:id', userProgressController_1.default.deleteProgressRecord);
router.get('/summary', userProgressController_1.default.getProgressSummary);
// 通用更新进度路由
router.post('/', userProgressController_1.default.updateProgress);
// 特定题库进度路由
router.post('/:questionSetId', userProgressController_1.default.updateProgress);
// 用户整体进度路由 - 需要放在最后
router.get('/:userId', userProgressController_1.default.getUserProgress);
router.get('/:userId/:questionSetId', userProgressController_1.default.getProgressByQuestionSetId);
router.delete('/:userId/:questionSetId', userProgressController_1.default.resetProgress);
exports.default = router;
