import { Server as SocketIOServer, Socket } from 'socket.io';
import { Server as HttpServer } from 'http';
import UserProgress from '../models/UserProgress';
import { DefaultEventsMap } from 'socket.io/dist/typed-events';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import { Op } from 'sequelize';

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
    const token = socket.handshake.auth.token;
    if (!token) {
      console.log('Socket连接没有提供token');
      return next(new Error('未提供认证令牌'));
    }

    try {
      const jwtSecret = process.env.JWT_SECRET || 'your-secret-key';
      const decoded: any = jwt.verify(token, jwtSecret);
      socket.userId = decoded.id; // 将用户ID绑定到socket实例
      console.log(`Socket认证成功: 用户ID ${socket.userId}`);
      next();
    } catch (error) {
      console.error('Socket认证失败:', error);
      next(new Error('认证失败'));
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
      answeredQuestions?: any[]; // 已答题列表
    }) => {
      try {
        // 安全检查：确保只能更新自己的进度
        if (data.userId !== socket.userId) {
          console.error(`用户ID不匹配: 请求=${data.userId}, socket=${socket.userId}`);
          socket.emit('progress_error', { message: '权限验证失败' });
          return;
        }

        const { userId, questionSetId, questionId, isCorrect, timeSpent, lastQuestionIndex, answeredQuestions } = data;

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
          lastQuestionIndex: lastQuestionIndex, // 保存最后题目索引
          metadata: answeredQuestions ? JSON.stringify({ answeredQuestions }) : undefined // 保存已答题列表
        });
        
        console.log(`用户进度已${created ? '创建' : '更新'}: ${userId}, ${questionSetId}, 当前题目索引: ${lastQuestionIndex}`);
        
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

    // 新增: 处理进度查询
    socket.on('progress:get', async (data: {
      userId: string;
      questionSetId: string;
    }) => {
      try {
        // 安全检查：确保只能查询自己的进度
        if (data.userId !== socket.userId) {
          console.error(`进度查询权限错误: 请求用户=${data.userId}, socket用户=${socket.userId}`);
          socket.emit('progress_error', { message: '权限验证失败' });
          return;
        }

        const { userId, questionSetId } = data;
        console.log(`[Socket] 查询用户进度: userId=${userId}, questionSetId=${questionSetId}`);

        // 从数据库查询最新的进度记录
        const lastProgress = await UserProgress.findOne({
          where: {
            userId,
            questionSetId,
            lastQuestionIndex: { [Op.gte]: 0 } // 查询大于等于0的索引值，避免与null直接比较
          },
          order: [['updatedAt', 'DESC']], // 获取最新记录
          raw: true
        });

        // 如果找到进度记录
        if (lastProgress) {
          console.log(`[Socket] 找到用户进度记录: lastQuestionIndex=${lastProgress.lastQuestionIndex}`);
          
          // 尝试解析metadata中的answeredQuestions
          let answeredQuestions = [];
          try {
            if (lastProgress.metadata) {
              const metadata = JSON.parse(lastProgress.metadata);
              if (metadata && metadata.answeredQuestions) {
                answeredQuestions = metadata.answeredQuestions;
              }
            }
          } catch (err) {
            console.error('[Socket] 解析进度记录metadata失败:', err);
          }
          
          // 发送进度数据给客户端
          socket.emit('progress:data', {
            ...lastProgress,
            answeredQuestions
          });
        } else {
          console.log(`[Socket] 未找到用户进度记录: userId=${userId}, questionSetId=${questionSetId}`);
          socket.emit('progress:data', null);
        }
      } catch (error) {
        console.error('[Socket] 查询进度错误:', error);
        socket.emit('progress_error', { message: '查询进度失败' });
      }
    });

    // 新增: 处理进度重置
    socket.on('progress:reset', async (data: {
      userId: string;
      questionSetId: string;
    }) => {
      try {
        // 安全检查：确保只能重置自己的进度
        if (data.userId !== socket.userId) {
          console.error(`进度重置权限错误: 请求用户=${data.userId}, socket用户=${socket.userId}`);
          socket.emit('progress_error', { message: '权限验证失败' });
          return;
        }

        const { userId, questionSetId } = data;
        console.log(`[Socket] 重置用户进度: userId=${userId}, questionSetId=${questionSetId}`);

        // 从数据库删除进度记录
        const deleted = await UserProgress.destroy({
          where: {
            userId,
            questionSetId
          }
        });

        console.log(`[Socket] 已删除 ${deleted} 条进度记录`);
        
        // 发送重置成功通知
        socket.emit('progress:reset:result', {
          success: true,
          message: `成功重置进度，删除了 ${deleted} 条记录`,
          deletedCount: deleted
        });
      } catch (error) {
        console.error('[Socket] 重置进度错误:', error);
        socket.emit('progress_error', { message: '重置进度失败' });
      }
    });

    // 处理断开连接
    socket.on('disconnect', (reason: string) => {
      console.log(`用户 ${socket.userId} 断开连接, 原因: ${reason}`);
    });
  });
};