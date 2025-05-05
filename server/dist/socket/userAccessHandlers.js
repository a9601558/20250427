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
exports.registerUserAccessHandlers = void 0;
const errors_1 = require("../utils/errors");
const purchaseService = __importStar(require("../services/purchaseService"));
const userService = __importStar(require("../services/userService"));
const logger_1 = __importDefault(require("../utils/logger"));
/**
 * 用户访问权限相关的socket处理器，处理用户跨设备同步
 */
const registerUserAccessHandlers = (socket, io) => {
    const userId = socket.data.userId;
    // 用户请求同步跨设备访问权限，从数据库加载最新权限
    socket.on('user:syncAccessRights', async (data) => {
        try {
            if (!userId || userId !== data.userId) {
                throw new errors_1.CustomError('Unauthorized access', 403);
            }
            logger_1.default.info(`[Socket] 用户 ${userId} 请求同步访问权限`);
            // 获取用户的最新购买记录
            const user = await userService.getUserById(userId);
            if (!user) {
                throw new errors_1.CustomError('User not found', 404);
            }
            // 获取有效的购买记录
            const purchases = await purchaseService.getActivePurchasesByUserId(userId);
            if (!purchases || purchases.length === 0) {
                logger_1.default.info(`[Socket] 用户 ${userId} 没有有效的购买记录`);
                return;
            }
            logger_1.default.info(`[Socket] 用户 ${userId} 有 ${purchases.length} 条有效购买记录`);
            // 计算每个题库的剩余天数并发送给客户端
            const now = new Date();
            // 处理每个有效的购买记录
            for (const purchase of purchases) {
                if (!purchase.questionSetId)
                    continue;
                const expiryDate = purchase.expiryDate ? new Date(purchase.expiryDate) : null;
                const isExpired = expiryDate && expiryDate <= now;
                if (!isExpired) {
                    // 计算剩余天数
                    let remainingDays = null;
                    if (expiryDate) {
                        const diffTime = expiryDate.getTime() - now.getTime();
                        remainingDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                    }
                    // 发送访问权限更新给客户端
                    socket.emit('questionSet:accessUpdate', {
                        userId,
                        questionSetId: purchase.questionSetId,
                        hasAccess: true,
                        remainingDays,
                        source: 'db_sync'
                    });
                }
            }
            // 通知客户端同步完成
            socket.emit('user:syncComplete', {
                userId,
                timestamp: Date.now(),
                totalSynced: purchases.length
            });
        }
        catch (error) {
            logger_1.default.error(`[Socket] 同步用户访问权限错误:`, error);
            socket.emit('error', {
                message: error instanceof errors_1.CustomError ? error.message : '同步访问权限失败',
                code: error instanceof errors_1.CustomError ? error.statusCode : 500
            });
        }
    });
    // 设备同步事件，允许一个设备通知其他设备进行更新
    socket.on('user:deviceSync', async (data) => {
        try {
            if (!userId || userId !== data.userId) {
                throw new errors_1.CustomError('Unauthorized access', 403);
            }
            logger_1.default.info(`[Socket] 用户 ${userId} 请求设备同步，类型: ${data.type}`);
            // 广播给该用户的其他设备（除了当前socket）
            socket.to(userId).emit('user:deviceSync', {
                userId,
                type: data.type,
                timestamp: data.timestamp || Date.now(),
                sourceDevice: socket.id
            });
        }
        catch (error) {
            logger_1.default.error(`[Socket] 设备同步错误:`, error);
            socket.emit('error', {
                message: error instanceof errors_1.CustomError ? error.message : '设备同步失败',
                code: error instanceof errors_1.CustomError ? error.statusCode : 500
            });
        }
    });
    // 获取题库访问权限并同步到所有设备
    socket.on('questionSet:checkAccess', async (data) => {
        try {
            if (!userId || userId !== data.userId) {
                throw new errors_1.CustomError('Unauthorized access', 403);
            }
            const { questionSetId } = data;
            if (!questionSetId) {
                throw new errors_1.CustomError('Question set ID is required', 400);
            }
            // 获取题库访问权限
            const hasAccess = await purchaseService.hasAccessToQuestionSet(userId, questionSetId);
            // 获取额外信息
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
            // 响应检查结果
            socket.emit('questionSet:accessResult', {
                userId,
                questionSetId,
                hasAccess,
                remainingDays,
                timestamp: Date.now()
            });
        }
        catch (error) {
            logger_1.default.error(`[Socket] 检查题库访问权限错误:`, error);
            socket.emit('error', {
                message: error instanceof errors_1.CustomError ? error.message : '检查题库访问权限失败',
                code: error instanceof errors_1.CustomError ? error.statusCode : 500
            });
        }
    });
    // 批量检查题库访问权限
    socket.on('questionSet:checkAccessBatch', async (data) => {
        try {
            if (!userId || userId !== data.userId) {
                throw new errors_1.CustomError('Unauthorized access', 403);
            }
            const { questionSetIds } = data;
            if (!questionSetIds || !Array.isArray(questionSetIds) || questionSetIds.length === 0) {
                throw new errors_1.CustomError('Question set IDs are required', 400);
            }
            logger_1.default.info(`[Socket] 用户 ${userId} 批量检查 ${questionSetIds.length} 个题库的访问权限`);
            // 获取最新购买记录
            const purchases = await purchaseService.getActivePurchasesByUserId(userId);
            const purchaseMap = new Map();
            // 建立题库ID与购买记录的映射
            purchases.forEach(purchase => {
                if (purchase.questionSetId) {
                    purchaseMap.set(purchase.questionSetId, purchase);
                }
            });
            // 检查每个题库的访问权限
            const now = new Date();
            const results = questionSetIds.map(questionSetId => {
                const purchase = purchaseMap.get(questionSetId);
                let hasAccess = false;
                let remainingDays = null;
                if (purchase) {
                    const expiryDate = purchase.expiryDate ? new Date(purchase.expiryDate) : null;
                    hasAccess = !expiryDate || expiryDate > now;
                    if (hasAccess && expiryDate) {
                        const diffTime = expiryDate.getTime() - now.getTime();
                        remainingDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                    }
                }
                return {
                    questionSetId,
                    hasAccess,
                    remainingDays
                };
            });
            // 发送批量结果
            socket.emit('questionSet:accessBatchResult', {
                userId,
                results,
                timestamp: Date.now()
            });
            // 单独发送每个题库的结果，以便客户端可以更新本地缓存
            results.forEach(result => {
                socket.emit('questionSet:accessResult', {
                    userId,
                    questionSetId: result.questionSetId,
                    hasAccess: result.hasAccess,
                    remainingDays: result.remainingDays,
                    timestamp: Date.now()
                });
            });
        }
        catch (error) {
            logger_1.default.error(`[Socket] 批量检查题库访问权限错误:`, error);
            socket.emit('error', {
                message: error instanceof errors_1.CustomError ? error.message : '批量检查题库访问权限失败',
                code: error instanceof errors_1.CustomError ? error.statusCode : 500
            });
        }
    });
    // 处理客户端主动同步的访问权限更新
    socket.on('questionSet:accessUpdate', (data) => {
        try {
            if (!userId || userId !== data.userId) {
                throw new errors_1.CustomError('Unauthorized access', 403);
            }
            const { questionSetId, hasAccess, remainingDays, source } = data;
            logger_1.default.info(`[Socket] 用户 ${userId} 更新题库 ${questionSetId} 的访问权限: ${hasAccess ? '有权限' : '无权限'}, 来源: ${source || '未知'}`);
            // 广播给该用户的其他设备（除了当前socket）
            socket.to(userId).emit('questionSet:accessUpdate', {
                userId,
                questionSetId,
                hasAccess,
                remainingDays,
                timestamp: Date.now(),
                source: 'user_sync',
                sourceDevice: socket.id
            });
        }
        catch (error) {
            logger_1.default.error(`[Socket] 更新题库访问权限错误:`, error);
            socket.emit('error', {
                message: error instanceof errors_1.CustomError ? error.message : '更新题库访问权限失败',
                code: error instanceof errors_1.CustomError ? error.statusCode : 500
            });
        }
    });
};
exports.registerUserAccessHandlers = registerUserAccessHandlers;
