import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
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
import { useUser } from './UserContext';

interface SocketContextType {
  socket: Socket | null;
  connected: boolean;
  reconnect: () => void;
}

// Create the context with default undefined value
const SocketContext = createContext<SocketContextType | undefined>(undefined);

export const SocketProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { user, userChangeEvent } = useUser();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  
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
    
    // 组件卸载时清理
    return () => {
      console.log('[SocketContext] 清理Socket提供者');
      socketInstance.off('connect', handleConnect);
      socketInstance.off('disconnect', handleDisconnect);
      closeSocket();
    };
  }, []);
  
  // 监听用户变更事件
  useEffect(() => {
    if (!socket || !userChangeEvent) return;
    
    console.log(`[SocketContext] 检测到用户变更事件: 用户=${userChangeEvent.userId}, 类型=${userChangeEvent.type}`);
    
    // 根据用户变更类型处理Socket连接
    if (userChangeEvent.type === 'login' && userChangeEvent.userId) {
      // 登录 - 使用新用户认证
      const token = localStorage.getItem('token');
      if (token) {
        console.log(`[SocketContext] 用户登录，使用新凭据认证Socket: ${userChangeEvent.userId}`);
        authenticateUser(userChangeEvent.userId, token);
      }
    } else if (userChangeEvent.type === 'logout') {
      // 登出 - 清除认证并断开
      console.log('[SocketContext] 用户登出，清除Socket认证');
      deauthenticateSocket();
    }
  }, [socket, userChangeEvent]);
  
  // 监听全局Socket重置事件
  useEffect(() => {
    const handleSocketReset = (event: Event) => {
      if (!socket) return;
      
      const customEvent = event as CustomEvent<{userId?: string, token?: string}>;
      const { userId, token } = customEvent.detail || {};
      
      if (userId && token) {
        console.log(`[SocketContext] 收到Socket重置事件: 用户=${userId}`);
        authenticateUser(userId, token);
      }
    };
    
    const handleSocketDisconnect = () => {
      if (!socket) return;
      console.log('[SocketContext] 收到Socket断开事件');
      deauthenticateSocket();
    };
    
    window.addEventListener('socket:reset', handleSocketReset as EventListener);
    window.addEventListener('socket:disconnect', handleSocketDisconnect);
    
    return () => {
      window.removeEventListener('socket:reset', handleSocketReset as EventListener);
      window.removeEventListener('socket:disconnect', handleSocketDisconnect);
    };
  }, [socket]);
  
  // 确保当前用户和Socket认证匹配
  useEffect(() => {
    if (!socket || !user) return;
    
    const token = localStorage.getItem('token');
    if (user.id && token) {
      // 获取当前Socket认证信息
      const currentAuth = (socket as any).auth || {};
      
      // 如果Socket认证的用户ID与当前用户不匹配，重新认证
      if (currentAuth.userId !== user.id) {
        console.log(`[SocketContext] Socket认证用户(${currentAuth.userId || 'none'})与当前用户(${user.id})不匹配，重新认证`);
        authenticateUser(user.id, token);
      }
    }
  }, [socket, user]);
  
  // 提供重连方法
  const reconnect = () => {
    if (!socket) return;
    
    console.log('[SocketContext] 手动重连Socket');
    
    // 如果已有用户，重新认证
    if (user?.id) {
      const token = localStorage.getItem('token');
      if (token) {
        authenticateUser(user.id, token);
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