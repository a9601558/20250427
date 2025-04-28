import { io, Socket } from 'socket.io-client';
import { UserProgress } from '../types';

// Socket连接URL - 使用相对地址，自动跟随当前域名
const SOCKET_URL = '';  // 空字符串表示使用当前域名

// 创建Socket实例
let socket: Socket;

// 用于跟踪重连尝试
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 5;

// 初始化Socket连接
export const initSocket = (): Socket => {
  if (!socket) {
    console.log('初始化Socket.IO连接，使用当前域名');
    
    // 配置Socket.IO客户端
    socket = io(SOCKET_URL, {
      path: '/socket.io', // 确保路径正确
      transports: ['polling', 'websocket'], // 先尝试polling，再尝试websocket
      reconnectionAttempts: MAX_RECONNECT_ATTEMPTS,
      reconnectionDelay: 1000,
      timeout: 20000,
      forceNew: true,
      autoConnect: true,
      withCredentials: false, // 通常为false，除非需要跨域携带cookies
    });

    // 添加请求日志记录连接过程
    socket.io.on("packet", ({type, data}) => {
      console.log(`Socket.IO传输包: 类型=${type}`, data ? `数据=${JSON.stringify(data)}` : '');
    });
    
    // 监听连接事件
    socket.on('connect', () => {
      console.log('Socket.IO连接成功，ID:', socket.id);
      console.log('Socket.IO传输方式:', socket.io.engine.transport.name);
      reconnectAttempts = 0;
    });

    // 监听断开连接事件
    socket.on('disconnect', (reason) => {
      console.log(`Socket.IO断开连接: ${reason}`);
    });

    // 监听错误事件
    socket.on('connect_error', (error) => {
      console.error('Socket.IO连接错误:', error.message);
      reconnectAttempts++;
      
      if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
        console.warn(`Socket.IO已尝试重连${MAX_RECONNECT_ATTEMPTS}次，停止自动重连`);
      }
    });

    // 监听重连尝试
    socket.on('reconnect_attempt', (attempt) => {
      console.log(`Socket.IO重连尝试 #${attempt}`);
    });

    // 监听重连成功
    socket.on('reconnect', (attempt) => {
      console.log(`Socket.IO重连成功，尝试次数: ${attempt}`);
    });
  }

  return socket;
};

// 获取Socket实例
export const getSocket = (): Socket => {
  if (!socket) {
    return initSocket();
  }
  return socket;
};

// 关闭Socket连接
export const closeSocket = (): void => {
  if (socket) {
    socket.disconnect();
  }
};

// 用户认证 - 在用户登录后调用
export const authenticateUser = (userId: string) => {
  if (!socket) initSocket();
  if (socket && userId) {
    socket.emit('authenticate', userId);
    console.log('用户认证已发送:', userId);
  }
};

// 监听进度更新
export const onProgressUpdate = (callback: (data: { questionSetId: string, progress: UserProgress }) => void) => {
  if (!socket) initSocket();
  
  socket?.on('progress_updated', (data) => {
    callback(data);
  });
  
  return () => {
    socket?.off('progress_updated');
  };
};

export default getSocket; 