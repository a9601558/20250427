"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getLatestPurchaseForQuestionSet = exports.hasAccessToQuestionSet = exports.getActivePurchasesByUserId = void 0;
const logger_1 = __importDefault(require("../utils/logger"));
const errors_1 = require("../utils/errors");
const Purchase_1 = __importDefault(require("../models/Purchase"));
const sequelize_1 = require("sequelize");
/**
 * 获取用户的活跃购买记录
 */
const getActivePurchasesByUserId = async (userId) => {
    try {
        logger_1.default.info(`获取用户 ${userId} 的活跃购买记录`);
        // 获取当前日期
        const now = new Date();
        // 使用Sequelize模型查询数据库，使用类型断言绕过TypeScript类型检查
        const whereClause = {
            userId: userId,
            [sequelize_1.Op.or]: [
                {
                    // 有效期未过期
                    expiryDate: { [sequelize_1.Op.gt]: now },
                    status: { [sequelize_1.Op.in]: ['active', 'completed'] }
                },
                {
                    // 无过期时间，使用null
                    expiryDate: null,
                    status: { [sequelize_1.Op.in]: ['active', 'completed'] }
                }
            ]
        }; // 使用类型断言
        const purchases = await Purchase_1.default.findAll({
            where: whereClause,
            // 添加详细日志以帮助调试
            logging: (sql) => {
                logger_1.default.debug(`[PurchaseService] SQL查询: ${sql}`);
            }
        });
        // 检查是否有结果
        if (!purchases || purchases.length === 0) {
            logger_1.default.warn(`用户 ${userId} 没有活跃的购买记录`);
            return [];
        }
        // 转换为标准格式并记录
        const results = purchases.map(p => {
            // 将数据库模型转换为纯对象
            const purchase = p.get({ plain: true });
            // 创建标准格式的Purchase对象
            const formattedPurchase = {
                id: purchase.id,
                userId: purchase.userId,
                questionSetId: purchase.questionSetId,
                purchaseDate: purchase.purchaseDate,
                expiryDate: purchase.expiryDate,
                status: purchase.status,
                amount: purchase.amount,
                transactionId: purchase.transactionId,
                paymentMethod: purchase.paymentMethod || 'unknown',
                price: 0, // 默认值
                currency: 'CNY', // 默认值
                createdAt: purchase.createdAt || new Date(),
                updatedAt: purchase.updatedAt || new Date()
            };
            return formattedPurchase;
        });
        logger_1.default.info(`已找到用户 ${userId} 的 ${results.length} 条活跃购买记录`);
        return results;
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
        // 获取当前日期
        const now = new Date();
        // 使用类型断言绕过TypeScript类型检查
        const whereClause = {
            userId: userId,
            questionSetId: questionSetId,
            [sequelize_1.Op.or]: [
                {
                    // 有效期未过期
                    expiryDate: { [sequelize_1.Op.gt]: now },
                    status: { [sequelize_1.Op.in]: ['active', 'completed'] }
                },
                {
                    // 无过期时间
                    expiryDate: null,
                    status: { [sequelize_1.Op.in]: ['active', 'completed'] }
                }
            ]
        };
        // 直接查询数据库，检查是否有有效的购买记录
        const purchase = await Purchase_1.default.findOne({
            where: whereClause
        });
        // 如果找到有效购买记录，则有访问权限
        const hasAccess = !!purchase;
        logger_1.default.info(`用户 ${userId} 对题库 ${questionSetId} 的访问权限: ${hasAccess}`);
        return hasAccess;
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
        // 直接查询数据库，获取最新的购买记录
        const purchase = await Purchase_1.default.findOne({
            where: {
                userId: userId,
                questionSetId: questionSetId
            },
            order: [['purchaseDate', 'DESC']] // 按购买日期降序排序，获取最新的
        });
        if (!purchase) {
            logger_1.default.warn(`用户 ${userId} 没有题库 ${questionSetId} 的购买记录`);
            return null;
        }
        // 转换为标准格式
        const result = {
            id: purchase.id,
            userId: purchase.userId,
            questionSetId: purchase.questionSetId,
            purchaseDate: purchase.purchaseDate,
            expiryDate: purchase.expiryDate,
            status: purchase.status,
            amount: purchase.amount,
            transactionId: purchase.transactionId,
            paymentMethod: purchase.paymentMethod || 'unknown',
            price: 0, // 默认值
            currency: 'CNY', // 默认值
            createdAt: purchase.createdAt || new Date(),
            updatedAt: purchase.updatedAt || new Date()
        };
        logger_1.default.info(`已找到用户 ${userId} 的题库 ${questionSetId} 的最新购买记录，日期: ${result.purchaseDate}`);
        return result;
    }
    catch (error) {
        logger_1.default.error(`获取最新购买记录出错:`, error);
        return null;
    }
};
exports.getLatestPurchaseForQuestionSet = getLatestPurchaseForQuestionSet;
