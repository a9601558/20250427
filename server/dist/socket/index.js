"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.initializeSocket = exports.safeEmit = exports.getSocketIO = void 0;
const QuestionSet_1 = __importDefault(require("../models/QuestionSet"));
const User_1 = __importDefault(require("../models/User"));
const Purchase_1 = __importDefault(require("../models/Purchase"));
const sequelize_1 = require("sequelize");
const uuid_1 = require("uuid");
const UserProgress_1 = __importDefault(require("../models/UserProgress"));
// Store a reference to the IO server
let ioInstance = null;
// Function to get the socket.io instance
const getSocketIO = () => {
    if (!ioInstance) {
        console.warn('Socket.IO has not been initialized yet - 实时通知功能暂不可用');
        return null;
    }
    return ioInstance;
};
exports.getSocketIO = getSocketIO;
// 添加一个安全的emit函数，避免未初始化时的错误
const safeEmit = (room, event, data) => {
    try {
        const io = (0, exports.getSocketIO)();
        if (io) {
            io.to(room).emit(event, data);
            return true;
        }
        return false;
    }
    catch (error) {
        console.warn(`safeEmit失败 (${room}, ${event}):`, error);
        return false;
    }
};
exports.safeEmit = safeEmit;
const initializeSocket = (io) => {
    try {
        console.log('初始化Socket.IO服务...');
        // Store the io instance for later use
        ioInstance = io;
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
                                include: [User_1.default]
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
                        console.log(`检查用户(${data.userId})对题库(${data.questionSetId})的访问权限, 强制刷新: ${data.forceRefresh || false}`);
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
                        // 查询条件增强，确保在不同ID格式情况下也能找到对应的记录
                        const normalizedQuestionSetId = String(data.questionSetId).trim();
                        const purchases = await Purchase_1.default.findAll({
                            where: {
                                userId: user.id,
                                expiryDate: {
                                    [sequelize_1.Op.gt]: new Date()
                                }
                            }
                        });
                        // 找到匹配的购买记录，使用更灵活的匹配方式
                        const purchase = purchases.find(p => {
                            const purchaseQsId = String(p.questionSetId).trim();
                            // 精确匹配
                            const exactMatch = purchaseQsId === normalizedQuestionSetId;
                            // 部分匹配 - 处理ID可能包含前缀或后缀的情况
                            const containsId = purchaseQsId.includes(normalizedQuestionSetId) ||
                                normalizedQuestionSetId.includes(purchaseQsId);
                            const similarLength = Math.abs(purchaseQsId.length - normalizedQuestionSetId.length) <= 2;
                            const partialMatch = containsId && similarLength &&
                                purchaseQsId.length > 10 && normalizedQuestionSetId.length > 10;
                            return exactMatch || partialMatch;
                        });
                        if (purchase && user.socket_id) {
                            // 有有效的购买记录
                            const remainingDays = Math.ceil((new Date(purchase.expiryDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
                            console.log(`用户(${user.id})有题库(${questionSet.id})的有效购买记录，剩余天数: ${remainingDays}`);
                            io.to(user.socket_id).emit('questionSet:accessUpdate', {
                                questionSetId: questionSet.id, // 统一使用请求中的题库ID
                                hasAccess: true,
                                remainingDays
                            });
                        }
                        else if (user.socket_id) {
                            // 没有有效的购买记录
                            console.log(`用户(${user.id})没有题库(${questionSet.id})的有效购买记录`);
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
                                as: 'questionSet'
                            },
                            {
                                model: User_1.default,
                                as: 'user'
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
                            { model: User_1.default, as: 'user' },
                            { model: QuestionSet_1.default, as: 'questionSet' }
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
                        include: [{ model: User_1.default, as: 'user' }]
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
                        include: [{ model: User_1.default, as: 'user' }]
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
            const checkExpiredPurchases = async () => {
                try {
                    const expiredPurchases = await Purchase_1.default.findAll({
                        where: {
                            expiryDate: {
                                [sequelize_1.Op.lt]: new Date(),
                                [sequelize_1.Op.gt]: new Date(Date.now() - 24 * 60 * 60 * 1000) // 过去24小时内过期的
                            }
                        },
                        include: [{ model: User_1.default, as: 'user' }]
                    });
                    const socketIO = (0, exports.getSocketIO)();
                    if (socketIO) {
                        expiredPurchases.forEach(purchase => {
                            if (purchase.user?.socket_id) {
                                socketIO.to(purchase.user.socket_id).emit('purchase:expire', {
                                    questionSetId: purchase.questionSetId,
                                    purchaseId: purchase.id
                                });
                            }
                        });
                    }
                }
                catch (error) {
                    console.error('Error checking expired purchases:', error);
                }
            };
            // 定期执行检查
            if (process.env.NODE_ENV !== 'test') {
                setInterval(checkExpiredPurchases, 60 * 60 * 1000); // 每小时检查一次
            }
            // 处理兑换码成功事件
            socket.on('redeem:success', async (data) => {
                try {
                    // 验证必要参数
                    if (!data.userId || !data.questionSetId) {
                        socket.emit('error', { message: '缺少必要参数' });
                        return;
                    }
                    const user = await User_1.default.findByPk(data.userId);
                    if (!user) {
                        socket.emit('error', { message: '用户不存在' });
                        return;
                    }
                    const questionSet = await QuestionSet_1.default.findByPk(data.questionSetId);
                    if (!questionSet) {
                        socket.emit('error', { message: '题库不存在' });
                        return;
                    }
                    // 查询购买记录
                    const purchase = await Purchase_1.default.findOne({
                        where: {
                            ...(data.purchaseId ? { id: data.purchaseId } : {}),
                            userId: user.id,
                            questionSetId: questionSet.id
                        }
                    });
                    // 发送成功消息给客户端
                    if (user.socket_id) {
                        // 发送题库访问权限更新
                        io.to(user.socket_id).emit('questionSet:accessUpdate', {
                            questionSetId: questionSet.id,
                            hasAccess: true,
                            purchaseId: purchase?.id
                        });
                        // 发送兑换成功事件
                        io.to(user.socket_id).emit('redeem:success', {
                            questionSetId: questionSet.id,
                            purchaseId: purchase?.id,
                            expiryDate: purchase?.expiryDate
                        });
                    }
                }
                catch (error) {
                    console.error('Error handling redeem success:', error);
                }
            });
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
            // 处理用户购买记录同步请求
            socket.on('user:syncPurchases', async (data) => {
                try {
                    console.log(`用户(${data.userId})请求同步购买记录，设备ID: ${data.deviceId || '未知'}`);
                    // 获取用户购买记录
                    const user = await User_1.default.findByPk(data.userId);
                    if (!user) {
                        console.error(`用户同步购买记录失败: 找不到用户(${data.userId})`);
                        return;
                    }
                    // 获取所有有效购买记录
                    const purchases = await Purchase_1.default.findAll({
                        where: {
                            userId: user.id,
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
                    console.log(`用户(${data.userId})有${purchases.length}条有效购买记录`);
                    // 将购买记录发送给客户端
                    if (user.socket_id) {
                        io.to(user.socket_id).emit('user:purchasesSynced', {
                            success: true,
                            purchases: purchases.map(p => p.toJSON()),
                            message: `已同步${purchases.length}条购买记录`,
                            timestamp: new Date().toISOString()
                        });
                        // 对每个购买记录，单独发送访问权限更新
                        for (const purchase of purchases) {
                            io.to(user.socket_id).emit('questionSet:accessUpdate', {
                                questionSetId: purchase.questionSetId,
                                hasAccess: true,
                                remainingDays: Math.ceil((new Date(purchase.expiryDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
                            });
                        }
                    }
                }
                catch (error) {
                    console.error('同步用户购买记录失败:', error);
                    if (socket.handshake.auth?.userId) {
                        socket.emit('user:purchasesSynced', {
                            success: false,
                            message: '同步购买记录失败，请稍后再试',
                            error: process.env.NODE_ENV === 'development' ? String(error) : undefined
                        });
                    }
                }
            });
        });
        console.log('Socket.IO初始化成功!');
    }
    catch (error) {
        console.error('Socket.IO初始化失败:', error);
        // 不抛出错误，避免影响应用启动，但会降级不提供实时功能
        ioInstance = null;
    }
};
exports.initializeSocket = initializeSocket;
