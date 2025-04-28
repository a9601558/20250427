"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.initializeSocket = exports.io = void 0;
const socket_io_1 = require("socket.io");
const UserProgress_1 = __importDefault(require("../models/UserProgress"));
// 初始化 Socket.IO
const initializeSocket = (server) => {
    exports.io = new socket_io_1.Server(server, {
        cors: {
            origin: process.env.CLIENT_URL || 'http://localhost:3000',
            methods: ['GET', 'POST']
        }
    });
    // 添加中间件记录连接
    exports.io.use((socket, next) => {
        console.log('New client connecting...');
        next();
    });
    // 监听数据包
    exports.io.engine.on('packet', (packet) => {
        console.log('packet', packet.type, packet.data);
    });
    // 处理连接
    exports.io.on('connection', (socket) => {
        console.log('Client connected');
        // 监听传输升级
        socket.conn.on('upgrade', (transport) => {
            console.log('Transport upgraded to:', transport.name);
        });
        // 处理用户认证
        socket.on('authenticate', async (data) => {
            try {
                const { userId } = data;
                if (!userId) {
                    socket.emit('auth_error', { message: '缺少用户ID' });
                    return;
                }
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
        // 处理进度更新
        socket.on('update_progress', async (data) => {
            try {
                const { userId, questionSetId, questionId, isCorrect, timeSpent } = data;
                // 验证参数
                if (!userId || !questionSetId || !questionId) {
                    socket.emit('progress_error', { message: '缺少必要参数' });
                    return;
                }
                // 保存进度到数据库
                const [progressRecord, created] = await UserProgress_1.default.upsert({
                    id: undefined, // 让数据库自动生成 ID
                    userId,
                    questionSetId,
                    questionId,
                    isCorrect,
                    timeSpent
                });
                console.log(`用户进度已${created ? '创建' : '更新'}: ${userId}, ${questionSetId}`);
                // 转换为纯对象
                const progressData = progressRecord.toJSON();
                // 向用户发送进度已更新通知
                exports.io.to(userId).emit('progress_updated', {
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
            console.log('Client disconnected, reason:', reason);
        });
    });
};
exports.initializeSocket = initializeSocket;
