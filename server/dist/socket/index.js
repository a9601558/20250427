"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSocketIO = exports.getIO = exports.initializeSocketServer = void 0;
const socket_io_1 = require("socket.io");
const admin_ui_1 = require("@socket.io/admin-ui");
const logger_1 = __importDefault(require("../utils/logger"));
const userAccessHandlers_1 = require("./userAccessHandlers");
let io;
const initializeSocketServer = (httpServer) => {
    io = new socket_io_1.Server(httpServer, {
        cors: {
            origin: ['https://admin.socket.io'],
            credentials: true
        }
    });
    // 设置Socket.IO管理界面
    (0, admin_ui_1.instrument)(io, {
        auth: false,
        mode: 'development',
    });
    // 处理连接事件
    io.on('connection', (socket) => {
        logger_1.default.info(`Client connected: ${socket.id}`);
        // 处理认证
        socket.on('auth:login', ({ userId, token }) => {
            if (userId && token) {
                // 在socket对象上保存用户ID
                socket.data.userId = userId;
                // 加入用户特定的房间以支持跨设备广播
                socket.join(userId);
                logger_1.default.info(`User ${userId} authenticated on socket ${socket.id}`);
            }
        });
        // 注册用户访问权限处理器
        (0, userAccessHandlers_1.registerUserAccessHandlers)(socket, io);
        // 其他事件处理...
        socket.on('questionSet:checkAccessBatch', (data) => {
            logger_1.default.info(`Batch access check requested by ${socket.id}`);
        });
        socket.on('questionSet:checkAccess', (data) => {
            logger_1.default.info(`Single access check requested by ${socket.id}`);
        });
        socket.on('questionSet:accessUpdate', (data) => {
            logger_1.default.info(`Access update requested by ${socket.id}`);
        });
        socket.on('progress:update', (data) => {
            logger_1.default.info(`Progress update requested by ${socket.id}`);
        });
        // 处理断开连接
        socket.on('disconnect', () => {
            logger_1.default.info(`Client disconnected: ${socket.id}`);
        });
    });
    return io;
};
exports.initializeSocketServer = initializeSocketServer;
// 获取Socket.IO实例的函数
const getIO = () => {
    if (!io) {
        throw new Error('Socket.IO has not been initialized');
    }
    return io;
};
exports.getIO = getIO;
// 为向后兼容提供的别名
exports.getSocketIO = exports.getIO;
