import { Server } from 'socket.io';
import http from 'http';

// 存储用户ID和Socket ID的映射
const userSocketMap = new Map<string, string>();
// 保存Socket.IO实例的引用
let io: Server;

export const initializeSocket = (socketIo: Server) => {
  // 保存引用以便其他地方使用
  io = socketIo;
  
  // 添加中间件记录连接
  io.use((socket, next) => {
    console.log('Socket.IO 中间件处理连接:', socket.id);
    const transport = socket.conn.transport.name;
    console.log(`Socket.IO 连接使用传输方式: ${transport}`);
    // 记录额外的连接信息
    console.log(`Socket.IO 连接详情: IP=${socket.handshake.address}, 协议=${socket.conn.protocol}`);
    
    // 检查握手参数
    if (socket.handshake.query && socket.handshake.query.token) {
      console.log('Socket.IO 连接携带令牌');
    }
    
    // 为这个连接增加活跃状态监听
    socket.conn.on('packet', (packet) => {
      // 记录数据包，保持连接活跃
      if (packet.type === 'ping') {
        console.log(`收到来自 ${socket.id} 的ping包`);
      }
    });
    
    next();
  });

  // 处理连接
  io.on('connection', (socket) => {
    const clientIP = socket.handshake.headers['x-forwarded-for'] || socket.handshake.address;
    console.log(`Socket.IO 新连接: ID=${socket.id}, IP=${clientIP}, 传输方式=${socket.conn.transport.name}`);
    
    // 启用心跳检测
    const heartbeat = setInterval(() => {
      if (socket.connected) {
        socket.emit('ping_from_server');
        console.log(`发送服务器心跳到客户端: ${socket.id}`);
      } else {
        clearInterval(heartbeat); // 如果连接已断开，清除心跳
      }
    }, 45000); // 45秒发送一次服务器心跳

    // 监听传输升级
    socket.conn.on('upgrade', (transport) => {
      console.log(`Socket.IO 连接 ${socket.id} 升级传输方式: ${transport.name}`);
    });

    // 监听客户端心跳响应
    socket.on('pong_from_client', () => {
      console.log(`收到客户端心跳响应: ${socket.id}`);
    });

    // 用户认证
    socket.on('authenticate', (userId: string) => {
      console.log(`Socket.IO 用户认证: ID=${socket.id}, UserID=${userId}`);
      userSocketMap.set(userId, socket.id);
      socket.join(`user:${userId}`);
      socket.emit('authenticated', { userId, success: true });
    });

    // 测试消息
    socket.on('message', (data) => {
      console.log(`Socket.IO 收到消息: ID=${socket.id}, 数据=`, data);
      socket.emit('message', `服务器收到消息: ${data} (${new Date().toISOString()})`);
    });

    // 心跳包处理
    socket.on('ping', () => {
      console.log(`Socket.IO 收到ping: ${socket.id}`);
      socket.emit('pong');
    });

    // 断开连接
    socket.on('disconnect', (reason) => {
      console.log(`Socket.IO 连接断开: ID=${socket.id}, 原因=${reason}`);
      
      // 从用户映射中移除
      for (const [userId, socketId] of userSocketMap.entries()) {
        if (socketId === socket.id) {
          userSocketMap.delete(userId);
          console.log(`Socket.IO 用户 ${userId} 的连接已从映射中移除`);
          break;
        }
      }
      
      clearInterval(heartbeat);
    });
  });

  // 全局错误处理
  io.engine.on('connection_error', (err) => {
    console.error('Socket.IO 引擎连接错误:', err);
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
    return true;
  }
  return false;
};

// 向用户房间发送事件
export const emitToUserRoom = (io: Server, userId: string, event: string, data: any) => {
  io.to(`user:${userId}`).emit(event, data);
};

// 向主页房间广播事件
export const emitToHomepage = (io: Server, event: string, data: any) => {
  io.to('homepage').emit(event, data);
};

/**
 * 发送用户进度更新
 * @param userId 用户ID
 * @param questionSetId 题目集ID
 * @param progress 进度数据
 */
export const emitProgressUpdate = (userId: string, questionSetId: string, progress: any) => {
  if (!io) {
    console.error('Socket.IO 实例未初始化，无法发送进度更新');
    return;
  }

  console.log(`尝试发送进度更新到用户 ${userId}, 题目集 ${questionSetId}`);

  // 尝试获取用户的socket ID
  const socketId = userSocketMap.get(userId);
  
  if (socketId) {
    // 如果有特定的socket连接，直接发送
    const socket = io.sockets.sockets.get(socketId);
    if (socket && socket.connected) {
      console.log(`发送进度更新到特定socket: ${socketId}`);
      socket.emit('progress_updated', { 
        questionSetId, 
        progress 
      });
      return;
    }
  }
  
  // 如果没有特定socket或连接已断开，发送到用户房间
  console.log(`发送进度更新到用户房间: user:${userId}`);
  io.to(`user:${userId}`).emit('progress_updated', { 
    questionSetId, 
    progress 
  });
}; 