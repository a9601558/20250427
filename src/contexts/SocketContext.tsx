import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { useUser } from './UserContext';
import { logger } from '../utils/logger';

interface SocketContextType {
  socket: Socket | null;
  isConnected: boolean;
  reconnect: () => void;
  lastError: string | null;
  socketDisabled?: boolean;
  disableSocket?: () => void;
}

interface SocketRequestInfo {
  count: number;
  lastTime: number;
}

interface SocketRequestsMap {
  [key: string]: SocketRequestInfo;
}

interface ThrottleData {
  [key: string]: unknown;
}

const SocketContext = createContext<SocketContextType>({
  socket: null,
  isConnected: false,
  reconnect: () => {},
  lastError: null,
});

export const useSocket = () => useContext(SocketContext);

export const SocketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);
  const { user } = useUser();
  
  // 是否完全禁用Socket连接
  const [socketDisabled, setSocketDisabled] = useState<boolean>(false);
  
  // 跟踪认证令牌变化
  const [authToken, setAuthToken] = useState<string | null>(localStorage.getItem('token'));
  
  // 使用useRef存储重连计数器和定时器引用，减少不必要的渲染
  const reconnectCount = useRef(0);
  const reconnectTimerId = useRef<NodeJS.Timeout | null>(null);
  const reconnectDelay = useRef(1000); // 初始重连延迟1秒
  const maxReconnectDelay = 30000; // 最大重连延迟30秒
  const maxReconnectAttempts = 5; // 减少最大重连尝试次数，避免过多无效请求
  const requestsCount = useRef<SocketRequestsMap>({});
  
  // 使用节流函数减少请求频率
  const throttleRequest = (eventName: string, data: ThrottleData, interval = 2000) => {
    const now = Date.now();
    const requestKey = `${eventName}-${JSON.stringify(data)}`;
    
    if (!requestsCount.current[requestKey]) {
      requestsCount.current[requestKey] = { count: 0, lastTime: 0 };
    }
    
    const reqInfo = requestsCount.current[requestKey];
    
    // 如果在间隔时间内已经发送过相同请求，则忽略
    if (now - reqInfo.lastTime < interval) {
      logger.debug(`[Socket] 节流: 忽略重复的 ${eventName} 请求`);
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
      logger.info('[Socket] 连接已被禁用，跳过初始化');
      return null;
    }
    
    if (socket) {
      logger.info('[Socket] 关闭旧连接');
      socket.disconnect();
    }
    
    logger.info('[Socket] 初始化新连接');
    
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
      
      logger.info(`[Socket] 尝试连接到 ${SOCKET_URL}`);
      
      // 获取认证令牌
      const token = localStorage.getItem('token');
      
      const newSocket = io(SOCKET_URL, {
        transports: ['websocket'],
        timeout: 10000,
        reconnectionAttempts: 3,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        autoConnect: true,
        auth: {
          token: token, // 在auth对象中提供令牌
        },
        query: {
          userId: user?.id,
          token: token, // 同时在query中也提供令牌，确保兼容性
        },
      });
      
      // 添加断线重连和错误处理
      newSocket.on('connect', () => {
        logger.info('[Socket] 已连接到服务器');
        setIsConnected(true);
        setLastError(null);
        reconnectCount.current = 0;
        reconnectDelay.current = 1000;
        
        // 不再需要在这里发送auth事件，因为我们在连接时已经提供了token
        // 如果服务器仍然需要额外auth事件，可以取消注释下面的代码
        /*
        if (user && token) {
          logger.info('[Socket] 发送额外认证信息');
          newSocket.emit('auth', { 
            userId: user.id, 
            token: token,
            timestamp: new Date().getTime()
          });
        }
        */
      });
      
      // 优化断开连接处理
      newSocket.on('disconnect', (reason) => {
        logger.info(`[Socket] 断开连接: ${reason}`);
        
        // 处理认证错误导致的断开连接
        if (reason === 'io server disconnect') {
          // 服务器主动断开连接，可能是认证问题
          logger.info('[Socket] 服务器主动断开连接，可能是认证问题');
          
          // 检查token
          const currentToken = localStorage.getItem('token');
          if (!currentToken || currentToken !== authToken) {
            logger.info('[Socket] token失效或变化，更新状态');
            setAuthToken(currentToken);
          }
        }
        
        // 只在非主动断开的情况下更新状态，避免不必要的重连
        if (reason !== 'io client disconnect') {
          setIsConnected(false);
          
          // 实现指数退避重连
          if (reconnectCount.current < maxReconnectAttempts) {
            logger.info(`[Socket] 将在 ${reconnectDelay.current/1000}秒后尝试重连...`);
            
            // 清除之前的重连定时器
            if (reconnectTimerId.current) {
              clearTimeout(reconnectTimerId.current);
            }
            
            // 设置新的重连定时器
            reconnectTimerId.current = setTimeout(() => {
              reconnectCount.current++;
              reconnectDelay.current = Math.min(reconnectDelay.current * 2, maxReconnectDelay);
              logger.info(`[Socket] 第 ${reconnectCount.current} 次尝试重连`);
              
              // 检查是否应该禁用Socket连接
              if (reconnectCount.current >= maxReconnectAttempts) {
                logger.warn('[Socket] 达到最大重连次数，禁用Socket连接');
                setSocketDisabled(true);
                setLastError('已达到最大重连次数，Socket已禁用');
              } else {
                newSocket.connect();
              }
            }, reconnectDelay.current);
          } else {
            logger.warn('[Socket] 达到最大重连次数，禁用Socket连接');
            setSocketDisabled(true);
            setLastError('已达到最大重连次数，Socket已禁用');
          }
        }
      });
      
      // 处理连接错误，避免异常渲染
      newSocket.on('connect_error', (error) => {
        logger.error('[Socket] 连接错误:', error);
        const errorMsg = `连接错误: ${error.message}`;
        setLastError(errorMsg);
        
        // 处理认证错误
        if (error.message.includes('认证') || 
            error.message.includes('token') || 
            error.message.includes('auth') || 
            error.message.includes('令牌') ||
            error.message.includes('已过期')) {
          logger.info('[Socket] 检测到认证错误，检查token有效性');
          
          // 获取当前token
          const currentToken = localStorage.getItem('token');
          
          // token不存在或无效 - 清除错误的token
          if (!currentToken || currentToken === 'undefined' || currentToken === 'null') {
            logger.info('[Socket] 无效token，清除localStorage');
            localStorage.removeItem('token');
            setAuthToken(null);
          } else if (error.message.includes('已过期')) {
            // 令牌已过期，尝试刷新令牌
            logger.info('[Socket] 令牌已过期，尝试刷新令牌');
            
            // 这里可以调用您的刷新令牌API
            // 例如: refreshToken().then(newToken => {...})
            
            // 暂时断开连接，等待用户重新登录或刷新令牌
            setAuthToken(null);
          } else {
            // 尝试验证token并刷新连接
            logger.info('[Socket] 尝试使用新token重新连接');
            
            // 更新Socket的auth和query参数
            newSocket.auth = { token: currentToken };
            if (newSocket.io && newSocket.io.opts) {
              newSocket.io.opts.query = {
                ...newSocket.io.opts.query,
                token: currentToken,
              };
            }
            
            // 保存新token到状态
            setAuthToken(currentToken);
            // 稍后尝试重连
            setTimeout(() => {
              logger.info('[Socket] 使用更新后的认证参数重新连接');
              newSocket.connect();
            }, 1000);
          }
        }
        
        // 连续失败多次后自动禁用Socket，避免过多429错误
        if (reconnectCount.current >= maxReconnectAttempts) {
          logger.warn('[Socket] 连接持续失败，自动禁用Socket功能');
          setSocketDisabled(true);
        }
        
        // 不立即触发重连，而是让断开连接事件处理器来处理重连
        // 这可以防止多个重连计时器
      });
      
      // 截获所有事件，优化请求频率
      const originalEmit = newSocket.emit;
      newSocket.emit = function<Ev extends string>(eventName: Ev, ...args: any[]) {
        // 如果Socket已被禁用，则直接返回Socket实例以兼容链式调用
        if (socketDisabled) {
          logger.info(`[Socket] Socket已禁用，忽略事件: ${eventName}`);
          return this;
        }
        
        // 不限制内部事件
        if (eventName.startsWith('connect') || eventName === 'auth') {
          return originalEmit.apply(this, [eventName, ...args]);
        }
        
        // 对外部事件进行节流
        if (throttleRequest(eventName, args[0] as ThrottleData || {})) {
          return originalEmit.apply(this, [eventName, ...args]);
        }
        
        // 返回socket实例以保持API兼容性
        return this;
      };
      
      // 保存socket实例
      setSocket(newSocket);
      
      return newSocket;
    } catch (error) {
      const err = error as Error;
      logger.error('[Socket] 初始化Socket时发生错误:', err);
      setLastError(`Socket初始化错误: ${err.message}`);
      setSocketDisabled(true);
      return null;
    }
  };
  
  // 监听用户认证状态变化，更新Socket连接
  useEffect(() => {
    // 用户登录、登出或token变化时重新初始化Socket
    logger.info('[Socket] 用户状态或Token发生变化，重新初始化连接');
    const newSocket = initSocket();
    
    // 组件卸载时清理
    return () => {
      logger.info('[Socket] 组件卸载，断开连接');
      if (reconnectTimerId.current) {
        clearTimeout(reconnectTimerId.current);
      }
      newSocket?.disconnect();
    };
  }, [user?.id, authToken]); // 当用户ID或认证令牌变化时重新连接
  
  // 手动重连函数
  const reconnect = () => {
    if (socketDisabled) {
      // 如果之前被禁用，则重新启用
      logger.info('[Socket] 重新启用Socket连接');
      setSocketDisabled(false);
      setTimeout(() => initSocket(), 500); // 稍微延迟，确保状态更新
    } else {
      logger.info('[Socket] 手动触发重连');
      reconnectCount.current = 0;
      reconnectDelay.current = 1000;
      initSocket();
    }
  };
  
  // 禁用Socket连接
  const disableSocket = () => {
    logger.info('[Socket] 用户手动禁用Socket连接');
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
      Object.keys(requestsCount.current).forEach((key) => {
        if (now - requestsCount.current[key].lastTime > 600000) { // 10分钟未使用则清理
          delete requestsCount.current[key];
        }
      });
    }, 300000); // 每5分钟清理一次
    
    return () => clearInterval(cleanupInterval);
  }, []);
  
  // 监听localStorage中token的变化
  useEffect(() => {
    // 创建一个storage事件监听器
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'token') {
        const newToken = e.newValue;
        logger.info('[Socket] 检测到token变化，需要重新认证');
        setAuthToken(newToken);
        
        // 重新连接Socket，使用新的token
        if (socket) {
          logger.info('[Socket] 断开旧连接，使用新token重连');
          socket.disconnect();
          // 稍微延迟重连，确保断开操作完成
          setTimeout(() => initSocket(), 500);
        }
      }
    };
    
    // 添加事件监听器
    window.addEventListener('storage', handleStorageChange);
    
    // 清理函数
    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [socket]);
  
  // 定期检查token是否变化（不同标签页或组件内本地变化）
  useEffect(() => {
    const intervalId = setInterval(() => {
      const currentToken = localStorage.getItem('token');
      if (currentToken !== authToken) {
        logger.info('[Socket] 本地检测到token变化，更新状态');
        setAuthToken(currentToken);
        
        // 如果token变化了，重新连接Socket
        if (socket) {
          logger.info('[Socket] 断开旧连接，使用新token重连');
          socket.disconnect();
          setTimeout(() => initSocket(), 500);
        }
      }
    }, 60000); // 每分钟检查一次
    
    return () => clearInterval(intervalId);
  }, [socket, authToken]);
  
  return (
    <SocketContext.Provider value={{ 
      socket, 
      isConnected, 
      reconnect, 
      lastError,
      socketDisabled,
      disableSocket,
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
