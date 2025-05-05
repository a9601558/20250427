import { Server as HttpServer } from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';
import { DefaultEventsMap } from 'socket.io/dist/typed-events';
import { IProgressSummary } from '../types';
import logger from '../utils/logger';
import { registerUserAccessHandlers } from './userAccessHandlers';

// Store a reference to the IO server
let io: SocketIOServer<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>;

// Initialize Socket.IO
export const initializeSocket = (server: HttpServer) => {
  io = new SocketIOServer(server, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST']
    }
  });

  io.on('connection', (socket: Socket) => {
    logger.info(`Client connected: ${socket.id}`);

    // Handle authentication
    socket.on('auth:login', (data: { userId: string }) => {
      if (data.userId) {
        socket.join(`user_${data.userId}`);
        logger.info(`User ${data.userId} authenticated`);
      }
    });

    // Register user access handlers
    registerUserAccessHandlers(socket);

    // Handle existing events...
    socket.on('questionSet:checkAccessBatch', async (data) => {
      // ... existing code
    });

    socket.on('questionSet:checkAccess', async (data) => {
      // ... existing code
    });

    socket.on('questionSet:accessUpdate', (data) => {
      // ... existing code
    });

    socket.on('progress:update', (data) => {
      // ... existing code
    });

    socket.on('disconnect', () => {
      logger.info(`Client disconnected: ${socket.id}`);
    });
  });

  return io;
};

// Get IO instance
export const getIO = () => {
  if (!io) {
    throw new Error('Socket.IO not initialized');
  }
  return io;
};

// Add this alias for backward compatibility
export const getSocketIO = getIO; 