"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateUserLastActive = exports.registerUserDevice = exports.getUserDevices = exports.getUserById = void 0;
const logger_1 = __importDefault(require("../utils/logger"));
const User_1 = __importDefault(require("../models/User"));
/**
 * 根据用户ID获取用户信息
 */
const getUserById = async (userId, options = {}) => {
    try {
        const { includeAssociations = false, log = false } = options;
        if (log) {
            logger_1.default.info(`获取用户信息: ${userId}, 包含关联: ${includeAssociations}`);
        }
        // 准备查询选项
        const queryOptions = {
            attributes: { exclude: ['password'] }
        };
        // 如果需要包含关联数据
        if (includeAssociations) {
            queryOptions.include = [
                {
                    association: 'userPurchases',
                    attributes: ['id', 'questionSetId', 'purchaseDate', 'expiryDate', 'status', 'paymentMethod', 'amount', 'transactionId']
                },
                {
                    association: 'redeemCodes'
                }
            ];
        }
        // 执行数据库查询
        const user = await User_1.default.findByPk(userId, queryOptions);
        if (!user) {
            if (log) {
                logger_1.default.warn(`未找到用户: ${userId}`);
            }
            return null;
        }
        if (log) {
            logger_1.default.info(`已找到用户: ${userId}, 包含购买记录: ${user.purchases?.length || 0} 条`);
        }
        // 返回用户数据
        return user;
    }
    catch (error) {
        logger_1.default.error(`获取用户信息失败:`, error);
        return null;
    }
};
exports.getUserById = getUserById;
/**
 * 获取用户的所有设备信息
 */
const getUserDevices = async (userId) => {
    try {
        // 模拟从数据库获取用户设备
        // 实际实现中应该使用真实的数据库查询
        return ['device1', 'device2']; // 示例设备ID列表
    }
    catch (error) {
        logger_1.default.error(`获取用户设备失败:`, error);
        return [];
    }
};
exports.getUserDevices = getUserDevices;
/**
 * 注册用户的新设备
 */
const registerUserDevice = async (userId, deviceId) => {
    try {
        logger_1.default.info(`注册用户设备: ${userId}, ${deviceId}`);
        // 模拟向数据库注册设备
        // 实际实现中应该使用真实的数据库操作
        return true;
    }
    catch (error) {
        logger_1.default.error(`注册用户设备失败:`, error);
        return false;
    }
};
exports.registerUserDevice = registerUserDevice;
/**
 * 更新用户的最后活动时间
 */
const updateUserLastActive = async (userId) => {
    try {
        logger_1.default.info(`更新用户最后活动时间: ${userId}`);
        // 模拟更新用户活动时间
        // 实际实现中应该使用真实的数据库操作
        return true;
    }
    catch (error) {
        logger_1.default.error(`更新用户活动时间失败:`, error);
        return false;
    }
};
exports.updateUserLastActive = updateUserLastActive;
