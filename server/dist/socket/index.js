"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.initializeSocket = void 0;
const QuestionSet_1 = __importDefault(require("../models/QuestionSet"));
const User_1 = __importDefault(require("../models/User"));
const Purchase_1 = __importDefault(require("../models/Purchase"));
const sequelize_1 = require("sequelize");
const uuid_1 = require("uuid");
const UserProgress_1 = __importDefault(require("../models/UserProgress"));
const initializeSocket = (io) => {
    io.on('connection', (socket) => {
        console.log('Client connected:', socket.id);
        // 处理用户认证
        socket.on('authenticate', async (data) => {
            try {
                const { userId } = data;
                if (!userId) {
                    socket.emit('auth_error', { message: '缺少用户ID' });
                    return;
                }
                // 更新用户的socket_id
                await User_1.default.update({ socket_id: socket.id }, { where: { id: userId } });
                // 将socket加入用户房间
                socket.join(userId);
                console.log(`用户 ${userId} 已认证并加入房间`);
                socket.emit('auth_success', { message: '认证成功' });
            }
            catch (error) {
                console.error('认证错误:', error);
                socket.emit('auth_error', { message: '认证失败' });
            }
        });
        // 监听题库更新事件
        socket.on('questionSet:update', async (data) => {
            try {
                const questionSet = await QuestionSet_1.default.findByPk(data.questionSetId, {
                    include: [
                        {
                            model: User_1.default,
                            as: 'users',
                            through: { attributes: [] }
                        }
                    ]
                });
                if (questionSet) {
                    // 向所有连接的客户端发送题库更新
                    io.emit('questionSet:update', {
                        id: questionSet.id,
                        title: questionSet.title,
                        description: questionSet.description,
                        isPaid: questionSet.isPaid,
                        isFeatured: questionSet.isFeatured,
                        price: questionSet.price,
                        trialQuestions: questionSet.trialQuestions,
                        category: questionSet.category,
                        updatedAt: questionSet.updatedAt
                    });
                    // 如果题库是付费的，检查所有相关用户的购买状态
                    if (questionSet.isPaid) {
                        const purchases = await Purchase_1.default.findAll({
                            where: {
                                questionSetId: questionSet.id,
                                expiryDate: {
                                    [sequelize_1.Op.gt]: new Date()
                                }
                            },
                            include: [
                                {
                                    model: QuestionSet_1.default,
                                    as: 'purchaseQuestionSet'
                                }
                            ]
                        });
                        // 向有购买权限的用户发送更新
                        purchases.forEach((purchase) => {
                            if (purchase.user && purchase.user.socket_id) {
                                io.to(purchase.user.socket_id).emit('questionSet:accessUpdate', {
                                    questionSetId: purchase.questionSetId,
                                    hasAccess: true,
                                    remainingDays: Math.ceil((new Date(purchase.expiryDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
                                });
                            }
                        });
                    }
                }
            }
            catch (error) {
                console.error('Error handling question set update:', error);
            }
        });
        // 监听用户连接事件
        socket.on('user:connect', async (data) => {
            try {
                const user = await User_1.default.findByPk(data.userId);
                if (user) {
                    // 将socket加入用户房间
                    socket.join(user.id.toString());
                    console.log(`用户 ${user.id} 已连接并加入房间`);
                }
            }
            catch (error) {
                console.error('Error handling user connection:', error);
            }
        });
        // 处理断开连接
        socket.on('disconnect', async () => {
            console.log('Client disconnected:', socket.id);
            // 清除用户的socket_id
            await User_1.default.update({ socket_id: null }, { where: { socket_id: socket.id } });
        });
        // 监听用户购买事件
        socket.on('purchase:create', async (data) => {
            try {
                const user = await User_1.default.findByPk(data.userId);
                const questionSet = await QuestionSet_1.default.findByPk(data.questionSetId);
                if (user && questionSet) {
                    // 创建新的购买记录
                    const purchase = await Purchase_1.default.create({
                        id: (0, uuid_1.v4)(),
                        userId: user.id.toString(),
                        questionSetId: questionSet.id,
                        purchaseDate: new Date(),
                        expiryDate: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000), // 6个月有效期
                        amount: questionSet.price || 0,
                        status: 'completed',
                        createdAt: new Date(),
                        updatedAt: new Date()
                    });
                    // 更新用户的购买记录
                    await user.update({
                        purchases: [...(user.purchases || []), purchase]
                    });
                    // 向用户发送购买成功通知
                    if (user.socket_id) {
                        io.to(user.socket_id).emit('purchase:success', {
                            questionSetId: purchase.questionSetId,
                            purchaseId: purchase.id,
                            expiryDate: purchase.expiryDate
                        });
                    }
                }
            }
            catch (error) {
                console.error('Error handling purchase creation:', error);
            }
        });
        // 监听用户访问权限检查事件
        socket.on('questionSet:checkAccess', async (data) => {
            try {
                const user = await User_1.default.findByPk(data.userId);
                const questionSet = await QuestionSet_1.default.findByPk(data.questionSetId);
                if (user && questionSet) {
                    if (!questionSet.isPaid) {
                        // 免费题库，直接返回有访问权限
                        if (user.socket_id) {
                            io.to(user.socket_id).emit('questionSet:accessUpdate', {
                                questionSetId: questionSet.id,
                                hasAccess: true,
                                remainingDays: null
                            });
                        }
                        return;
                    }
                    // 检查用户的购买记录
                    const purchase = await Purchase_1.default.findOne({
                        where: {
                            userId: user.id,
                            questionSetId: questionSet.id,
                            expiryDate: {
                                [sequelize_1.Op.gt]: new Date()
                            }
                        }
                    });
                    if (purchase && user.socket_id) {
                        // 有有效的购买记录
                        const remainingDays = Math.ceil((new Date(purchase.expiryDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
                        io.to(user.socket_id).emit('questionSet:accessUpdate', {
                            questionSetId: purchase.questionSetId,
                            hasAccess: true,
                            remainingDays
                        });
                    }
                    else if (user.socket_id) {
                        // 没有有效的购买记录
                        io.to(user.socket_id).emit('questionSet:accessUpdate', {
                            questionSetId: data.questionSetId,
                            hasAccess: false,
                            remainingDays: null
                        });
                    }
                }
            }
            catch (error) {
                console.error('Error checking question set access:', error);
            }
        });
        // 获取用户的所有购买记录
        socket.on('purchase:getAll', async (data) => {
            try {
                const purchases = await Purchase_1.default.findAll({
                    where: { userId: data.userId },
                    include: [
                        {
                            model: QuestionSet_1.default,
                            as: 'purchaseQuestionSet'
                        },
                        {
                            model: User_1.default,
                            as: 'purchaseUser'
                        }
                    ],
                    order: [['purchaseDate', 'DESC']]
                });
                if (socket.connected) {
                    socket.emit('purchase:list', purchases);
                }
            }
            catch (error) {
                console.error('Error getting purchases:', error);
                if (socket.connected) {
                    socket.emit('error', { message: '获取购买记录失败' });
                }
            }
        });
        // 更新购买记录
        socket.on('purchase:update', async (data) => {
            try {
                const purchase = await Purchase_1.default.findByPk(data.purchaseId, {
                    include: [
                        { model: User_1.default, as: 'purchaseUser' },
                        { model: QuestionSet_1.default, as: 'purchaseQuestionSet' }
                    ]
                });
                if (purchase) {
                    await purchase.update(data.updates);
                    // 向用户发送更新通知
                    if (purchase.user?.socket_id) {
                        io.to(purchase.user.socket_id).emit('purchase:update', purchase);
                    }
                }
            }
            catch (error) {
                console.error('Error updating purchase:', error);
            }
        });
        // 删除购买记录
        socket.on('purchase:delete', async (data) => {
            try {
                const purchase = await Purchase_1.default.findByPk(data.purchaseId, {
                    include: [{ model: User_1.default, as: 'purchaseUser' }]
                });
                if (purchase) {
                    const userId = purchase.userId;
                    await purchase.destroy();
                    // 向用户发送删除通知
                    if (purchase.user?.socket_id) {
                        io.to(purchase.user.socket_id).emit('purchase:delete', data.purchaseId);
                    }
                }
            }
            catch (error) {
                console.error('Error deleting purchase:', error);
            }
        });
        // 处理购买记录过期
        socket.on('purchase:expire', async (data) => {
            try {
                const purchase = await Purchase_1.default.findByPk(data.purchaseId, {
                    include: [{ model: User_1.default, as: 'purchaseUser' }]
                });
                if (purchase && purchase.user?.socket_id) {
                    io.to(purchase.user.socket_id).emit('purchase:expire', {
                        questionSetId: purchase.questionSetId,
                        purchaseId: purchase.id
                    });
                }
            }
            catch (error) {
                console.error('Error handling purchase expiration:', error);
            }
        });
        // 定期检查过期的购买记录
        setInterval(async () => {
            try {
                const expiredPurchases = await Purchase_1.default.findAll({
                    where: {
                        expiryDate: {
                            [sequelize_1.Op.lt]: new Date(),
                            [sequelize_1.Op.gt]: new Date(Date.now() - 24 * 60 * 60 * 1000) // 过去24小时内过期的
                        }
                    },
                    include: [{ model: User_1.default, as: 'purchaseUser' }]
                });
                expiredPurchases.forEach(purchase => {
                    if (purchase.user?.socket_id) {
                        io.to(purchase.user.socket_id).emit('purchase:expire', {
                            questionSetId: purchase.questionSetId,
                            purchaseId: purchase.id
                        });
                    }
                });
            }
            catch (error) {
                console.error('Error checking expired purchases:', error);
            }
        }, 60 * 60 * 1000); // 每小时检查一次
        // 处理进度更新
        socket.on('progress:update', async (data) => {
            try {
                // 验证必要参数
                if (!data.userId || !data.questionSetId || !data.questionId) {
                    socket.emit('progress_error', { message: '缺少必要参数' });
                    return;
                }
                const user = await User_1.default.findByPk(data.userId);
                if (!user) {
                    socket.emit('progress_error', { message: '用户不存在' });
                    return;
                }
                // 创建或更新数据库中的进度记录
                const [dbProgress, created] = await UserProgress_1.default.findOrCreate({
                    where: {
                        userId: data.userId,
                        questionSetId: data.questionSetId,
                        questionId: data.questionId
                    },
                    defaults: {
                        userId: data.userId,
                        questionSetId: data.questionSetId,
                        questionId: data.questionId,
                        isCorrect: data.isCorrect,
                        timeSpent: data.timeSpent,
                        completedQuestions: data.completedQuestions,
                        totalQuestions: data.totalQuestions,
                        correctAnswers: data.correctAnswers,
                        lastAccessed: new Date(data.lastAccessed)
                    }
                });
                if (!created) {
                    await dbProgress.update({
                        isCorrect: data.isCorrect,
                        timeSpent: data.timeSpent,
                        completedQuestions: data.completedQuestions,
                        totalQuestions: data.totalQuestions,
                        correctAnswers: data.correctAnswers,
                        lastAccessed: new Date(data.lastAccessed)
                    });
                }
                // 更新用户的内存进度对象
                const userProgress = user.progress || {};
                const progressSummary = {
                    completedQuestions: data.completedQuestions,
                    totalQuestions: data.totalQuestions,
                    correctAnswers: data.correctAnswers,
                    lastAccessed: new Date(data.lastAccessed)
                };
                userProgress[data.questionSetId] = progressSummary;
                await user.update({ progress: userProgress });
                // 向用户发送更新通知
                if (user.socket_id) {
                    io.to(user.socket_id).emit('progress:update', {
                        questionSetId: data.questionSetId,
                        progress: {
                            ...progressSummary,
                            lastAccessed: progressSummary.lastAccessed.toISOString()
                        }
                    });
                }
            }
            catch (error) {
                console.error('Error updating progress:', error);
                socket.emit('progress_error', { message: '更新进度失败' });
            }
        });
    });
};
exports.initializeSocket = initializeSocket;
