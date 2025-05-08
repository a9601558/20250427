"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const purchaseController_1 = require("../controllers/purchaseController");
const authMiddleware_1 = require("../middleware/authMiddleware");
const purchaseService = __importStar(require("../services/purchaseService"));
const logger_1 = __importDefault(require("../utils/logger"));
const errors_1 = require("../utils/errors");
const router = express_1.default.Router();
// All purchase routes require authentication
router.use(authMiddleware_1.protect);
// Purchase routes
router.post('/', purchaseController_1.createPurchase);
router.get('/', purchaseController_1.getUserPurchases);
router.get('/check/:questionSetId', purchaseController_1.checkAccess);
router.get('/active', purchaseController_1.getActivePurchases);
router.post('/force-create', purchaseController_1.forceCreatePurchase);
/**
 * 检查用户对题库的访问权限
 * GET /api/purchases/check/:questionSetId
 */
router.get('/check/:questionSetId', async (req, res) => {
    try {
        const { questionSetId } = req.params;
        const userId = req.query.userId || req.body.userId;
        if (!userId) {
            return res.status(400).json({
                success: false,
                message: '缺少用户ID'
            });
        }
        logger_1.default.info(`API - 检查用户 ${userId} 对题库 ${questionSetId} 的访问权限`);
        // 检查数据库中的购买记录
        const hasAccess = await purchaseService.hasAccessToQuestionSet(userId, questionSetId);
        // 如果有访问权限，获取剩余天数
        let remainingDays = null;
        if (hasAccess) {
            const purchase = await purchaseService.getLatestPurchaseForQuestionSet(userId, questionSetId);
            if (purchase && purchase.expiryDate) {
                const now = new Date();
                const expiryDate = new Date(purchase.expiryDate);
                const diffTime = expiryDate.getTime() - now.getTime();
                remainingDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            }
        }
        return res.json({
            success: true,
            data: {
                hasAccess,
                remainingDays,
                timestamp: Date.now()
            }
        });
    }
    catch (error) {
        logger_1.default.error('检查题库访问权限API错误:', error);
        return res.status(500).json({
            success: false,
            message: error instanceof errors_1.CustomError ? error.message : '检查访问权限失败'
        });
    }
});
/**
 * 获取用户的所有购买记录
 * GET /api/purchases/user/:userId
 */
router.get('/user/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        logger_1.default.info(`API - 获取用户 ${userId} 的所有购买记录`);
        // 获取用户的购买记录
        const purchases = await purchaseService.getActivePurchasesByUserId(userId);
        return res.json({
            success: true,
            data: purchases
        });
    }
    catch (error) {
        logger_1.default.error('获取用户购买记录API错误:', error);
        return res.status(500).json({
            success: false,
            message: error instanceof errors_1.CustomError ? error.message : '获取购买记录失败'
        });
    }
});
exports.default = router;
