import io, { Socket } from 'socket.io-client';
import { API_BASE_URL } from './constants';
import { UserProgress } from '../types';

interface ProgressData {
  userId: string;
  questionSetId: string;
  questionId: string;
  isCorrect: boolean;
  timeSpent: number;
  completedQuestions: number;
  totalQuestions: number;
  correctAnswers: number;
  lastAccessed: string;
}

let socketInstance: Socket | null = null;

// 用于跟踪重连尝试
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 10; // 增加重连尝试次数

// 心跳检测定时器
let heartbeatInterval: ReturnType<typeof setInterval> | null = null;

// 日志控制
const ENABLE_DEBUG_LOGS = false;

const debugLog = (message: string, ...args: any[]) => {
  if (ENABLE_DEBUG_LOGS) {
    console.log(`[Socket Debug] ${message}`, ...args);
  }
};

// 心跳检测 - 定期发送ping确保连接活跃
const startHeartbeat = () => {
  // 先清除可能存在的旧定时器
  stopHeartbeat();
  
  // 每30秒发送一次心跳包
  heartbeatInterval = setInterval(() => {
    if (socketInstance && socketInstance.connected) {
      console.log('[Socket] 发送心跳ping...');
      socketInstance.emit('ping');
      
      // 设置ping超时检测
      const pingTimeout = setTimeout(() => {
        if (socketInstance && socketInstance.connected) {
          console.warn('[Socket] ping超时未收到响应，主动尝试重连');
          socketInstance.disconnect().connect(); // 断开并立即重连
        }
      }, 10000); // 10秒内未收到响应就重连
      
      // 设置pong响应处理
      const pongHandler = () => {
        clearTimeout(pingTimeout);
        if (socketInstance) {
          socketInstance.off('pong', pongHandler); // 移除一次性的pong处理
        }
      };
      
      if (socketInstance) {
        socketInstance.on('pong', pongHandler);
      }
    } else {
      console.warn('[Socket] 心跳检测：Socket未连接，尝试重连');
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
  if (socketInstance && !socketInstance.connected && reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
    reconnectAttempts++;
    console.log(`[Socket] 手动尝试重连 #${reconnectAttempts}...`);
    
    // 先断开旧连接
    socketInstance.disconnect();
    
    // 延迟后重新连接
    setTimeout(() => {
      // 检查是否已经连接
      if (socketInstance && !socketInstance.connected) {
        console.log(`[Socket] 尝试重新连接...`);
        
        // 先尝试不同的传输方式
        if (reconnectAttempts % 2 === 0) {
          console.log('[Socket] 尝试使用polling传输方式重连');
          if (socketInstance) {
            socketInstance.io.opts.transports = ['polling', 'websocket'];
          }
        } else {
          console.log('[Socket] 尝试使用websocket传输方式重连');
          if (socketInstance) {
            socketInstance.io.opts.transports = ['websocket', 'polling'];
          }
        }
        
        if (socketInstance) {
          socketInstance.connect();
        }
      }
    }, delay);
  } else if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
    console.error('[Socket] 达到最大重连次数，需要用户手动刷新页面');
    // 可以在这里触发一个全局事件，通知UI显示一个重连失败的提示
  }
};

const initializeSocket = () => {
  if (socketInstance) {
    console.log('[Socket] 重用现有连接');
    return socketInstance;
  }
  
  console.log('[Socket] 初始化新连接');
  
  // Get the server URL from the constants file
  const serverUrl = API_BASE_URL;
  console.log(`[Socket] 连接到服务器: ${serverUrl}`);
  
  // Add more fallback options and better config
  socketInstance = io(serverUrl, {
    transports: ['websocket', 'polling'], // Try both transports
    reconnectionAttempts: 10,             // Limit retry attempts
    reconnectionDelay: 1000,              // Start with 1s delay
    reconnectionDelayMax: 5000,           // Max 5s between retries
    timeout: 20000,                       // Longer connection timeout
    autoConnect: true,
    forceNew: false
  });
  
  // 添加更详细的错误处理
  socketInstance.on('connect_error', (error) => {
    console.error('[Socket] 连接错误:', error);
    // 记录失败URL以便调试
    console.error(`[Socket] 连接失败URL: ${serverUrl}`);
    
    // 在生产环境添加特殊处理
    if (window.location.hostname !== 'localhost') {
      console.warn('[Socket] 生产环境连接失败，尝试使用轮询模式');
      // 动态调整传输方式
      if (socketInstance) {
        socketInstance.io.opts.transports = ['polling', 'websocket'];
      }
    }
  });
  
  // 添加连接成功处理
  socketInstance.on('connect', () => {
    console.log('[Socket] 连接成功 🟢');
    reconnectAttempts = 0; // Reset attempts counter on success
  });
  
  socketInstance.on('disconnect', (reason) => {
    console.log(`[Socket] 断开连接: ${reason}`);
    
    // 自动重连逻辑
    if (reason === 'io server disconnect') {
      // 服务器主动断开，需要手动重连
      setTimeout(() => {
        if (socketInstance) {
          socketInstance.connect();
        }
      }, 3000);
    }
  });
  
  // 连接成功后开始心跳检测
  socketInstance.on('connect', () => {
    console.log('[Socket] 连接成功，启动心跳检测');
    startHeartbeat();
  });
  
  return socketInstance;
};

const authenticateUser = (userId: string, token: string) => {
  if (!socketInstance) {
    console.error('[Socket] 无法认证：socket实例不存在');
    return;
  }
  
  if (!userId || !token) {
    console.error('[Socket] 无法认证：缺少userId或token');
    return;
  }
  
  // 获取当前认证信息
  const currentAuth = socketInstance.auth as any;
  const currentUserId = currentAuth?.userId;
  
  // 如果用户ID没变，不需要重新认证
  if (currentUserId === userId) {
    console.log(`[Socket] 用户ID未变，跳过重新认证: ${userId}`);
    return;
  }
  
  console.log(`[Socket] 认证用户: ${userId}${currentUserId ? ` (之前: ${currentUserId})` : ''}`);
  socketInstance.auth = { userId, token };
  
  // 如果已连接，断开并重新连接以应用新凭据
  if (socketInstance.connected) {
    console.log('[Socket] 断开现有连接以应用新凭据');
    socketInstance.disconnect().connect();
  }
};

const deauthenticateSocket = () => {
  if (!socketInstance) return;
  
  console.log('[Socket] 清除用户认证');
  socketInstance.auth = {};
  
  // 断开连接前停止心跳
  stopHeartbeat();
  
  // 断开连接
  socketInstance.disconnect();
};

const getSocketInstance = () => {
  return socketInstance;
};

const closeSocket = () => {
  if (socketInstance) {
    console.log('[Socket] 关闭连接');
    // 关闭前停止心跳
    stopHeartbeat();
    socketInstance.disconnect();
    socketInstance = null;
  }
};

// 发送进度更新
const sendProgressUpdate = (data: ProgressData): void => {
  if (socketInstance) {
    socketInstance.emit('progress:update', data);
  }
};

// 监听进度更新
const onProgressUpdate = (callback: (data: ProgressData) => void): void => {
  if (socketInstance) {
    socketInstance.on('progress:update', callback);
  }
};

// 测试连接
const testConnection = (): void => {
  if (socketInstance) {
    socketInstance.emit('test', { message: 'Testing connection' });
  }
};

// 统一导出所有函数
export {
  initializeSocket,
  authenticateUser,
  deauthenticateSocket,
  getSocketInstance,
  closeSocket,
  startHeartbeat,
  stopHeartbeat,
  attemptReconnect,
  sendProgressUpdate,
  onProgressUpdate,
  testConnection,
  type ProgressData
}; 