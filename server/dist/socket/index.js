"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSocketIO = exports.getIO = exports.initializeSocket = void 0;
const socket_io_1 = require("socket.io");
const logger_1 = __importDefault(require("../utils/logger"));
const userAccessHandlers_1 = require("./userAccessHandlers");
// Store a reference to the IO server
let io;
// Initialize Socket.IO
const initializeSocket = (server) => {
    io = new socket_io_1.Server(server, {
        cors: {
            origin: '*',
            methods: ['GET', 'POST']
        }
    });
    io.on('connection', (socket) => {
        logger_1.default.info(`Client connected: ${socket.id}`);
        // Handle authentication
        socket.on('auth:login', (data) => {
            if (data.userId) {
                socket.join(`user_${data.userId}`);
                logger_1.default.info(`User ${data.userId} authenticated`);
            }
        });
        // Register user access handlers
        (0, userAccessHandlers_1.registerUserAccessHandlers)(socket);
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
            logger_1.default.info(`Client disconnected: ${socket.id}`);
        });
    });
    return io;
};
exports.initializeSocket = initializeSocket;
// Get IO instance
const getIO = () => {
    if (!io) {
        throw new Error('Socket.IO not initialized');
    }
    return io;
};
exports.getIO = getIO;
// Add this alias for backward compatibility
exports.getSocketIO = exports.getIO;
