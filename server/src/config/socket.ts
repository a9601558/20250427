import { Server } from 'socket.io';
import http from 'http';

// 存储用户ID和Socket ID的映射
const userSocketMap = new Map<string, string>();

export const initializeSocket = (httpServer: http.Server) => {
  const io = new Server(httpServer, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      credentials: true,
      allowedHeaders: ['Authorization', 'Content-Type']
    },
    transports: ['websocket', 'polling'], // 优先使用WebSocket
    connectTimeout: 30000,
    pingTimeout: 30000,
    pingInterval: 25000
  });

  // 添加中间件记录连接
  io.use((socket, next) => {
    console.log('Socket.IO 中间件处理连接:', socket.id);
    const transport = socket.conn.transport.name;
    console.log(`Socket.IO 连接使用传输方式: ${transport}`);
    next();
  });

  // 处理连接
  io.on('connection', (socket) => {
    const clientIP = socket.handshake.headers['x-forwarded-for'] || socket.handshake.address;
    console.log(`Socket.IO 新连接: ID=${socket.id}, IP=${clientIP}, 传输方式=${socket.conn.transport.name}`);

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

    // 断开连接
    socket.on('disconnect', (reason) => {
      console.log(`Socket.IO 断开连接: ID=${socket.id}, 原因=${reason}`);
      // 清理已断开连接的用户映射
      for (const [userId, socketId] of userSocketMap.entries()) {
        if (socketId === socket.id) {
          userSocketMap.delete(userId);
          break;
        }
      }
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