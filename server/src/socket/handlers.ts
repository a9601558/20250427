import { Server } from 'socket.io';
import { logger } from '../utils/logger';

/**
 * 注册所有Socket.IO事件处理程序
 * @param io Socket.IO服务器实例
 */
const registerSocketHandlers = (io: Server): void => {
  logger.info('初始化Socket.IO事件处理程序');

  // 连接事件处理
  io.on('connection', (socket) => {
    logger.info(`新的Socket连接: ${socket.id}`);

    // 身份验证处理
    socket.on('authenticate', (data) => {
      try {
        const { userId } = data;
        if (userId) {
          socket.data.userId = userId;
          logger.info(`用户 ${userId} 已通过Socket认证`);
          
          // 加入用户特定房间
          socket.join(`user-${userId}`);
          socket.emit('authenticated', { success: true });
        } else {
          logger.warn(`Socket认证失败: 未提供userId`);
          socket.emit('authenticated', { success: false, message: '认证失败: 用户ID无效' });
        }
      } catch (error) {
        logger.error('Socket认证错误:', error);
        socket.emit('authenticated', { success: false, message: '认证处理错误' });
      }
    });

    // 断开连接处理
    socket.on('disconnect', () => {
      const userId = socket.data.userId;
      if (userId) {
        logger.info(`用户 ${userId} 断开Socket连接`);
      } else {
        logger.info(`未认证的Socket断开连接: ${socket.id}`);
      }
    });

    // 自定义事件
    socket.on('ping', (callback) => {
      if (typeof callback === 'function') {
        callback({ time: new Date().toISOString() });
      }
    });
  });
};

export default registerSocketHandlers; 