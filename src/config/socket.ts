import { io, Socket } from 'socket.io-client';
import { API_BASE_URL } from './constants';

// Track socket connection state
let socket: Socket | null = null;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 5;

// Socket configuration
const SOCKET_OPTIONS = {
  transports: ['websocket'],
  autoConnect: true,
  reconnection: true,
  reconnectionAttempts: MAX_RECONNECT_ATTEMPTS,
  reconnectionDelay: 1000
};

// 心跳检测定时器
let heartbeatInterval: NodeJS.Timeout | null = null;

// For progress tracking (if needed)
export interface ProgressData {
  userId: string;
  questionId?: string;
  questionSetId?: string;
  action: string;
  timestamp: number;
  data?: any;
}

/**
 * Initialize the socket connection
 * @returns The socket instance
 */
export const initializeSocket = (): Socket => {
  if (socket) {
    console.log('[socket] Socket already initialized');
    return socket;
  }

  try {
    // Reset reconnect attempts counter
    reconnectAttempts = 0;
    
    // Get token from local storage for auth
    const token = localStorage.getItem('token');
    
    // Add token to query params if available
    const socketOptions = {
      ...SOCKET_OPTIONS,
      query: token ? { token } : undefined
    };

    // Create socket instance
    console.log('[socket] Initializing socket connection');
    socket = io(API_BASE_URL, socketOptions);
    
    // Set auth if we have a token
    if (token) {
      socket.auth = { token };
      console.log('[socket] Set initial auth token');
    }

    // Setup error handling
    socket.on('connect_error', (err) => {
      console.error('[socket] Connection error:', err.message);
      reconnectAttempts++;
      
      // Check if it's an auth error and try to recover
      if (err.message.includes('auth') || err.message.includes('认证') || err.message.includes('unauthorized')) {
        console.warn('[socket] Authentication error detected');
        
        // Dispatch global event to notify app of token issues
        const tokenEvent = new CustomEvent('auth:tokenExpired');
        window.dispatchEvent(tokenEvent);
      }
      
      // If too many reconnection attempts, trigger connection failed event
      if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
        console.error(`[socket] Max reconnection attempts (${MAX_RECONNECT_ATTEMPTS}) reached`);
        
        // Dispatch global event for connection failure
        const connectionEvent = new CustomEvent('socket:connectionFailed');
        window.dispatchEvent(connectionEvent);
      }
    });

    // Reset attempts on successful connection
    socket.on('connect', () => {
      console.log('[socket] Connected');
      reconnectAttempts = 0;
      startHeartbeat();
    });

    // Clean up heartbeat when disconnected
    socket.on('disconnect', () => {
      console.log('[socket] Disconnected');
      stopHeartbeat();
    });

    return socket;
  } catch (err) {
    console.error('[socket] Failed to initialize socket:', err);
    
    // Dispatch connection failed event
    const event = new CustomEvent('socket:connectionFailed');
    window.dispatchEvent(event);
    
    throw err;
  }
};

/**
 * Authenticate the socket connection with user credentials
 * @param userId The user ID
 * @param token The authentication token
 */
export const authenticateUser = (userId: string, token: string): void => {
  if (!socket) {
    console.warn('[socket] Socket not initialized, cannot authenticate');
    return;
  }

  if (!userId || !token) {
    console.warn('[socket] Missing userId or token for authentication');
    return;
  }

  try {
    // Set auth data on socket
    socket.auth = { token };
    
    console.log(`[socket] Authenticating user: ${userId}`);
    
    // If already connected, update auth immediately
    if (socket.connected) {
      socket.emit('authenticate', { userId, token });
    } else {
      // Will use auth data when it connects
      socket.connect();
    }
  } catch (err) {
    console.error('[socket] Failed to authenticate user:', err);
  }
};

/**
 * Remove authentication from socket
 */
export const deauthenticateSocket = (): void => {
  if (!socket) {
    return;
  }

  try {
    console.log('[socket] Deauthenticating socket');
    socket.auth = {}; // Clear auth data
    socket.emit('logout');
  } catch (err) {
    console.error('[socket] Failed to deauthenticate socket:', err);
  }
};

/**
 * Close the socket connection
 */
export const closeSocket = (): void => {
  if (!socket) {
    return;
  }

  try {
    console.log('[socket] Closing socket connection');
    stopHeartbeat();
    socket.disconnect();
    socket = null;
  } catch (err) {
    console.error('[socket] Failed to close socket:', err);
  }
};

/**
 * Start sending heartbeat messages to keep the connection alive
 */
export const startHeartbeat = (): void => {
  if (!socket || heartbeatInterval) {
    return;
  }

  heartbeatInterval = setInterval(() => {
    if (socket && socket.connected) {
      socket.emit('heartbeat', { timestamp: Date.now() });
    }
  }, 30000); // Send heartbeat every 30 seconds
};

/**
 * Stop sending heartbeat messages
 */
export const stopHeartbeat = (): void => {
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval);
    heartbeatInterval = null;
  }
};

/**
 * Check if the socket is connected
 */
export const isConnected = (): boolean => {
  return socket?.connected || false;
};

/**
 * Attempt to reconnect the socket
 */
export const attemptReconnect = (): void => {
  if (!socket) {
    initializeSocket();
    return;
  }

  if (!socket.connected) {
    console.log('[socket] Attempting to reconnect');
    reconnectAttempts = 0; // Reset counter on manual reconnect
    socket.connect();
  }
};

/**
 * Send progress update via socket
 */
export const sendProgressUpdate = (data: ProgressData): void => {
  if (socket && socket.connected) {
    socket.emit('progress:update', data);
  } else {
    console.warn('[socket] Cannot send progress update: Socket not connected');
  }
};

/**
 * Listen for progress updates
 */
export const onProgressUpdate = (callback: (data: ProgressData) => void): void => {
  if (socket) {
    socket.on('progress:update', callback);
  }
};

/**
 * Test the socket connection
 */
export const testConnection = (): void => {
  if (socket) {
    socket.emit('test', { message: 'Testing connection' });
  }
};

export default socket; 