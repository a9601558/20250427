"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const stripe_1 = require("../services/stripe");
const auth_1 = require("../middlewares/auth");
const models_1 = __importDefault(require("../models"));
const uuid_1 = require("uuid");
const router = express_1.default.Router();
// 创建支付Intent
router.post('/create-intent', auth_1.authenticateJwt, async (req, res) => {
    try {
        const { amount, currency, metadata } = req.body;
        if (!amount || !currency) {
            return res.status(400).json({
                success: false,
                message: '请提供有效的支付金额和货币'
            });
        }
        // 确保金额有效
        const numericAmount = parseInt(String(amount), 10);
        if (isNaN(numericAmount) || numericAmount <= 0) {
            return res.status(400).json({
                success: false,
                message: '支付金额必须大于0'
            });
        }
        console.log(`[支付路由] 创建支付意向: 金额=${numericAmount}, 货币=${currency}`);
        // 确保用户ID与认证用户匹配
        if (metadata && metadata.userId && metadata.userId !== req.user?.id) {
            return res.status(403).json({
                success: false,
                message: '用户ID不匹配'
            });
        }
        // 添加用户ID到元数据
        const enhancedMetadata = {
            ...metadata,
            userId: req.user?.id
        };
        // 创建支付Intent
        const paymentIntent = await (0, stripe_1.stripePaymentIntent)({
            amount: numericAmount,
            currency,
            metadata: enhancedMetadata
        });
        console.log(`[支付路由] 支付意向创建成功: ${paymentIntent.id}`);
        res.json({
            success: true,
            clientSecret: paymentIntent.client_secret,
            paymentIntentId: paymentIntent.id
        });
    }
    catch (error) {
        console.error('创建支付Intent失败:', error);
        res.status(500).json({
            success: false,
            message: '创建支付处理失败',
            error: error instanceof Error ? error.message : '未知错误'
        });
    }
});
// 验证支付状态
router.get('/verify/:paymentIntentId', auth_1.authenticateJwt, async (req, res) => {
    try {
        const { paymentIntentId } = req.params;
        if (!paymentIntentId) {
            return res.status(400).json({
                success: false,
                message: '请提供有效的支付ID'
            });
        }
        console.log(`[支付路由] 验证支付状态: ${paymentIntentId}`);
        // 验证支付Intent
        const verification = await (0, stripe_1.verifyPaymentIntent)(paymentIntentId);
        // 检查用户ID是否匹配
        if (verification.metadata?.userId && verification.metadata.userId !== req.user?.id) {
            return res.status(403).json({
                success: false,
                message: '无权访问此支付记录'
            });
        }
        // 如果支付成功且尚未记录，创建购买记录
        if (verification.isSuccessful && verification.metadata?.questionSetId) {
            // 检查是否已经存在此支付的购买记录
            const existingPurchase = await models_1.default.Purchase.findOne({
                where: {
                    transactionId: paymentIntentId,
                    userId: req.user?.id
                }
            });
            if (existingPurchase) {
                // 如果记录已存在但状态不是active，更新为active
                if (existingPurchase.status !== 'active') {
                    console.log(`[支付路由] 更新购买记录状态: ${existingPurchase.id}`);
                    await existingPurchase.update({
                        status: 'active',
                        updatedAt: new Date()
                    });
                    // 发送购买成功事件
                    if (req.app.get('io')) {
                        const io = req.app.get('io');
                        io.emit('purchase:success', {
                            userId: req.user?.id,
                            questionSetId: verification.metadata.questionSetId,
                            purchaseId: existingPurchase.id,
                            expiryDate: existingPurchase.expiryDate.toISOString()
                        });
                        // 更新访问权限
                        io.emit('questionSet:accessUpdate', {
                            userId: req.user?.id,
                            questionSetId: verification.metadata.questionSetId,
                            hasAccess: true
                        });
                    }
                }
            }
            else {
                // 计算过期时间（6个月后）
                const now = new Date();
                const expiryDate = new Date(now);
                expiryDate.setMonth(expiryDate.getMonth() + 6);
                console.log(`[支付路由] 创建新购买记录，用户: ${req.user?.id}, 题库: ${verification.metadata.questionSetId}`);
                // 创建购买记录
                await models_1.default.Purchase.create({
                    id: (0, uuid_1.v4)(),
                    userId: req.user?.id,
                    questionSetId: verification.metadata.questionSetId,
                    purchaseDate: now,
                    expiryDate,
                    amount: verification.amount / 100, // 转换回元
                    transactionId: paymentIntentId,
                    paymentMethod: 'card',
                    status: 'active'
                });
                // 发送购买成功事件
                if (req.app.get('io')) {
                    const io = req.app.get('io');
                    io.emit('purchase:success', {
                        userId: req.user?.id,
                        questionSetId: verification.metadata.questionSetId,
                        purchaseId: (0, uuid_1.v4)(),
                        expiryDate: expiryDate.toISOString()
                    });
                    // 更新访问权限
                    io.emit('questionSet:accessUpdate', {
                        userId: req.user?.id,
                        questionSetId: verification.metadata.questionSetId,
                        hasAccess: true
                    });
                }
            }
        }
        res.json({
            success: true,
            status: verification.status,
            isSuccessful: verification.isSuccessful,
            questionSetId: verification.metadata?.questionSetId
        });
    }
    catch (error) {
        console.error('验证支付状态失败:', error);
        res.status(500).json({
            success: false,
            message: '验证支付失败',
            error: error instanceof Error ? error.message : '未知错误'
        });
    }
});
// Stripe Webhook接收端点
router.post('/webhook', express_1.default.raw({ type: 'application/json' }), async (req, res) => {
    const signature = req.headers['stripe-signature'];
    if (!signature) {
        return res.status(400).send('缺少Stripe签名');
    }
    try {
        // Convert request body to string for constructEvent
        const payload = req.body.toString();
        const event = (0, stripe_1.constructEvent)(payload, signature);
        // 处理不同类型的事件
        switch (event.type) {
            case 'payment_intent.succeeded':
                const paymentIntent = event.data.object;
                // 处理成功的支付
                console.log('支付成功:', paymentIntent.id);
                // 如果有元数据，创建购买记录
                if (paymentIntent.metadata?.userId && paymentIntent.metadata?.questionSetId) {
                    const userId = paymentIntent.metadata.userId;
                    const questionSetId = paymentIntent.metadata.questionSetId;
                    // 检查是否已经存在此支付的购买记录
                    const existingPurchase = await models_1.default.Purchase.findOne({
                        where: {
                            transactionId: paymentIntent.id,
                            userId
                        }
                    });
                    if (!existingPurchase) {
                        // 计算过期时间（6个月后）
                        const now = new Date();
                        const expiryDate = new Date(now);
                        expiryDate.setMonth(expiryDate.getMonth() + 6);
                        // 创建购买记录
                        await models_1.default.Purchase.create({
                            id: (0, uuid_1.v4)(),
                            userId,
                            questionSetId,
                            purchaseDate: now,
                            expiryDate,
                            amount: paymentIntent.amount / 100, // 转换回元
                            transactionId: paymentIntent.id,
                            paymentMethod: 'card',
                            status: 'active'
                        });
                        // 发送购买成功事件
                        if (req.app.get('io')) {
                            const io = req.app.get('io');
                            io.emit('purchase:success', {
                                userId,
                                questionSetId,
                                purchaseId: (0, uuid_1.v4)(),
                                expiryDate: expiryDate.toISOString()
                            });
                            // 更新访问权限
                            io.emit('questionSet:accessUpdate', {
                                userId,
                                questionSetId,
                                hasAccess: true
                            });
                        }
                    }
                }
                break;
            // 其他事件类型可以在这里处理
            case 'payment_intent.payment_failed':
                console.log('支付失败:', event.data.object);
                break;
            default:
                console.log(`未处理的事件类型: ${event.type}`);
        }
        // 向Stripe返回成功响应
        res.status(200).send('Event received');
    }
    catch (error) {
        console.error('处理Stripe Webhook错误:', error);
        res.status(400).send('Webhook Error');
    }
});
exports.default = router;
