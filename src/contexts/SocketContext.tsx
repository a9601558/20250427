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

interface SocketContextType {
  socket: Socket | null;
  connected: boolean;
  reconnect: () => void;
}

// Create the context with default undefined value
const SocketContext = createContext<SocketContextType | undefined>(undefined);

export const SocketProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  
  // Add refs to track current user details without depending on UserContext
  const currentUserIdRef = useRef<string | null>(null);
  
  // 在组件挂载时初始化Socket
  useEffect(() => {
    console.log('[SocketContext] 初始化Socket提供者');
    const socketInstance = initializeSocket();
    setSocket(socketInstance);
    
    // 监听连接状态
    const handleConnect = () => {
      console.log('[SocketContext] Socket已连接');
      setConnected(true);
    };
    
    const handleDisconnect = (reason: string) => {
      console.log(`[SocketContext] Socket已断开: ${reason}`);
      setConnected(false);
    };
    
    socketInstance.on('connect', handleConnect);
    socketInstance.on('disconnect', handleDisconnect);
    
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
      socketInstance.off('connect', handleConnect);
      socketInstance.off('disconnect', handleDisconnect);
      closeSocket();
    };
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
          authenticateUser(userId, token);
          console.log(`[SocketContext] 用户登录认证: ${userId}`);
        }
      } else if (type === 'logout') {
        deauthenticateSocket();
        currentUserIdRef.current = null;
        console.log('[SocketContext] 用户登出，清除认证');
      }
    };
    
    // Create a custom event for listening to user changes
    window.addEventListener('user:change', handleUserChange as EventListener);
    
    return () => {
      window.removeEventListener('user:change', handleUserChange as EventListener);
    };
  }, [socket]);
  
  // 监听全局Socket重置事件
  useEffect(() => {
    const handleSocketReset = (event: Event) => {
      if (!socket) return;
      
      const customEvent = event as CustomEvent<{userId?: string, token?: string}>;
      const { userId, token } = customEvent.detail || {};
      
      if (userId && token) {
        console.log(`[SocketContext] 收到Socket重置事件: 用户=${userId}`);
        currentUserIdRef.current = userId;
        authenticateUser(userId, token);
      }
    };
    
    const handleSocketDisconnect = () => {
      if (!socket) return;
      console.log('[SocketContext] 收到Socket断开事件');
      deauthenticateSocket();
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
  }, [socket]);
  
  // 提供重连方法
  const reconnect = () => {
    if (!socket) return;
    
    console.log('[SocketContext] 手动重连Socket');
    
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
    reconnect
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