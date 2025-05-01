"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.initializeSocket = exports.io = void 0;
const socket_io_1 = require("socket.io");
const UserProgress_1 = __importDefault(require("../models/UserProgress"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const dotenv_1 = __importDefault(require("dotenv"));
// 加载环境变量
dotenv_1.default.config();
// 初始化 Socket.IO
const initializeSocket = (server) => {
    exports.io = new socket_io_1.Server(server, {
        cors: {
            origin: process.env.CLIENT_URL || 'http://localhost:3000',
            methods: ['GET', 'POST']
        }
    });
    // 添加认证中间件
    exports.io.use((socket, next) => {
        const token = socket.handshake.auth.token;
        if (!token) {
            console.log('Socket连接没有提供token');
            return next(new Error('未提供认证令牌'));
        }
        try {
            const jwtSecret = process.env.JWT_SECRET || 'your-secret-key';
            const decoded = jsonwebtoken_1.default.verify(token, jwtSecret);
            socket.userId = decoded.id; // 将用户ID绑定到socket实例
            console.log(`Socket认证成功: 用户ID ${socket.userId}`);
            next();
        }
        catch (error) {
            console.error('Socket认证失败:', error);
            next(new Error('认证失败'));
        }
    });
    // 监听数据包
    exports.io.engine.on('packet', (packet) => {
        console.log('packet', packet.type, packet.data);
    });
    // 处理连接
    exports.io.on('connection', (socket) => {
        console.log(`用户 ${socket.userId} 已连接`);
        // 将socket加入以用户ID命名的房间
        if (socket.userId) {
            socket.join(socket.userId);
            console.log(`用户 ${socket.userId} 加入个人房间`);
        }
        // 处理题库访问权限检查
        socket.on('questionSet:checkAccess', (data) => {
            try {
                // 安全检查：确保只能查询自己的权限
                if (data.userId !== socket.userId) {
                    console.error(`用户ID不匹配: 请求=${data.userId}, socket=${socket.userId}`);
                    socket.emit('access_error', { message: '权限验证失败' });
                    return;
                }
                // 继续处理题库访问权限检查...
                console.log(`检查用户 ${data.userId} 对题库 ${data.questionSetId} 的访问权限`);
                // 这里放原有的访问权限检查逻辑
            }
            catch (error) {
                console.error('检查访问权限出错:', error);
                socket.emit('access_error', { message: '检查访问权限失败' });
            }
        });
        // 批量检查题库访问权限
        socket.on('questionSet:checkAccessBatch', (data) => {
            try {
                // 安全检查：确保只能查询自己的权限
                if (data.userId !== socket.userId) {
                    console.error(`用户ID不匹配: 请求=${data.userId}, socket=${socket.userId}`);
                    socket.emit('access_error', { message: '权限验证失败' });
                    return;
                }
                console.log(`批量检查用户 ${data.userId} 对 ${data.questionSetIds.length} 个题库的访问权限`);
                // 这里放原有的批量访问权限检查逻辑
            }
            catch (error) {
                console.error('批量检查访问权限出错:', error);
                socket.emit('access_error', { message: '批量检查访问权限失败' });
            }
        });
        // 处理进度更新
        socket.on('progress:update', async (data) => {
            try {
                // 安全检查：确保只能更新自己的进度
                if (data.userId !== socket.userId) {
                    console.error(`用户ID不匹配: 请求=${data.userId}, socket=${socket.userId}`);
                    socket.emit('progress_error', { message: '权限验证失败' });
                    return;
                }
                const { userId, questionSetId, questionId, isCorrect, timeSpent, lastQuestionIndex } = data;
                // 验证参数
                if (!userId || !questionSetId || !questionId) {
                    socket.emit('progress_error', { message: '缺少必要参数' });
                    return;
                }
                // 保存进度到数据库
                const [progressRecord, created] = await UserProgress_1.default.upsert({
                    id: undefined,
                    userId,
                    questionSetId,
                    questionId,
                    isCorrect,
                    timeSpent,
                    completedQuestions: 1,
                    totalQuestions: 1,
                    correctAnswers: isCorrect ? 1 : 0,
                    lastAccessed: new Date(),
                    lastQuestionIndex: lastQuestionIndex // 保存最后题目索引
                });
                console.log(`用户进度已${created ? '创建' : '更新'}: ${userId}, ${questionSetId}`);
                // 转换为纯对象
                const progressData = progressRecord.toJSON();
                // 向用户发送进度已更新通知
                exports.io.to(userId).emit('progress:update', {
                    questionSetId,
                    progress: progressData
                });
                // 向客户端确认进度已保存
                socket.emit('progress_saved', {
                    success: true,
                    progress: progressData
                });
            }
            catch (error) {
                console.error('保存进度错误:', error);
                socket.emit('progress_error', { message: '保存进度失败' });
            }
        });
        // 处理断开连接
        socket.on('disconnect', (reason) => {
            console.log(`用户 ${socket.userId} 断开连接, 原因: ${reason}`);
        });
    });
};
exports.initializeSocket = initializeSocket;
