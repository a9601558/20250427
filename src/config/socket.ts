import { io, Socket } from 'socket.io-client';
import { UserProgress } from '../types';

// Socket连接URL - 使用相对地址，自动跟随当前域名
const SOCKET_URL = '';  // 空字符串表示使用当前域名

// 创建Socket实例
let socket: Socket;

// 用于跟踪重连尝试
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 5;

// 心跳检测定时器
let heartbeatInterval: ReturnType<typeof setInterval> | null = null;

// 初始化Socket连接
export const initSocket = (): Socket => {
  if (!socket) {
    console.log('初始化Socket.IO连接，使用当前域名');
    
    // 配置Socket.IO客户端
    socket = io(SOCKET_URL, {
      path: '/socket.io/', // 确保路径以斜杠结尾
      transports: ['websocket', 'polling'], // 优先尝试websocket
      reconnectionAttempts: MAX_RECONNECT_ATTEMPTS,
      reconnectionDelay: 1000, // 初始重连延迟1秒
      reconnectionDelayMax: 5000, // 最大重连延迟5秒
      timeout: 20000,
      forceNew: true, // 强制创建新连接
      autoConnect: true, // 自动连接
      withCredentials: false, // 通常为false，除非需要跨域携带cookies
      upgrade: true, // 允许传输升级
      rejectUnauthorized: false, // 允许自签名证书
      extraHeaders: {
        "Connection": "keep-alive" // 保持连接活跃
      }
    });

    // 启动心跳检测
    startHeartbeat();

    // 添加请求日志记录连接过程
    socket.io.on("packet", ({type, data}) => {
      console.log(`Socket.IO传输包: 类型=${type}`, data ? `数据=${JSON.stringify(data)}` : '');
    });
    
    // 监听连接事件
    socket.on('connect', () => {
      console.log('Socket.IO连接成功，ID:', socket.id);
      console.log('Socket.IO传输方式:', socket.io.engine.transport.name);
      reconnectAttempts = 0; // 重置重连计数器
      
      // 连接成功后也启动心跳
      startHeartbeat();
    });

    // 监听断开连接事件
    socket.on('disconnect', (reason) => {
      console.log(`Socket.IO断开连接: ${reason}`);
      
      // 停止心跳检测
      stopHeartbeat();
      
      // 分析断开原因
      if (reason === 'transport close') {
        console.warn('Socket.IO传输层关闭，可能是网络连接问题');
      } else if (reason === 'ping timeout') {
        console.warn('Socket.IO ping超时，服务器未响应');
      }
      
      // 如果是非主动断开，尝试手动重连
      if (reason === 'transport close' || reason === 'ping timeout') {
        attemptReconnect();
      }
    });

    // 监听错误事件
    socket.on('connect_error', (error) => {
      console.error('Socket.IO连接错误:', error.message);
      reconnectAttempts++;
      
      if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
        console.warn(`Socket.IO已尝试重连${MAX_RECONNECT_ATTEMPTS}次，停止自动重连`);
        // 尝试一次从polling到websocket的切换
        if (socket.io.engine.transport.name === 'polling') {
          console.log('尝试强制使用WebSocket连接...');
          socket.io.engine.transport.close();
        }
      }
    });

    // 监听重连尝试
    socket.on('reconnect_attempt', (attempt) => {
      console.log(`Socket.IO重连尝试 #${attempt}`);
    });

    // 监听重连成功
    socket.on('reconnect', (attempt) => {
      console.log(`Socket.IO重连成功，尝试次数: ${attempt}`);
      startHeartbeat(); // 重连成功后重新启动心跳
    });
    
    // 监听pong响应
    socket.on('pong', () => {
      console.log('收到服务器pong响应');
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
      console.log('发送心跳ping...');
      socket.emit('ping');
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
const attemptReconnect = () => {
  if (socket && !socket.connected && reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
    reconnectAttempts++;
    console.log(`手动尝试重连 #${reconnectAttempts}...`);
    
    // 先断开旧连接
    socket.disconnect();
    
    // 延迟后重新连接
    setTimeout(() => {
      socket.connect();
    }, 1000);
  }
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
  stopHeartbeat();
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