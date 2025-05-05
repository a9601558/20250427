"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getLatestPurchaseForQuestionSet = exports.hasAccessToQuestionSet = exports.getActivePurchasesByUserId = void 0;
const logger_1 = __importDefault(require("../utils/logger"));
const errors_1 = require("../utils/errors");
/**
 * 获取用户的活跃购买记录
 */
const getActivePurchasesByUserId = async (userId) => {
    try {
        logger_1.default.info(`获取用户 ${userId} 的活跃购买记录`);
        // 模拟从数据库获取购买记录
        // 实际实现中应该使用真实的数据库查询
        const purchases = [
        // 示例数据，真实环境需替换为数据库查询
        ];
        // 过滤出活跃的记录
        const now = new Date();
        const activePurchases = purchases.filter(purchase => {
            const expiryDate = purchase.expiryDate ? new Date(purchase.expiryDate) : null;
            const isExpired = expiryDate && expiryDate <= now;
            const isActive = purchase.status === 'active' || purchase.status === 'completed';
            return !isExpired && isActive;
        });
        return activePurchases;
    }
    catch (error) {
        logger_1.default.error('获取活跃购买记录出错:', error);
        throw new errors_1.CustomError('获取活跃购买记录失败', 500);
    }
};
exports.getActivePurchasesByUserId = getActivePurchasesByUserId;
/**
 * 检查用户是否有访问题库的权限
 */
const hasAccessToQuestionSet = async (userId, questionSetId) => {
    try {
        logger_1.default.info(`检查用户 ${userId} 对题库 ${questionSetId} 的访问权限`);
        // 获取用户最新的购买记录
        const purchases = await (0, exports.getActivePurchasesByUserId)(userId);
        // 检查购买记录中是否包含此题库
        const purchase = purchases.find(p => p.questionSetId === questionSetId);
        if (!purchase) {
            return false;
        }
        // 检查购买记录是否有效
        const now = new Date();
        const expiryDate = purchase.expiryDate ? new Date(purchase.expiryDate) : null;
        const isExpired = expiryDate && expiryDate <= now;
        const isActive = purchase.status === 'active' || purchase.status === 'completed';
        return !isExpired && isActive;
    }
    catch (error) {
        logger_1.default.error(`检查题库访问权限出错:`, error);
        return false;
    }
};
exports.hasAccessToQuestionSet = hasAccessToQuestionSet;
/**
 * 获取用户对特定题库的最新购买记录
 */
const getLatestPurchaseForQuestionSet = async (userId, questionSetId) => {
    try {
        logger_1.default.info(`获取用户 ${userId} 对题库 ${questionSetId} 的最新购买记录`);
        // 获取用户所有的购买记录
        const purchases = await (0, exports.getActivePurchasesByUserId)(userId);
        // 找出最新的购买记录
        const questionSetPurchases = purchases
            .filter(p => p.questionSetId === questionSetId)
            .sort((a, b) => {
            const dateA = new Date(a.purchaseDate).getTime();
            const dateB = new Date(b.purchaseDate).getTime();
            return dateB - dateA; // 降序，最新的在前
        });
        return questionSetPurchases.length > 0 ? questionSetPurchases[0] : null;
    }
    catch (error) {
        logger_1.default.error(`获取最新购买记录出错:`, error);
        return null;
    }
};
exports.getLatestPurchaseForQuestionSet = getLatestPurchaseForQuestionSet;
