import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { useUser } from './UserContext';

interface SocketContextType {
  socket: Socket | null;
  isConnected: boolean;
  reconnect: () => void;
  lastError: string | null;
  socketDisabled?: boolean;
  disableSocket?: () => void;
}

const SocketContext = createContext<SocketContextType>({
  socket: null,
  isConnected: false,
  reconnect: () => {},
  lastError: null
});

export const useSocket = () => useContext(SocketContext);

export const SocketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);
  const { user } = useUser();
  
  // 是否完全禁用Socket连接
  const [socketDisabled, setSocketDisabled] = useState<boolean>(false);
  
  // 使用useRef存储重连计数器和定时器引用，减少不必要的渲染
  const reconnectCount = useRef(0);
  const reconnectTimerId = useRef<NodeJS.Timeout | null>(null);
  const reconnectDelay = useRef(1000); // 初始重连延迟1秒
  const maxReconnectDelay = 30000; // 最大重连延迟30秒
  const maxReconnectAttempts = 5; // 减少最大重连尝试次数，避免过多无效请求
  const requestsCount = useRef<{[key: string]: {count: number, lastTime: number}}>({});
  
  // 使用节流函数减少请求频率
  const throttleRequest = (eventName: string, data: any, interval = 2000) => {
    const now = Date.now();
    const requestKey = `${eventName}-${JSON.stringify(data)}`;
    
    if (!requestsCount.current[requestKey]) {
      requestsCount.current[requestKey] = { count: 0, lastTime: 0 };
    }
    
    const reqInfo = requestsCount.current[requestKey];
    
    // 如果在间隔时间内已经发送过相同请求，则忽略
    if (now - reqInfo.lastTime < interval) {
      console.log(`[Socket] 节流: 忽略重复的 ${eventName} 请求`);
      return false;
    }
    
    // 更新请求时间和计数
    reqInfo.lastTime = now;
    reqInfo.count++;
    
    return true;
  };
  
  // 初始化socket连接
  const initSocket = () => {
    // 如果Socket连接被禁用，直接返回
    if (socketDisabled) {
      console.log('[Socket] 连接已被禁用，跳过初始化');
      return null;
    }
    
    if (socket) {
      console.log('[Socket] 关闭旧连接');
      socket.disconnect();
    }
    
    console.log('[Socket] 初始化新连接');
    
    try {
      // 创建新的Socket实例 - 基于当前环境自动选择正确的URL
      // 获取当前域名作为Socket服务器地址（去除http(s)://前缀）
      const currentDomain = window.location.hostname;
      const currentPort = window.location.port;
      const isLocalhost = currentDomain === 'localhost' || currentDomain === '127.0.0.1';
      const protocol = window.location.protocol === 'https:' ? 'https' : 'http';
      
      // 根据环境确定Socket URL
      let SOCKET_URL = '';
      
      if (isLocalhost) {
        // 本地开发环境
        SOCKET_URL = process.env.REACT_APP_SOCKET_URL || 'http://localhost:5000';
      } else {
        // 生产环境 - 使用相同域名不同端口或相同域名
        // 如果在同一域名下运行API和前端，可以使用相对路径
        SOCKET_URL = `${protocol}://${currentDomain}${currentPort ? ':' + currentPort : ''}`;
      }
      
      console.log(`[Socket] 尝试连接到 ${SOCKET_URL}`);
      
      const newSocket = io(SOCKET_URL, {
        transports: ['websocket'],
        timeout: 10000,
        reconnectionAttempts: 3,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        autoConnect: true,
        query: user ? { userId: user.id } : undefined
      });
      
      // 添加断线重连和错误处理
      newSocket.on('connect', () => {
        console.log('[Socket] 已连接到服务器');
        setIsConnected(true);
        setLastError(null);
        reconnectCount.current = 0;
        reconnectDelay.current = 1000;
        
        // 如果用户已登录，发送认证信息
        if (user) {
          newSocket.emit('auth', { userId: user.id, token: localStorage.getItem('token') });
        }
      });
      
      // 优化断开连接处理
      newSocket.on('disconnect', (reason) => {
        console.log(`[Socket] 断开连接: ${reason}`);
        
        // 只在非主动断开的情况下更新状态，避免不必要的重连
        if (reason !== 'io client disconnect') {
          setIsConnected(false);
          
          // 实现指数退避重连
          if (reconnectCount.current < maxReconnectAttempts) {
            console.log(`[Socket] 将在 ${reconnectDelay.current/1000}秒后尝试重连...`);
            
            // 清除之前的重连定时器
            if (reconnectTimerId.current) {
              clearTimeout(reconnectTimerId.current);
            }
            
            // 设置新的重连定时器
            reconnectTimerId.current = setTimeout(() => {
              reconnectCount.current++;
              reconnectDelay.current = Math.min(reconnectDelay.current * 2, maxReconnectDelay);
              console.log(`[Socket] 第 ${reconnectCount.current} 次尝试重连`);
              
              // 检查是否应该禁用Socket连接
              if (reconnectCount.current >= maxReconnectAttempts) {
                console.log('[Socket] 达到最大重连次数，禁用Socket连接');
                setSocketDisabled(true);
                setLastError('已达到最大重连次数，Socket已禁用');
              } else {
                newSocket.connect();
              }
            }, reconnectDelay.current);
          } else {
            console.log('[Socket] 达到最大重连次数，禁用Socket连接');
            setSocketDisabled(true);
            setLastError('已达到最大重连次数，Socket已禁用');
          }
        }
      });
      
      // 处理连接错误，避免异常渲染
      newSocket.on('connect_error', (error) => {
        console.error('[Socket] 连接错误:', error);
        const errorMsg = `连接错误: ${error.message}`;
        setLastError(errorMsg);
        
        // 连续失败多次后自动禁用Socket，避免过多429错误
        if (reconnectCount.current >= maxReconnectAttempts) {
          console.log('[Socket] 连接持续失败，自动禁用Socket功能');
          setSocketDisabled(true);
        }
        
        // 不立即触发重连，而是让断开连接事件处理器来处理重连
        // 这可以防止多个重连计时器
      });
      
      // 截获所有事件，优化请求频率
      const originalEmit = newSocket.emit;
      newSocket.emit = function(eventName: string, ...args: any[]) {
        // 如果Socket已被禁用，则直接返回空对象
        if (socketDisabled) {
          console.log(`[Socket] Socket已禁用，忽略事件: ${eventName}`);
          return {} as any;
        }
        
        // 不限制内部事件
        if (eventName.startsWith('connect') || eventName === 'auth') {
          return originalEmit.apply(this, [eventName, ...args]);
        }
        
        // 对外部事件进行节流
        if (throttleRequest(eventName, args[0])) {
          return originalEmit.apply(this, [eventName, ...args]);
        }
        
        // 返回空对象以保持API兼容性
        return {} as any;
      };
      
      // 保存socket实例
      setSocket(newSocket);
      
      return newSocket;
    } catch (error) {
      console.error('[Socket] 初始化Socket时发生错误:', error);
      setLastError(`Socket初始化错误: ${error}`);
      setSocketDisabled(true);
      return null;
    }
  };
  
  // 监听用户认证状态变化，更新Socket连接
  useEffect(() => {
    // 用户登录或登出时重新初始化Socket
    const newSocket = initSocket();
    
    // 组件卸载时清理
    return () => {
      console.log('[Socket] 组件卸载，断开连接');
      if (reconnectTimerId.current) {
        clearTimeout(reconnectTimerId.current);
      }
      newSocket?.disconnect();
    };
  }, [user?.id]); // 仅在用户ID变化时重新连接
  
  // 手动重连函数
  const reconnect = () => {
    if (socketDisabled) {
      // 如果之前被禁用，则重新启用
      console.log('[Socket] 重新启用Socket连接');
      setSocketDisabled(false);
      setTimeout(() => initSocket(), 500); // 稍微延迟，确保状态更新
    } else {
      console.log('[Socket] 手动触发重连');
      reconnectCount.current = 0;
      reconnectDelay.current = 1000;
      initSocket();
    }
  };
  
  // 禁用Socket连接
  const disableSocket = () => {
    console.log('[Socket] 用户手动禁用Socket连接');
    setSocketDisabled(true);
    if (socket) {
      socket.disconnect();
    }
    if (reconnectTimerId.current) {
      clearTimeout(reconnectTimerId.current);
    }
  };
  
  // 定期清理请求计数，防止内存泄漏
  useEffect(() => {
    const cleanupInterval = setInterval(() => {
      const now = Date.now();
      Object.keys(requestsCount.current).forEach(key => {
        if (now - requestsCount.current[key].lastTime > 600000) { // 10分钟未使用则清理
          delete requestsCount.current[key];
        }
      });
    }, 300000); // 每5分钟清理一次
    
    return () => clearInterval(cleanupInterval);
  }, []);
  
  return (
    <SocketContext.Provider value={{ 
      socket, 
      isConnected, 
      reconnect, 
      lastError,
      socketDisabled,
      disableSocket
    }}>
      {children}
      {lastError && !isConnected && (
        <div className="fixed bottom-4 right-4 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded shadow-md z-50">
          <div className="flex items-center">
            <div className="flex-1">
              <p className="font-bold">实时连接{socketDisabled ? '已禁用' : '失败'}</p>
              <p className="text-sm">{lastError}</p>
              <p className="text-xs mt-1 text-gray-600">
                {socketDisabled 
                  ? '实时数据同步功能已禁用，部分功能可能受影响'
                  : '无法建立实时连接，部分功能可能受限'}
              </p>
            </div>
            <div className="ml-4 flex flex-col space-y-2">
              <button 
                onClick={reconnect}
                className="bg-blue-100 hover:bg-blue-200 text-blue-800 py-1 px-3 rounded text-sm"
              >
                {socketDisabled ? '启用连接' : '重试连接'}
              </button>
              {!socketDisabled && (
                <button 
                  onClick={disableSocket}
                  className="bg-gray-100 hover:bg-gray-200 text-gray-800 py-1 px-3 rounded text-sm"
                >
                  禁用连接
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </SocketContext.Provider>
  );
}; 