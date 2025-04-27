import { io, Socket } from 'socket.io-client';
import { UserProgress } from '../types';

let socket: Socket | null = null;

// 初始化Socket.IO连接
export const initializeSocket = () => {
  if (!socket) {
    const API_URL = '/';
    
    socket = io(API_URL, {
      transports: ['websocket'],
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      timeout: 10000
    });

    // 监听连接事件
    socket.on('connect', () => {
      console.log('Socket.IO连接已建立!');
    });

    // 监听断开连接事件
    socket.on('disconnect', (reason) => {
      console.log('Socket.IO连接已断开:', reason);
    });

    // 监听错误事件
    socket.on('connect_error', (error) => {
      console.error('Socket.IO连接错误:', error);
    });
  }

  return socket;
};

// 用户认证 - 在用户登录后调用
export const authenticateUser = (userId: string) => {
  if (!socket) initializeSocket();
  if (socket && userId) {
    socket.emit('authenticate', userId);
    console.log('用户认证已发送:', userId);
  }
};

// 监听进度更新
export const onProgressUpdate = (callback: (data: { questionSetId: string, progress: UserProgress }) => void) => {
  if (!socket) initializeSocket();
  
  socket?.on('progress_updated', (data) => {
    callback(data);
  });
  
  return () => {
    socket?.off('progress_updated');
  };
};

// 断开连接
export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
    console.log('Socket.IO连接已手动断开');
  }
};

export default {
  initializeSocket,
  authenticateUser,
  onProgressUpdate,
  disconnectSocket
}; 