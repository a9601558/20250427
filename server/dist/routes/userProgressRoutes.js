"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const userProgressController_1 = __importDefault(require("../controllers/userProgressController"));
const authMiddleware_1 = require("../middleware/authMiddleware");
const router = express_1.default.Router();
// 公共路由 - 不需要身份验证
router.post('/beacon', userProgressController_1.default.syncProgressViaBeacon);
// 其他所有进度路由需要认证
router.use(authMiddleware_1.protect);
// 详细进度记录路由 - 需要放在前面以避免和通用路由冲突
router.get('/detailed/:userId/:questionSetId', userProgressController_1.default.getDetailedProgress);
router.post('/detailed', userProgressController_1.default.createDetailedProgress);
// 进度统计路由
router.get('/stats/:userId/:questionSetId', userProgressController_1.default.getProgressStats);
router.get('/stats/:userId', userProgressController_1.default.getUserProgressStats);
router.get('/summary/:userId', userProgressController_1.default.getProgressSummary);
// 进度记录路由
router.get('/records/:userId', userProgressController_1.default.getUserProgressRecords);
// 更新与重置路由
router.post('/update', userProgressController_1.default.updateProgress);
router.delete('/reset/:userId/:questionSetId', userProgressController_1.default.resetProgress);
router.delete('/:userId/:progressId', userProgressController_1.default.deleteProgressRecord);
// 基本进度查询路由
router.get('/:userId/:questionSetId', userProgressController_1.default.getProgressByQuestionSetId);
router.get('/:userId', userProgressController_1.default.getUserProgress);
exports.default = router;
