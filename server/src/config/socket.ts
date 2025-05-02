import { Server as SocketIOServer, Socket } from 'socket.io';
import { Server as HttpServer } from 'http';
import UserProgress from '../models/UserProgress';
import { DefaultEventsMap } from 'socket.io/dist/typed-events';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';

// 加载环境变量
dotenv.config();

// 添加Socket接口扩展，包含userId属性
interface AuthenticatedSocket extends Socket {
  userId?: string;
}

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

  // 添加认证中间件
  io.use((socket: AuthenticatedSocket, next: (err?: Error) => void) => {
    // 在auth对象或query对象中查找token
    const token = socket.handshake.auth?.token || socket.handshake.query?.token as string;
    
    if (!token) {
      console.log('Socket连接没有提供token');
      return next(new Error('未提供认证令牌'));
    }

    // 输出JWT密钥信息（不输出完整密钥，仅用于调试）
    const jwtSecret = process.env.JWT_SECRET || 'your-secret-key';
    console.log(`JWT密钥存在: ${!!jwtSecret}, 长度: ${jwtSecret.length}字符`);
    
    try {
      console.log(`尝试验证token: ${token.substring(0, 10)}...`);
      const decoded: any = jwt.verify(token, jwtSecret);
      console.log('JWT解码成功, 内容:', { 
        id: decoded.id,
        exp: decoded.exp ? new Date(decoded.exp * 1000).toISOString() : 'none', 
        iat: decoded.iat ? new Date(decoded.iat * 1000).toISOString() : 'none'
      });
      
      socket.userId = decoded.id; // 将用户ID绑定到socket实例
      console.log(`Socket认证成功: 用户ID ${socket.userId}`);
      next();
    } catch (error: any) {
      console.error('Socket认证失败详情:', { 
        message: error.message,
        name: error.name,
        expiredAt: error.expiredAt ? new Date(error.expiredAt).toISOString() : undefined
      });
      
      // 检查错误类型并发送更具体的错误信息
      if (error.name === 'TokenExpiredError') {
        return next(new Error('认证令牌已过期'));
      } else if (error.name === 'JsonWebTokenError') {
        return next(new Error('无效的认证令牌'));
      } else {
        return next(new Error('认证失败: ' + error.message));
      }
    }
  });

  // 监听数据包
  io.engine.on('packet', (packet: { type: string; data: any }) => {
    console.log('packet', packet.type, packet.data);
  });

  // 处理连接
  io.on('connection', (socket: AuthenticatedSocket) => {
    console.log(`用户 ${socket.userId} 已连接`);
    
    // 将socket加入以用户ID命名的房间
    if (socket.userId) {
      socket.join(socket.userId);
      console.log(`用户 ${socket.userId} 加入个人房间`);
    }

    // 处理题库访问权限检查
    socket.on('questionSet:checkAccess', (data: { userId: string; questionSetId: string }) => {
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
      } catch (error) {
        console.error('检查访问权限出错:', error);
        socket.emit('access_error', { message: '检查访问权限失败' });
      }
    });

    // 批量检查题库访问权限
    socket.on('questionSet:checkAccessBatch', (data: { userId: string; questionSetIds: string[] }) => {
      try {
        // 安全检查：确保只能查询自己的权限
        if (data.userId !== socket.userId) {
          console.error(`用户ID不匹配: 请求=${data.userId}, socket=${socket.userId}`);
          socket.emit('access_error', { message: '权限验证失败' });
          return;
        }
        
        console.log(`批量检查用户 ${data.userId} 对 ${data.questionSetIds.length} 个题库的访问权限`);
        
        // 这里放原有的批量访问权限检查逻辑
      } catch (error) {
        console.error('批量检查访问权限出错:', error);
        socket.emit('access_error', { message: '批量检查访问权限失败' });
      }
    });

    // 处理进度更新
    socket.on('progress:update', async (data: {
      userId: string;
      questionSetId: string;
      questionId: string;
      isCorrect: boolean;
      timeSpent: number;
      lastQuestionIndex?: number; // 添加支持保存最后题目索引
    }) => {
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
        const [progressRecord, created] = await UserProgress.upsert({
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
        io.to(userId).emit('progress:update', {
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
      console.log(`用户 ${socket.userId} 断开连接, 原因: ${reason}`);
    });
  });
};