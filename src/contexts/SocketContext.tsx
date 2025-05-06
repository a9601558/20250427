import React, { createContext, useContext, useEffect, useState, ReactNode, useRef, useCallback } from 'react';
import { Socket } from 'socket.io-client';
import { 
  initializeSocket, 
  authenticateUser, 
  deauthenticateSocket, 
  closeSocket,
  startHeartbeat,
  stopHeartbeat,
  attemptReconnect,
  isConnected
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
  
  const eventHandlers: Record<string, Array<(...args: any[]) => void>> = {};
  
  return {
    connected: false,
    auth: {},
    emit: (event, ...args) => {
      console.log(`[MockSocket] Emit event "${event}"`, args);
      
      // To simulate local behavior, immediately trigger any registered handlers for this event
      if (event === 'questionSet:checkAccess' || event === 'questionSet:checkAccessBatch') {
        // Get data from local storage instead
        try {
          const data = args[0];
          if (data && data.userId && data.questionSetId) {
            console.log(`[MockSocket] Simulating local response for ${event}`);
            
            // Try to find access data in localStorage
            const accessKey = `access_${data.questionSetId}`;
            const accessData = localStorage.getItem(accessKey);
            
            if (accessData) {
              const parsedData = JSON.parse(accessData);
              if (parsedData.userId === data.userId) {
                // Simulate a delayed response
                setTimeout(() => {
                  if (event === 'questionSet:checkAccess') {
                    // Trigger 'questionSet:accessUpdate' event handlers
                    const handlers = eventHandlers['questionSet:accessUpdate'] || [];
                    handlers.forEach(handler => {
                      handler({
                        userId: data.userId,
                        questionSetId: data.questionSetId,
                        hasAccess: parsedData.hasAccess,
                        remainingDays: parsedData.remainingDays,
                        paymentMethod: parsedData.paymentMethod,
                        timestamp: Date.now()
                      });
                    });
                  } else {
                    // Trigger 'batch:accessResult' event handlers
                    const handlers = eventHandlers['batch:accessResult'] || [];
                    handlers.forEach(handler => {
                      handler({
                        userId: data.userId,
                        results: [{
                          questionSetId: data.questionSetId,
                          hasAccess: parsedData.hasAccess,
                          remainingDays: parsedData.remainingDays,
                          paymentMethod: parsedData.paymentMethod,
                          timestamp: Date.now()
                        }]
                      });
                    });
                  }
                }, 200);
              }
            }
          }
        } catch (err) {
          console.error('[MockSocket] Error in simulated response:', err);
        }
      }
    },
    on: (event, callback) => {
      console.log(`[MockSocket] Registered listener for "${event}"`);
      
      // Store the callback to allow simulated responses
      if (!eventHandlers[event]) {
        eventHandlers[event] = [];
      }
      eventHandlers[event].push(callback);
    },
    off: (event, callback) => {
      console.log(`[MockSocket] Removed listener for "${event}"`);
      
      // Remove the callback if it exists
      if (eventHandlers[event]) {
        if (callback) {
          const index = eventHandlers[event].indexOf(callback);
          if (index !== -1) {
            eventHandlers[event].splice(index, 1);
          }
        } else {
          // If no callback specified, remove all handlers for this event
          delete eventHandlers[event];
        }
      }
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
  offlineMode: boolean;
}

// Create the context with default undefined value
const SocketContext = createContext<SocketContextType | undefined>(undefined);

export const SocketProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [socket, setSocket] = useState<Socket | MockSocket | null>(null);
  const [connected, setConnected] = useState(false);
  const [connectionAttempts, setConnectionAttempts] = useState(0);
  const [connectionFailed, setConnectionFailed] = useState(false);
  const [offlineMode, setOfflineMode] = useState(false);
  
  // Add refs to track current user details without depending on UserContext
  const currentUserIdRef = useRef<string | null>(null);
  const initializedRef = useRef(false);
  const maxAttempts = 3; // Reduce maximum connection attempts for faster fallback
  
  // Function to check if offline mode is preferred
  const checkOfflinePreference = useCallback(() => {
    try {
      return localStorage.getItem('preferOfflineMode') === 'true';
    } catch (e) {
      return false;
    }
  }, []);
  
  // Function to set offline mode preference
  const setOfflinePreference = useCallback((value: boolean) => {
    try {
      localStorage.setItem('preferOfflineMode', value ? 'true' : 'false');
      setOfflineMode(value);
    } catch (e) {
      console.error('[SocketContext] Error setting offline preference:', e);
    }
  }, []);
  
  // 在组件挂载时初始化Socket
  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;
    
    console.log('[SocketContext] 初始化Socket提供者');
    
    // First check if user prefers offline mode
    const preferOffline = checkOfflinePreference();
    if (preferOffline) {
      console.log('[SocketContext] User prefers offline mode, starting in offline mode');
      setConnectionFailed(true);
      setOfflineMode(true);
      setSocket(createMockSocket());
      return;
    }
    
    try {
      const socketInstance = initializeSocket();
      setSocket(socketInstance);
      
      // 监听连接状态
      const handleConnect = () => {
        console.log('[SocketContext] Socket已连接');
        setConnected(true);
        setConnectionAttempts(0); // Reset attempts on success
        setConnectionFailed(false);
        setOfflineMode(false);
      };
      
      const handleDisconnect = (reason: string) => {
        console.log(`[SocketContext] Socket已断开: ${reason}`);
        setConnected(false);
      };
      
      const handleConnectError = (error: any) => {
        console.error('[SocketContext] 连接错误:', error);
        
        // Check if it's an authentication error
        const isAuthError = error && (
          (typeof error === 'string' && error.includes('认证')) ||
          (error.message && error.message.includes('认证')) || 
          (error.message && error.message.includes('auth'))
        );
        
        if (isAuthError) {
          console.warn('[SocketContext] 认证错误，尝试获取新令牌');
          // Maybe trigger a re-login event?
        }
        
        setConnectionAttempts(prev => {
          const newAttempts = prev + 1;
          console.log(`[SocketContext] 连接尝试 ${newAttempts}/${maxAttempts}`);
          
          // If too many attempts, switch to mock socket
          if (newAttempts >= maxAttempts) {
            console.warn('[SocketContext] 达到最大尝试次数，切换到offline模式');
            setConnectionFailed(true);
            setOfflineMode(true);
            
            // Cleanup real socket
            socketInstance.off('connect', handleConnect);
            socketInstance.off('disconnect', handleDisconnect);
            socketInstance.off('connect_error', handleConnectError);
            closeSocket();
            
            // Switch to mock socket
            const mockSocket = createMockSocket();
            setSocket(mockSocket);
            
            // Show a notification to the user
            const offlineEvent = new CustomEvent('app:offlineMode', {
              detail: { reason: 'connection_failed' }
            });
            window.dispatchEvent(offlineEvent);
          }
          
          return newAttempts;
        });
      };
      
      // Also listen for the global connection failed event
      const handleGlobalConnectionFailed = () => {
        console.warn('[SocketContext] Received global connection failed event');
        setConnectionFailed(true);
        setOfflineMode(true);
        
        // Only create a new mock socket if we don't already have one
        if (!connectionFailed) {
          const mockSocket = createMockSocket();
          setSocket(mockSocket);
        }
      };
      
      socketInstance.on('connect', handleConnect);
      socketInstance.on('disconnect', handleDisconnect);
      socketInstance.on('connect_error', handleConnectError);
      window.addEventListener('socket:connectionFailed', handleGlobalConnectionFailed);
      
      // Try to initialize with existing token (now done in initializeSocket)
      if (isConnected()) {
        setConnected(true);
      }
      
      // 组件卸载时清理
      return () => {
        console.log('[SocketContext] 清理Socket提供者');
        
        window.removeEventListener('socket:connectionFailed', handleGlobalConnectionFailed);
        
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
      setOfflineMode(true);
      setSocket(createMockSocket());
      return () => {};
    }
  }, [checkOfflinePreference]);
  
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
          if (!connectionFailed && !offlineMode) {
            authenticateUser(userId, token);
          }
          console.log(`[SocketContext] 用户登录认证: ${userId}`);
        }
      } else if (type === 'logout') {
        if (!connectionFailed && !offlineMode) {
          deauthenticateSocket();
        }
        currentUserIdRef.current = null;
        console.log('[SocketContext] 用户登出，清除认证');
      }
    };
    
    // Also handle token expired event
    const handleTokenExpired = () => {
      console.warn('[SocketContext] Token expired, triggering reauth');
      // Could trigger a silent token refresh here
    };
    
    // Create a custom event for listening to user changes
    window.addEventListener('user:change', handleUserChange as EventListener);
    window.addEventListener('auth:tokenExpired', handleTokenExpired);
    
    return () => {
      window.removeEventListener('user:change', handleUserChange as EventListener);
      window.removeEventListener('auth:tokenExpired', handleTokenExpired);
    };
  }, [socket, connectionFailed, offlineMode]);
  
  // 监听全局Socket重置事件
  useEffect(() => {
    const handleSocketReset = (event: Event) => {
      if (!socket) return;
      
      const customEvent = event as CustomEvent<{userId?: string, token?: string}>;
      const { userId, token } = customEvent.detail || {};
      
      if (userId && token) {
        console.log(`[SocketContext] 收到Socket重置事件: 用户=${userId}`);
        currentUserIdRef.current = userId;
        
        if (!connectionFailed && !offlineMode) {
          authenticateUser(userId, token);
        }
      }
    };
    
    const handleSocketDisconnect = () => {
      if (!socket) return;
      console.log('[SocketContext] 收到Socket断开事件');
      
      if (!connectionFailed && !offlineMode) {
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
  }, [socket, connectionFailed, offlineMode]);
  
  // 提供重连方法
  const reconnect = useCallback(() => {
    if (!socket) return;
    
    console.log('[SocketContext] 手动重连Socket');
    
    // If using mock socket, try to reconnect with real socket
    if (connectionFailed || offlineMode) {
      try {
        setConnectionFailed(false);
        setOfflineMode(false);
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
        
        // Update offline preference
        setOfflinePreference(false);
        
        return;
      } catch (err) {
        console.error('[SocketContext] 重连失败:', err);
        setConnectionFailed(true);
        setOfflineMode(true);
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
  }, [socket, connectionFailed, offlineMode, setOfflinePreference]);
  
  // Allow manual switch to offline mode
  const toggleOfflineMode = useCallback((forceOffline?: boolean) => {
    const newValue = forceOffline !== undefined ? forceOffline : !offlineMode;
    
    if (newValue && !offlineMode) {
      // Switching to offline mode
      if (!connectionFailed) {
        if (socket) {
          if ('disconnect' in socket) {
            socket.disconnect();
          }
        }
        setConnectionFailed(true);
        setSocket(createMockSocket());
      }
      setOfflineMode(true);
      setOfflinePreference(true);
    } else if (!newValue && offlineMode) {
      // Switching to online mode
      reconnect();
    }
  }, [offlineMode, connectionFailed, socket, reconnect, setOfflinePreference]);
  
  // Add event listener for offline mode toggle
  useEffect(() => {
    const handleToggleOffline = (event: Event) => {
      const customEvent = event as CustomEvent<{forceOffline?: boolean}>;
      toggleOfflineMode(customEvent.detail?.forceOffline);
    };
    
    window.addEventListener('app:toggleOfflineMode', handleToggleOffline as EventListener);
    
    return () => {
      window.removeEventListener('app:toggleOfflineMode', handleToggleOffline as EventListener);
    };
  }, [toggleOfflineMode]);
  
  // Ensure value is memoized to prevent unnecessary re-renders
  const contextValue = {
    socket,
    connected,
    reconnect,
    connectionFailed,
    offlineMode
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