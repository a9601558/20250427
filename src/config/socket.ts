import { io, Socket } from 'socket.io-client';
import { getCurrentUser } from './auth';

// 创建Socket实例
let socket: Socket | null = null;

// 用于跟踪重连尝试
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 5; // 增加重连尝试次数

// 心跳检测定时器
let heartbeatInterval: ReturnType<typeof setInterval> | null = null;

// 初始化Socket连接
export const initializeSocket = (): Socket => {
  try {
    if (socket) {
      console.log('复用现有Socket连接，ID:', socket.id);
      return socket;
    }

    console.log('初始化Socket.IO连接');
    
    const newSocket = io(process.env.REACT_APP_API_URL || 'http://127.0.0.1:5000', {
      path: '/socket.io/',
      transports: ['polling', 'websocket'],
      reconnection: true,
      reconnectionAttempts: MAX_RECONNECT_ATTEMPTS,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 20000,
      forceNew: true,
      autoConnect: true,
      withCredentials: true,
      upgrade: true,
      rejectUnauthorized: false
    });

    if (!newSocket) {
      throw new Error('Socket初始化失败');
    }

    socket = newSocket;
    startHeartbeat();
    setupSocketListeners(newSocket);

    return newSocket;
  } catch (error) {
    console.error('Socket初始化错误:', error);
    throw error;
  }
};

// 设置Socket事件监听器
const setupSocketListeners = (socket: Socket) => {
  socket.on('connect', async () => {
    console.log('Socket.IO连接成功，ID:', socket.id);
    reconnectAttempts = 0;
    startHeartbeat();
    
    const user = await getCurrentUser();
    if (user) {
      authenticateUser(user.id);
    }
  });

  socket.on('disconnect', () => {
    console.log('Socket.IO断开连接');
    stopHeartbeat();
  });

  socket.on('connect_error', (error) => {
    console.error('Socket.IO连接错误:', error.message);
    reconnectAttempts++;
  });

  socket.on('reconnect', (attempt) => {
    console.log(`Socket.IO重连成功，尝试次数: ${attempt}`);
    reconnectAttempts = 0;
    startHeartbeat();
  });
};

// 心跳检测 - 定期发送ping确保连接活跃
const startHeartbeat = () => {
  // 先清除可能存在的旧定时器
  stopHeartbeat();
  
  // 每30秒发送一次心跳包
  heartbeatInterval = setInterval(() => {
    const currentSocket = socket;
    if (currentSocket?.connected) {
      console.log('发送心跳ping...');
      currentSocket.emit('ping');
    } else {
      console.warn('心跳检测：Socket未连接，尝试重连');
      attemptReconnect();
    }
  }, 30000);
};

// 停止心跳检测
const stopHeartbeat = () => {
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval);
    heartbeatInterval = null;
  }
};

// 手动尝试重连
const attemptReconnect = (delay = 1000) => {
  const currentSocket = socket;
  if (currentSocket && !currentSocket.connected && reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
    reconnectAttempts++;
    console.log(`手动尝试重连 #${reconnectAttempts}...`);
    
    // 先断开旧连接
    currentSocket.disconnect();
    
    // 延迟后重新连接
    setTimeout(() => {
      if (currentSocket && !currentSocket.connected) {
        console.log(`尝试重新连接...`);
        currentSocket.connect();
      }
    }, delay);
  } else if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
    console.error('达到最大重连次数，需要用户手动刷新页面');
  }
};

// 获取Socket实例
export const getSocket = (): Socket => {
  if (!socket) {
    return initializeSocket();
  }
  return socket;
};

// 断开Socket连接
export const disconnectSocket = (): void => {
  const currentSocket = socket;
  if (currentSocket) {
    currentSocket.disconnect();
    socket = null;
    stopHeartbeat();
  }
};

// 用户认证
export const authenticateUser = (userId: string) => {
  const currentSocket = socket;
  if (currentSocket?.connected) {
    console.log('发送用户认证:', userId);
    currentSocket.emit('authenticate', { userId });
  } else {
    console.warn('Socket未连接，无法发送认证');
  }
};

// 发送进度更新
export const sendProgressUpdate = (data: {
  userId: string;
  questionSetId: string;
  questionId: string;
  isCorrect: boolean;
  timeSpent: number;
  completedQuestions: number;
  totalQuestions: number;
  correctAnswers: number;
  lastAccessed: string;
}) => {
  const currentSocket = socket;
  if (currentSocket?.connected) {
    console.log('发送进度更新:', data);
    currentSocket.emit('progress:update', data);
  } else {
    console.warn('Socket未连接，无法发送进度更新');
  }
};

// 监听进度更新
export const onProgressUpdate = (callback: (data: {
  questionSetId: string;
  progress: {
    completedQuestions: number;
    totalQuestions: number;
    correctAnswers: number;
    lastAccessed: Date;
  };
}) => void) => {
  const currentSocket = socket;
  if (currentSocket) {
    currentSocket.on('progress:update', callback);
  }
};

// 测试连接
export const testConnection = () => {
  const currentSocket = socket;
  if (currentSocket?.connected) {
    console.log('Socket连接状态: 已连接');
    return true;
  } else {
    console.log('Socket连接状态: 未连接');
    return false;
  }
};

export default getSocket; 