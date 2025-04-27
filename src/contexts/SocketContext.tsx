import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { Socket } from 'socket.io-client';
import { initSocket, closeSocket } from '../config/socket';
import { toast } from 'react-toastify';

interface SocketContextType {
  socket: Socket | null;
  isConnected: boolean;
  connectionError: string | null;
  reconnect: () => void;
}

const SocketContext = createContext<SocketContextType>({
  socket: null,
  isConnected: false,
  connectionError: null,
  reconnect: () => {}
});

interface SocketProviderProps {
  children: ReactNode;
}

export const SocketProvider: React.FC<SocketProviderProps> = ({ children }) => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [reconnectAttempts, setReconnectAttempts] = useState(0);

  const setupSocketListeners = (socket: Socket) => {
    socket.on('connect', () => {
      console.log('Socket连接成功');
      setIsConnected(true);
      setConnectionError(null);
      setReconnectAttempts(0);
      
      // 可以在这里添加显示连接成功的提示
      // toast.success('Socket连接已建立');
    });

    socket.on('disconnect', (reason) => {
      console.log(`Socket断开连接: ${reason}`);
      setIsConnected(false);
      
      if (reason === 'io server disconnect') {
        // 服务器主动断开连接，需要手动重连
        toast.error('服务器断开了连接，请重新连接');
      } else {
        // 其他原因导致的断开连接，Socket.IO会自动尝试重连
        toast.warning('连接已断开，正在尝试重新连接...');
      }
    });

    socket.on('connect_error', (error) => {
      console.error('Socket连接错误:', error);
      setIsConnected(false);
      setConnectionError(error.message);
      setReconnectAttempts(prev => prev + 1);
      
      // 三次重连失败后显示错误提示
      if (reconnectAttempts >= 2) {
        toast.error(`Socket连接失败: ${error.message}，请检查网络或联系管理员`);
      }
    });

    socket.on('reconnect_attempt', (attempt) => {
      console.log(`Socket重连尝试 #${attempt}`);
      // 可以在这里添加显示重连尝试的提示
    });

    socket.on('reconnect', (attempt) => {
      console.log(`Socket重连成功，尝试次数: ${attempt}`);
      setIsConnected(true);
      setConnectionError(null);
      toast.success('已重新连接到服务器');
    });

    socket.on('reconnect_failed', () => {
      console.error('Socket重连失败');
      setConnectionError('无法重新连接到服务器');
      toast.error('重连失败，请刷新页面或检查网络连接');
    });

    // 使用Socket自定义事件
    socket.on('error', (errorMessage: string) => {
      console.error('Socket错误:', errorMessage);
      toast.error(`Socket错误: ${errorMessage}`);
    });
  };

  // 初始化Socket
  useEffect(() => {
    try {
      console.log('初始化Socket连接');
      const socketInstance = initSocket();
      setSocket(socketInstance);
      setupSocketListeners(socketInstance);
      
      // 组件卸载时关闭Socket连接
      return () => {
        console.log('关闭Socket连接');
        closeSocket();
        setSocket(null);
      };
    } catch (error) {
      console.error('初始化Socket失败:', error);
      setConnectionError(error instanceof Error ? error.message : '未知错误');
      toast.error(`Socket初始化失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  }, []);

  // 提供手动重连功能
  const reconnect = () => {
    if (socket) {
      try {
        // 先关闭现有连接
        closeSocket();
        setSocket(null);
        
        // 然后重新建立连接
        const newSocket = initSocket();
        setSocket(newSocket);
        setupSocketListeners(newSocket);
        toast.info('正在尝试重新连接...');
      } catch (error) {
        console.error('手动重连失败:', error);
        setConnectionError(error instanceof Error ? error.message : '未知错误');
        toast.error(`重连失败: ${error instanceof Error ? error.message : '未知错误'}`);
      }
    }
  };

  return (
    <SocketContext.Provider value={{ socket, isConnected, connectionError, reconnect }}>
      {children}
    </SocketContext.Provider>
  );
};

// 创建自定义Hook来使用Socket上下文
export const useSocket = () => useContext(SocketContext);

export default SocketContext; 