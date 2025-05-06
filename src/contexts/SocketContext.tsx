import React, { createContext, useContext, useEffect, useState, ReactNode, useRef } from 'react';
import { Socket } from 'socket.io-client';
import { 
  initializeSocket, 
  authenticateUser, 
  deauthenticateSocket, 
  closeSocket,
  startHeartbeat,
  stopHeartbeat,
  attemptReconnect
} from '../config/socket';

// For mock socket functionality when real socket fails
interface MockSocket {
  connected: boolean;
  auth: any;
  emit: (event: string, ...args: any[]) => void;
  on: (event: string, callback: (...args: any[]) => void) => void;
  off: (event: string, callback?: (...args: any[]) => void) => void;
  connect: () => MockSocket;
  disconnect: () => MockSocket;
}

// Create a mock socket that logs operations but doesn't attempt actual connections
const createMockSocket = (): MockSocket => {
  console.warn('[SocketContext] Using mock socket - operations will be logged but not performed');
  
  return {
    connected: false,
    auth: {},
    emit: (event, ...args) => {
      console.log(`[MockSocket] Emit event "${event}"`, args);
    },
    on: (event, callback) => {
      console.log(`[MockSocket] Registered listener for "${event}"`);
    },
    off: (event, callback) => {
      console.log(`[MockSocket] Removed listener for "${event}"`);
    },
    connect: () => {
      console.log('[MockSocket] Connect called (no actual connection)');
      return createMockSocket();
    },
    disconnect: () => {
      console.log('[MockSocket] Disconnect called (no actual disconnection)');
      return createMockSocket();
    }
  };
};

interface SocketContextType {
  socket: Socket | MockSocket | null;
  connected: boolean;
  reconnect: () => void;
  connectionFailed: boolean;
}

// Create the context with default undefined value
const SocketContext = createContext<SocketContextType | undefined>(undefined);

export const SocketProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [socket, setSocket] = useState<Socket | MockSocket | null>(null);
  const [connected, setConnected] = useState(false);
  const [connectionAttempts, setConnectionAttempts] = useState(0);
  const [connectionFailed, setConnectionFailed] = useState(false);
  
  // Add refs to track current user details without depending on UserContext
  const currentUserIdRef = useRef<string | null>(null);
  const maxAttempts = 5; // Maximum connection attempts
  
  // 在组件挂载时初始化Socket
  useEffect(() => {
    console.log('[SocketContext] 初始化Socket提供者');
    
    try {
      const socketInstance = initializeSocket();
      setSocket(socketInstance);
      
      // 监听连接状态
      const handleConnect = () => {
        console.log('[SocketContext] Socket已连接');
        setConnected(true);
        setConnectionAttempts(0); // Reset attempts on success
        setConnectionFailed(false);
      };
      
      const handleDisconnect = (reason: string) => {
        console.log(`[SocketContext] Socket已断开: ${reason}`);
        setConnected(false);
      };
      
      const handleConnectError = (error: any) => {
        console.error('[SocketContext] 连接错误:', error);
        
        setConnectionAttempts(prev => {
          const newAttempts = prev + 1;
          console.log(`[SocketContext] 连接尝试 ${newAttempts}/${maxAttempts}`);
          
          // If too many attempts, switch to mock socket
          if (newAttempts >= maxAttempts) {
            console.warn('[SocketContext] 达到最大尝试次数，切换到mock socket');
            setConnectionFailed(true);
            
            // Cleanup real socket
            socketInstance.off('connect', handleConnect);
            socketInstance.off('disconnect', handleDisconnect);
            socketInstance.off('connect_error', handleConnectError);
            closeSocket();
            
            // Switch to mock socket
            const mockSocket = createMockSocket();
            setSocket(mockSocket);
          }
          
          return newAttempts;
        });
      };
      
      socketInstance.on('connect', handleConnect);
      socketInstance.on('disconnect', handleDisconnect);
      socketInstance.on('connect_error', handleConnectError);
      
      // Try to initialize with existing token
      const token = localStorage.getItem('token');
      const storedUser = localStorage.getItem('user');
      
      if (token && storedUser) {
        try {
          const userData = JSON.parse(storedUser);
          if (userData && userData.id) {
            currentUserIdRef.current = userData.id;
            authenticateUser(userData.id, token);
            console.log(`[SocketContext] 使用存储的用户信息初始化: userId=${userData.id}`);
          }
        } catch (e) {
          console.error('[SocketContext] 解析存储的用户信息失败', e);
        }
      }
      
      // 组件卸载时清理
      return () => {
        console.log('[SocketContext] 清理Socket提供者');
        
        if (socketInstance) {
          socketInstance.off('connect', handleConnect);
          socketInstance.off('disconnect', handleDisconnect);
          socketInstance.off('connect_error', handleConnectError);
          closeSocket();
        }
      };
    } catch (err) {
      console.error('[SocketContext] Socket初始化失败:', err);
      setConnectionFailed(true);
      setSocket(createMockSocket());
      return () => {};
    }
  }, []);
  
  // Listen for user change events via DOM events instead of React context
  useEffect(() => {
    // Handler for user login/change events
    const handleUserChange = (event: Event) => {
      const customEvent = event as CustomEvent<{
        userId: string | null;
        type?: 'login' | 'logout' | 'access_rights_updated' | 'user_updated';
        timestamp: number;
      }>;
      
      const { userId, type, timestamp } = customEvent.detail || {};
      
      if (!socket) return;
      
      console.log(`[SocketContext] 收到用户变更事件: userId=${userId}, type=${type}, timestamp=${timestamp}`);
      
      if (type === 'login' && userId) {
        const token = localStorage.getItem('token');
        if (token) {
          currentUserIdRef.current = userId;
          
          // Only try to authenticate with real sockets
          if (!connectionFailed) {
            authenticateUser(userId, token);
          }
          console.log(`[SocketContext] 用户登录认证: ${userId}`);
        }
      } else if (type === 'logout') {
        if (!connectionFailed) {
          deauthenticateSocket();
        }
        currentUserIdRef.current = null;
        console.log('[SocketContext] 用户登出，清除认证');
      }
    };
    
    // Create a custom event for listening to user changes
    window.addEventListener('user:change', handleUserChange as EventListener);
    
    return () => {
      window.removeEventListener('user:change', handleUserChange as EventListener);
    };
  }, [socket, connectionFailed]);
  
  // 监听全局Socket重置事件
  useEffect(() => {
    const handleSocketReset = (event: Event) => {
      if (!socket) return;
      
      const customEvent = event as CustomEvent<{userId?: string, token?: string}>;
      const { userId, token } = customEvent.detail || {};
      
      if (userId && token) {
        console.log(`[SocketContext] 收到Socket重置事件: 用户=${userId}`);
        currentUserIdRef.current = userId;
        
        if (!connectionFailed) {
          authenticateUser(userId, token);
        }
      }
    };
    
    const handleSocketDisconnect = () => {
      if (!socket) return;
      console.log('[SocketContext] 收到Socket断开事件');
      
      if (!connectionFailed) {
        deauthenticateSocket();
      }
      currentUserIdRef.current = null;
    };
    
    // Listen for access update events
    const handleAccessUpdate = (event: Event) => {
      if (!socket) return;
      
      const customEvent = event as CustomEvent<{
        userId: string;
        questionSetId: string;
        hasAccess: boolean;
        purchaseId?: string;
        expiryDate?: string;
      }>;
      
      const { userId, questionSetId, hasAccess, purchaseId, expiryDate } = customEvent.detail || {};
      
      if (userId && questionSetId) {
        console.log(`[SocketContext] 收到访问更新事件: 用户=${userId}, 题库=${questionSetId}, 权限=${hasAccess}`);
        
        // Forward to socket events
        socket.emit('questionSet:accessUpdate', {
          userId,
          questionSetId,
          hasAccess
        });
        
        if (purchaseId) {
          socket.emit('purchase:success', {
            userId,
            questionSetId,
            purchaseId,
            expiryDate
          });
        }
      }
    };
    
    window.addEventListener('socket:reset', handleSocketReset as EventListener);
    window.addEventListener('socket:disconnect', handleSocketDisconnect);
    window.addEventListener('access:update', handleAccessUpdate as EventListener);
    
    return () => {
      window.removeEventListener('socket:reset', handleSocketReset as EventListener);
      window.removeEventListener('socket:disconnect', handleSocketDisconnect);
      window.removeEventListener('access:update', handleAccessUpdate as EventListener);
    };
  }, [socket, connectionFailed]);
  
  // 提供重连方法
  const reconnect = () => {
    if (!socket) return;
    
    console.log('[SocketContext] 手动重连Socket');
    
    // If using mock socket, try to reconnect with real socket
    if (connectionFailed) {
      try {
        setConnectionFailed(false);
        setConnectionAttempts(0);
        const newSocket = initializeSocket();
        setSocket(newSocket);
        
        // Re-authenticate if needed
        if (currentUserIdRef.current) {
          const token = localStorage.getItem('token');
          if (token) {
            authenticateUser(currentUserIdRef.current, token);
          }
        }
        
        return;
      } catch (err) {
        console.error('[SocketContext] 重连失败:', err);
        setConnectionFailed(true);
        return;
      }
    }
    
    // 如果有用户ID，重新认证
    if (currentUserIdRef.current) {
      const token = localStorage.getItem('token');
      if (token) {
        authenticateUser(currentUserIdRef.current, token);
      }
    }
    
    // 断开后重连
    if (socket.connected) {
      socket.disconnect().connect();
    } else {
      socket.connect();
    }
  };
  
  // Ensure value is memoized to prevent unnecessary re-renders
  const contextValue = {
    socket,
    connected,
    reconnect,
    connectionFailed
  };
  
  return (
    <SocketContext.Provider value={contextValue}>
      {children}
    </SocketContext.Provider>
  );
};

// Custom hook to use the socket context
export const useSocket = () => {
  const context = useContext(SocketContext);
  if (context === undefined) {
    throw new Error('useSocket must be used within a SocketProvider');
  }
  return context;
}; 