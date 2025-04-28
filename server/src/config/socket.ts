import { Server } from 'socket.io';
import http from 'http';

// 存储用户ID和Socket ID的映射
const userSocketMap = new Map<string, string>();

export const initializeSocket = (httpServer: http.Server) => {
  const io = new Server(httpServer, {
    cors: {
      origin: process.env.FRONTEND_URL || 'http://exam7.jp', // 明确指定允许的来源
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      credentials: true,
      allowedHeaders: ['Authorization', 'Content-Type']
    },
    path: '/socket.io/', // 明确指定Socket.IO路径
    transports: ['websocket', 'polling'], // 优先尝试WebSocket
    allowUpgrades: true, // 允许传输升级
    pingTimeout: 120000, // 增加ping超时到120秒，防止网络波动导致断开
    pingInterval: 30000, // 30秒发送一次ping，保持连接活跃
    connectTimeout: 60000, // 增加连接超时到60秒
    maxHttpBufferSize: 1e8, // 增加HTTP缓冲区大小
    // 添加引擎IO选项
    perMessageDeflate: {
      threshold: 1024, // 超过1kb的消息将被压缩
    },
    // 添加cookie设置
    cookie: {
      name: "io",
      path: "/",
      httpOnly: true,
      sameSite: "lax" // 或者"none"如果需要跨站点访问
    }
  });

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
      console.log(`Socket.IO 断开连接: ID=${socket.id}, 原因=${reason}`);
      // 清除心跳
      clearInterval(heartbeat);
      
      // 添加更多断开信息
      if (reason === 'transport close') {
        console.log(`Socket.IO 传输关闭: 可能是网络问题或客户端关闭`);
        // 尝试在短时间内重连
        setTimeout(() => {
          if (io.sockets.sockets.has(socket.id)) {
            console.log(`Socket ${socket.id} 已重新连接`);
          } else {
            console.log(`Socket ${socket.id} 未能重新连接`);
          }
        }, 5000);
      } else if (reason === 'ping timeout') {
        console.log(`Socket.IO ping超时: 客户端未在预期时间内响应`);
      } else if (reason === 'transport error') {
        console.log(`Socket.IO 传输错误: 可能是连接中断`);
      }
      
      // 清理已断开连接的用户映射
      for (const [userId, socketId] of userSocketMap.entries()) {
        if (socketId === socket.id) {
          userSocketMap.delete(userId);
          console.log(`用户 ${userId} 的Socket映射已清理`);
          break;
        }
      }
    });
    
    // 处理错误
    socket.on('error', (error) => {
      console.error(`Socket.IO 连接错误: ${socket.id}`, error);
      // 不立即断开，尝试恢复
      socket.emit('reconnect_attempt', { message: '连接出错，尝试恢复' });
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