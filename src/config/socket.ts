import { io, Socket } from 'socket.io-client';
import { UserProgress } from '../types';
import { logger } from '../utils/logger';

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

// Socket连接URL - 使用相对地址，自动跟随当前域名
const SOCKET_URL = '';  // 空字符串表示使用当前域名

// 创建Socket实例
let socket: Socket;

// 用于跟踪重连尝试
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 10; // 增加重连尝试次数

// 心跳检测定时器
let heartbeatInterval: ReturnType<typeof setInterval> | null = null;

// 初始化Socket连接
const initializeSocket = (): Socket => {
  if (!socket) {
    logger.info('初始化Socket.IO连接，使用当前域名');
    
    // 获取用户令牌
    const token = localStorage.getItem('token');
    
    // 配置Socket.IO客户端
    socket = io(SOCKET_URL, {
      path: '/socket.io/', // 确保路径以斜杠结尾
      transports: ['websocket', 'polling'], // 优先尝试websocket
      reconnectionAttempts: MAX_RECONNECT_ATTEMPTS,
      reconnectionDelay: 1000, // 初始重连延迟1秒
      reconnectionDelayMax: 5000, // 最大重连延迟5秒
      timeout: 60000, // 增加连接超时到60秒
      forceNew: true, // 强制创建新连接
      autoConnect: true, // 自动连接
      withCredentials: false, // 通常为false，除非需要跨域携带cookies
      upgrade: true, // 允许传输升级
      rejectUnauthorized: false, // 允许自签名证书
      auth: {
        token: token, // 添加JWT令牌到auth属性
      },
      extraHeaders: {
        'Connection': 'keep-alive', // 保持连接活跃
        'X-Client-Version': '1.0', // 添加客户端版本标识
      },
    });

    // 启动心跳检测
    startHeartbeat();

    // 添加请求日志记录连接过程
    socket.io.on('packet', ({ type, data }) => {
      logger.debug(`Socket.IO传输包: 类型=${type}`, data ? `数据=${JSON.stringify(data)}` : '');
    });
    
    // 监听连接事件
    socket.on('connect', () => {
      logger.info('Socket.IO连接成功，ID:', socket.id);
      logger.info('Socket.IO传输方式:', socket.io.engine.transport.name);
      reconnectAttempts = 0; // 重置重连计数器
      
      // 连接成功后也启动心跳
      startHeartbeat();
    });

    // 监听断开连接事件
    socket.on('disconnect', (reason) => {
      logger.info(`Socket.IO断开连接: ${reason}`);
      
      // 停止心跳检测
      stopHeartbeat();
      
      // 分析断开原因
      if (reason === 'transport close') {
        logger.warn('Socket.IO传输层关闭，可能是网络连接问题');
        attemptReconnect(1000); // 传输关闭快速重连
      } else if (reason === 'ping timeout') {
        logger.warn('Socket.IO ping超时，服务器未响应');
        attemptReconnect(2000); // ping超时延迟一点重连
      } else if (reason === 'io server disconnect') {
        // 服务器主动断开连接，可能是服务重启
        logger.warn('服务器主动断开连接，等待5秒后尝试重连');
        attemptReconnect(5000);
      }
    });

    // 监听服务器自定义心跳
    socket.on('ping_from_server', () => {
      logger.debug('收到服务器心跳ping');
      // 回应服务器心跳
      socket.emit('pong_from_client');
    });

    // 监听错误事件
    socket.on('connect_error', (error) => {
      logger.error('Socket.IO连接错误:', error.message);
      reconnectAttempts++;
      
      if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
        logger.warn(`Socket.IO已尝试重连${MAX_RECONNECT_ATTEMPTS}次，停止自动重连`);
        
        // 尝试一次从polling到websocket的切换
        if (socket.io.engine.transport.name === 'polling') {
          logger.info('尝试强制使用WebSocket连接...');
          // 关闭当前传输层尝试升级
          socket.io.engine.transport.close();
        }
      }
    });

    // 监听重连尝试
    socket.on('reconnect_attempt', (attempt) => {
      logger.info(`Socket.IO重连尝试 #${attempt}`);
      
      // 在重连时尝试改变传输方式
      if (attempt > 3) {
        // 在多次尝试后，先尝试polling，因为它可能更稳定
        socket.io.opts.transports = ['polling', 'websocket'];
      }
    });

    // 监听重连成功
    socket.on('reconnect', (attempt) => {
      logger.info(`Socket.IO重连成功，尝试次数: ${attempt}`);
      // 重置尝试次数
      reconnectAttempts = 0;
      // 重连成功后重新启动心跳
      startHeartbeat(); 
    });
    
    // 监听pong响应
    socket.on('pong', () => {
      logger.debug('收到服务器pong响应');
    });
    
    // 监听错误
    socket.on('error', (error) => {
      logger.error('Socket.IO错误事件:', error);
    });
  }

  return socket;
};

// 心跳检测 - 定期发送ping确保连接活跃
const startHeartbeat = () => {
  // 先清除可能存在的旧定时器
  stopHeartbeat();
  
  // 每30秒发送一次心跳包
  heartbeatInterval = setInterval(() => {
    if (socket && socket.connected) {
      logger.debug('发送心跳ping...');
      socket.emit('ping');
      
      // 设置ping超时检测
      const pingTimeout = setTimeout(() => {
        if (socket && socket.connected) {
          logger.warn('ping超时未收到响应，主动尝试重连');
          socket.disconnect().connect(); // 断开并立即重连
        }
      }, 10000); // 10秒内未收到响应就重连
      
      // 设置pong响应处理
      const pongHandler = () => {
        clearTimeout(pingTimeout);
        socket.off('pong', pongHandler); // 移除一次性的pong处理
      };
      
      socket.on('pong', pongHandler);
    } else {
      logger.warn('心跳检测：Socket未连接，尝试重连');
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
  if (socket && !socket.connected && reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
    reconnectAttempts++;
    logger.info(`手动尝试重连 #${reconnectAttempts}...`);
    
    // 先断开旧连接
    socket.disconnect();
    
    // 延迟后重新连接
    setTimeout(() => {
      // 检查是否已经连接
      if (!socket.connected) {
        logger.info('尝试重新连接...');
        
        // 先尝试不同的传输方式
        if (reconnectAttempts % 2 === 0) {
          logger.info('尝试使用polling传输方式重连');
          socket.io.opts.transports = ['polling', 'websocket'];
        } else {
          logger.info('尝试使用websocket传输方式重连');
          socket.io.opts.transports = ['websocket', 'polling'];
        }
        
        socket.connect();
      }
    }, delay);
  } else if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
    logger.error('达到最大重连次数，需要用户手动刷新页面');
    // 可以在这里触发一个全局事件，通知UI显示一个重连失败的提示
  }
};

// 获取Socket实例
export const getSocket = (): Socket => {
  if (!socket) {
    return initializeSocket();
  }
  return socket;
};

// 关闭Socket连接
const disconnectSocket = (): void => {
  stopHeartbeat();
  if (socket) {
    socket.disconnect();
  }
};

// 用户认证
const authenticateUser = (userId: string, token: string): void => {
  if (socket) {
    socket.emit('authenticate', { userId, token });
  }
};

// 发送进度更新
const sendProgressUpdate = (data: ProgressData): void => {
  if (socket) {
    socket.emit('progress:update', data);
  }
};

// 监听进度更新
const onProgressUpdate = (callback: (data: ProgressData) => void): void => {
  if (socket) {
    socket.on('progress:update', callback);
  }
};

// 测试连接
const testConnection = (): void => {
  if (socket) {
    socket.emit('test', { message: 'Testing connection' });
  }
};

export {
  socket,
  initializeSocket,
  disconnectSocket,
  authenticateUser,
  sendProgressUpdate,
  onProgressUpdate,
  testConnection,
}; 
