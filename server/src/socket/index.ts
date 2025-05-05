import { Server as SocketServer } from 'socket.io';
import { Server as HTTPServer } from 'http';
import logger from '../utils/logger';
import { registerUserAccessHandlers } from './userAccessHandlers';

let io: SocketServer;

export const initializeSocketServer = (httpServer: HTTPServer) => {
  io = new SocketServer(httpServer, {
    cors: {
      origin: '*',
      credentials: true
    }
  });

  // 处理连接事件
  io.on('connection', (socket) => {
    logger.info(`Client connected: ${socket.id}`);

    // 处理认证
    socket.on('auth:login', ({ userId, token }) => {
      if (userId && token) {
        // 在socket对象上保存用户ID
        socket.data.userId = userId;
        // 加入用户特定的房间以支持跨设备广播
        socket.join(userId);
        logger.info(`User ${userId} authenticated on socket ${socket.id}`);
      }
    });

    // 注册用户访问权限处理器
    registerUserAccessHandlers(socket, io);

    // 其他事件处理...
    socket.on('questionSet:checkAccessBatch', (data) => {
      logger.info(`Batch access check requested by ${socket.id}`);
    });

    socket.on('questionSet:checkAccess', (data) => {
      logger.info(`Single access check requested by ${socket.id}`);
    });

    socket.on('questionSet:accessUpdate', (data) => {
      logger.info(`Access update requested by ${socket.id}`);
    });

    socket.on('progress:update', (data) => {
      logger.info(`Progress update requested by ${socket.id}`);
    });

    // 处理断开连接
    socket.on('disconnect', () => {
      logger.info(`Client disconnected: ${socket.id}`);
    });
  });

  return io;
};

// 获取Socket.IO实例的函数
export const getIO = () => {
  if (!io) {
    throw new Error('Socket.IO has not been initialized');
  }
  return io;
};

// 为向后兼容提供的别名
export const getSocketIO = getIO; 