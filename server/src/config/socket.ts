import { Server as SocketIOServer, Socket } from 'socket.io';
import { Server as HttpServer } from 'http';
import UserProgress from '../models/UserProgress';
import { DefaultEventsMap } from 'socket.io/dist/typed-events';

// 创建 Socket.IO 实例
export let io: SocketIOServer;

// 初始化 Socket.IO
export const initializeSocket = (server: HttpServer): void => {
  io = new SocketIOServer(server, {
    cors: {
      origin: process.env.CLIENT_URL || 'http://localhost:3000',
      methods: ['GET', 'POST']
    }
  });

  // 添加中间件记录连接
  io.use((socket: Socket, next: (err?: Error) => void) => {
    console.log('New client connecting...');
    next();
  });

  // 监听数据包
  io.engine.on('packet', (packet: { type: string; data: any }) => {
    console.log('packet', packet.type, packet.data);
  });

  // 处理连接
  io.on('connection', (socket: Socket) => {
    console.log('Client connected');

    // 监听传输升级
    socket.conn.on('upgrade', (transport: { name: string }) => {
      console.log('Transport upgraded to:', transport.name);
    });

    // 处理用户认证
    socket.on('authenticate', async (data: { userId: string }) => {
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
      } catch (error) {
        console.error('认证错误:', error);
        socket.emit('auth_error', { message: '认证失败' });
      }
    });

    // 处理进度更新
    socket.on('update_progress', async (data: {
      userId: string;
      questionSetId: string;
      questionId: string;
      isCorrect: boolean;
      timeSpent: number;
    }) => {
      try {
        const { userId, questionSetId, questionId, isCorrect, timeSpent } = data;

        // 验证参数
        if (!userId || !questionSetId || !questionId) {
          socket.emit('progress_error', { message: '缺少必要参数' });
          return;
        }

        // 保存进度到数据库
        const [progressRecord, created] = await UserProgress.upsert({
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
        io.to(userId).emit('progress_updated', {
          questionSetId,
          progress: progressData
        });
        
        // 向客户端确认进度已保存
        socket.emit('progress_saved', {
          success: true,
          progress: progressData
        });
      } catch (error) {
        console.error('保存进度错误:', error);
        socket.emit('progress_error', { message: '保存进度失败' });
      }
    });

    // 处理断开连接
    socket.on('disconnect', (reason: string) => {
      console.log('Client disconnected, reason:', reason);
    });
  });
};