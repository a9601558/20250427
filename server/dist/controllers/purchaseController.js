"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.extendPurchase = exports.cancelPurchase = exports.getPurchaseById = exports.checkAccess = exports.getUserPurchases = exports.createPurchase = void 0;
const sequelize_1 = require("sequelize");
const models_1 = require("../models");
const uuid_1 = require("uuid");
// 统一响应格式
const sendResponse = (res, status, data, message) => {
    res.status(status).json({
        success: status >= 200 && status < 300,
        data,
        message
    });
};
// 统一错误响应
const sendError = (res, status, message, error) => {
    res.status(status).json({
        success: false,
        message,
        error: process.env.NODE_ENV === 'development' ? error?.message : undefined
    });
};
// @desc    Create purchase
// @route   POST /api/v1/purchases
// @access  Private
const createPurchase = async (req, res) => {
    try {
        const { questionSetId, paymentMethod, amount } = req.body;
        // 验证必填字段
        if (!questionSetId || !paymentMethod || !amount) {
            return sendError(res, 400, '请提供题库ID、支付方式和支付金额');
        }
        // 检查题库是否存在
        const questionSet = await models_1.QuestionSet.findByPk(questionSetId);
        if (!questionSet) {
            return sendError(res, 404, '题库不存在');
        }
        // 检查题库是否需要付费
        if (!questionSet.isPaid) {
            return sendError(res, 400, '该题库为免费题库');
        }
        // 检查金额是否正确
        if (amount !== questionSet.price) {
            return sendError(res, 400, '支付金额不正确');
        }
        // 检查用户是否已购买
        const existingPurchase = await models_1.Purchase.findOne({
            where: {
                userId: req.user.id,
                questionSetId,
                status: 'completed'
            }
        });
        if (existingPurchase) {
            return sendError(res, 400, '您已购买过该题库');
        }
        // 创建购买记录
        const purchase = await models_1.Purchase.create({
            id: (0, uuid_1.v4)(),
            userId: req.user.id,
            questionSetId,
            paymentMethod,
            amount,
            status: 'pending',
            expiryDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 有效期一年
            transactionId: (0, uuid_1.v4)(),
            purchaseDate: new Date()
        });
        // TODO: 调用支付接口处理支付
        // 这里应该调用实际的支付接口，比如微信支付、支付宝等
        // 支付成功后更新购买状态
        await purchase.update({ status: 'completed' });
        sendResponse(res, 201, purchase, '购买成功');
    }
    catch (error) {
        console.error('Create purchase error:', error);
        sendError(res, 500, '创建购买记录失败', error);
    }
};
exports.createPurchase = createPurchase;
// @desc    Get user's purchases
// @route   GET /api/v1/purchases
// @access  Private
const getUserPurchases = async (req, res) => {
    try {
        const purchases = await models_1.Purchase.findAll({
            where: { userId: req.user.id },
            include: [
                {
                    model: models_1.QuestionSet,
                    as: 'questionSet'
                }
            ],
            order: [['purchaseDate', 'DESC']]
        });
        sendResponse(res, 200, purchases);
    }
    catch (error) {
        console.error('Get purchases error:', error);
        sendError(res, 500, '获取购买记录失败', error);
    }
};
exports.getUserPurchases = getUserPurchases;
// @desc    Check access to question set
// @route   GET /api/v1/purchases/check/:questionSetId
// @access  Private
const checkAccess = async (req, res) => {
    try {
        const questionSetId = req.params.questionSetId;
        // 检查题库是否存在
        const questionSet = await models_1.QuestionSet.findByPk(questionSetId);
        if (!questionSet) {
            return sendError(res, 404, '题库不存在');
        }
        // 如果题库是免费的，直接返回有访问权限
        if (!questionSet.isPaid) {
            return sendResponse(res, 200, {
                hasAccess: true,
                isPaid: false
            });
        }
        // 查找有效的购买记录
        const purchase = await models_1.Purchase.findOne({
            where: {
                userId: req.user.id,
                questionSetId,
                status: 'completed',
                expiryDate: {
                    [sequelize_1.Op.gt]: new Date()
                }
            }
        });
        if (purchase) {
            // 计算剩余天数
            const remainingDays = Math.ceil((purchase.expiryDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
            sendResponse(res, 200, {
                hasAccess: true,
                isPaid: true,
                expiryDate: purchase.expiryDate,
                remainingDays
            });
        }
        else {
            sendResponse(res, 200, {
                hasAccess: false,
                isPaid: true,
                price: questionSet.price
            });
        }
    }
    catch (error) {
        console.error('Check access error:', error);
        sendError(res, 500, '检查访问权限失败', error);
    }
};
exports.checkAccess = checkAccess;
// @desc    Get purchase details
// @route   GET /api/v1/purchases/:id
// @access  Private
const getPurchaseById = async (req, res) => {
    try {
        const purchase = await models_1.Purchase.findOne({
            where: {
                id: req.params.id,
                userId: req.user.id
            },
            include: [
                {
                    model: models_1.QuestionSet,
                    as: 'QuestionSet'
                }
            ]
        });
        if (!purchase) {
            return sendError(res, 404, '购买记录不存在');
        }
        sendResponse(res, 200, purchase);
    }
    catch (error) {
        console.error('Get purchase error:', error);
        sendError(res, 500, '获取购买记录失败', error);
    }
};
exports.getPurchaseById = getPurchaseById;
// @desc    Cancel purchase
// @route   POST /api/v1/purchases/:id/cancel
// @access  Private
const cancelPurchase = async (req, res) => {
    try {
        const purchase = await models_1.Purchase.findOne({
            where: {
                id: req.params.id,
                userId: req.user.id,
                status: 'pending'
            }
        });
        if (!purchase) {
            return sendError(res, 404, '购买记录不存在或无法取消');
        }
        await purchase.update({ status: 'failed' });
        // TODO: 处理退款逻辑（如果需要）
        sendResponse(res, 200, purchase, '购买已取消');
    }
    catch (error) {
        console.error('Cancel purchase error:', error);
        sendError(res, 500, '取消购买失败', error);
    }
};
exports.cancelPurchase = cancelPurchase;
// @desc    Extend purchase validity
// @route   POST /api/v1/purchases/:id/extend
// @access  Private
const extendPurchase = async (req, res) => {
    try {
        const { months } = req.body;
        if (!months || months <= 0) {
            return sendError(res, 400, '请提供有效的延长月数');
        }
        const purchase = await models_1.Purchase.findOne({
            where: {
                id: req.params.id,
                userId: req.user.id,
                status: 'completed'
            }
        });
        if (!purchase) {
            return sendError(res, 404, '购买记录不存在');
        }
        // 计算新的有效期
        const newExpiryDate = new Date(purchase.expiryDate.getTime() + months * 30 * 24 * 60 * 60 * 1000);
        await purchase.update({ expiryDate: newExpiryDate });
        sendResponse(res, 200, purchase, '有效期延长成功');
    }
    catch (error) {
        console.error('Extend purchase error:', error);
        sendError(res, 500, '延长有效期失败', error);
    }
};
exports.extendPurchase = extendPurchase;
