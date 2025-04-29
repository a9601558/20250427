import { io, Socket } from 'socket.io-client';
import { UserProgress } from '../types';

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
      timeout: 60000, // 增加连接超时到60秒
      forceNew: true, // 强制创建新连接
      autoConnect: true, // 自动连接
      withCredentials: false, // 通常为false，除非需要跨域携带cookies
      upgrade: true, // 允许传输升级
      rejectUnauthorized: false, // 允许自签名证书
      extraHeaders: {
        "Connection": "keep-alive", // 保持连接活跃
        "X-Client-Version": "1.0" // 添加客户端版本标识
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
        attemptReconnect(1000); // 传输关闭快速重连
      } else if (reason === 'ping timeout') {
        console.warn('Socket.IO ping超时，服务器未响应');
        attemptReconnect(2000); // ping超时延迟一点重连
      } else if (reason === 'io server disconnect') {
        // 服务器主动断开连接，可能是服务重启
        console.warn('服务器主动断开连接，等待5秒后尝试重连');
        attemptReconnect(5000);
      }
    });

    // 监听服务器自定义心跳
    socket.on('ping_from_server', () => {
      console.log('收到服务器心跳ping');
      // 回应服务器心跳
      socket.emit('pong_from_client');
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
          // 关闭当前传输层尝试升级
          socket.io.engine.transport.close();
        }
      }
    });

    // 监听重连尝试
    socket.on('reconnect_attempt', (attempt) => {
      console.log(`Socket.IO重连尝试 #${attempt}`);
      
      // 在重连时尝试改变传输方式
      if (attempt > 3) {
        // 在多次尝试后，先尝试polling，因为它可能更稳定
        socket.io.opts.transports = ['polling', 'websocket'];
      }
    });

    // 监听重连成功
    socket.on('reconnect', (attempt) => {
      console.log(`Socket.IO重连成功，尝试次数: ${attempt}`);
      // 重置尝试次数
      reconnectAttempts = 0;
      // 重连成功后重新启动心跳
      startHeartbeat(); 
    });
    
    // 监听pong响应
    socket.on('pong', () => {
      console.log('收到服务器pong响应');
    });
    
    // 监听错误
    socket.on('error', (error) => {
      console.error('Socket.IO错误事件:', error);
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
      
      // 设置ping超时检测
      const pingTimeout = setTimeout(() => {
        if (socket && socket.connected) {
          console.warn('ping超时未收到响应，主动尝试重连');
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
  if (socket && !socket.connected && reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
    reconnectAttempts++;
    console.log(`手动尝试重连 #${reconnectAttempts}...`);
    
    // 先断开旧连接
    socket.disconnect();
    
    // 延迟后重新连接
    setTimeout(() => {
      // 检查是否已经连接
      if (!socket.connected) {
        console.log(`尝试重新连接...`);
        
        // 先尝试不同的传输方式
        if (reconnectAttempts % 2 === 0) {
          console.log('尝试使用polling传输方式重连');
          socket.io.opts.transports = ['polling', 'websocket'];
        } else {
          console.log('尝试使用websocket传输方式重连');
          socket.io.opts.transports = ['websocket', 'polling'];
        }
        
        socket.connect();
      }
    }, delay);
  } else if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
    console.error('达到最大重连次数，需要用户手动刷新页面');
    // 可以在这里触发一个全局事件，通知UI显示一个重连失败的提示
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
  
  if (socket && socket.connected) {
    socket.emit('authenticate', { userId });
    console.log('发送用户认证:', { userId });
    return true;
  } else {
    console.error('发送认证失败: Socket未连接');
    return false;
  }
};

// 发送进度更新
export const sendProgressUpdate = (progressData: any) => {
  if (!socket) initSocket();
  
  if (socket && socket.connected) {
    socket.emit('update_progress', progressData);
    console.log('发送进度更新:', progressData);
    return true;
  } else {
    console.error('发送进度更新失败: Socket未连接');
    return false;
  }
};

// 监听进度更新
export const onProgressUpdate = (callback: (data: { questionSetId: string, progress: UserProgress }) => void) => {
  if (!socket) initSocket();
  
  socket?.on('progress_updated', (data) => {
    console.log('收到进度更新:', data);
    callback(data);
  });
  
  return () => {
    socket?.off('progress_updated');
  };
};

// 手动测试连接
export const testConnection = () => {
  if (!socket) initSocket();
  
  if (socket && socket.connected) {
    console.log('Socket测试: 当前已连接');
    console.log('连接ID:', socket.id);
    console.log('传输方式:', socket.io.engine.transport.name);
    return true;
  } else {
    console.log('Socket测试: 当前未连接');
    return false;
  }
};

export default getSocket; 