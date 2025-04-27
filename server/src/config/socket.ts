import { Server } from 'socket.io';
import { Server as HttpServer } from 'http';
import { User } from '../models/User';

// 存储用户ID和Socket ID的映射
const userSocketMap = new Map<string, string>();

export const initializeSocket = (httpServer: HttpServer) => {
  const io = new Server(httpServer, {
    cors: {
      origin: process.env.CLIENT_URL || 'http://localhost:5173',
      methods: ['GET', 'POST']
    }
  });

  // 连接处理
  io.on('connection', (socket) => {
    console.log('用户已连接:', socket.id);

    // 用户认证和房间加入
    socket.on('authenticate', async (userId: string) => {
      try {
        const user = await User.findByPk(userId);
        if (user) {
          // 将用户ID和Socket ID关联
          userSocketMap.set(userId, socket.id);
          // 加入用户特定的房间
          socket.join(`user_${userId}`);
          // 加入主页房间
          socket.join('homepage');
          
          console.log(`用户 ${userId} 已认证并加入房间`);
        }
      } catch (error) {
        console.error('Socket认证错误:', error);
      }
    });

    // 断开连接处理
    socket.on('disconnect', () => {
      // 清理用户映射
      for (const [userId, socketId] of userSocketMap.entries()) {
        if (socketId === socket.id) {
          userSocketMap.delete(userId);
          break;
        }
      }
      console.log('用户已断开连接:', socket.id);
    });
  });

  return io;
};

// 获取用户的Socket ID
export const getUserSocketId = (userId: string): string | undefined => {
  return userSocketMap.get(userId);
};

// 向特定用户发送事件
export const emitToUser = (io: Server, userId: string, event: string, data: any) => {
  const socketId = getUserSocketId(userId);
  if (socketId) {
    io.to(socketId).emit(event, data);
  }
};

// 向主页房间广播事件
export const emitToHomepage = (io: Server, event: string, data: any) => {
  io.to('homepage').emit(event, data);
}; 