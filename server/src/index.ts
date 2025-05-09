import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import dotenv from 'dotenv';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import path from 'path';
import fs from 'fs';
import sequelize from './config/database';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { initializeSocket } from './config/socket';
import { setupAssociations } from './models/associations';
import { appState } from './utils/appstate';
import HomepageSettings from './models/HomepageSettings';
import { questionSetAttributes, purchaseAttributes } from './utils/sequelizeHelpers';
import { applyGlobalFieldMappings, testFieldMappings } from './utils/applyFieldMappings';
import { defaultHomepageSettings } from './config/defaultSettings';

// Load environment variables
dotenv.config();

// Import models to ensure they are initialized
import './models/User';
import './models/QuestionSet';
import './models/Question';
import './models/Option';
import './models/Purchase';
import './models/RedeemCode';
import './models/UserProgress';

// Import routes
import userRoutes from './routes/userRoutes';
import questionSetRoutes from './routes/questionSetRoutes';
import questionRoutes from './routes/questionRoutes';
import userProgressRoutes from './routes/userProgressRoutes';
import purchaseRoutes from './routes/purchaseRoutes';
import redeemCodeRoutes from './routes/redeemCodeRoutes';
import homepageRoutes from './routes/homepageRoutes';
import wrongAnswerRoutes from './routes/wrongAnswerRoutes';
import paymentRoutes from './routes/payment';

// Initialize express app
const app = express();
const PORT = process.env.PORT || 5000;

// 设置trust proxy为1，只信任第一级代理（通常是Nginx）
app.set('trust proxy', 1);

// Middleware
app.use(cors());
app.use(express.json());
app.use(morgan('dev'));
app.use(helmet());

// General rate limiting - more restrictive
const standardLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later'
});

// Less restrictive rate limiting for homepage content - needed for admin updates
const homepageLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 120, // much higher limit
  message: 'Too many homepage requests, please try again later'
});

// Apply rate limiters to specific routes
app.use('/api/homepage', homepageLimiter);
app.use('/api/question-sets', homepageLimiter);
app.use('/api', standardLimiter); // Apply standard limiter to all other API routes

// API routes
app.use('/api/users', userRoutes);
app.use('/api/question-sets', questionSetRoutes);
app.use('/api/questions', questionRoutes);
app.use('/api/user-progress', userProgressRoutes);
app.use('/api/purchases', purchaseRoutes);
app.use('/api/redeem-codes', redeemCodeRoutes);
app.use('/api/homepage', homepageRoutes);
app.use('/api/wrong-answers', wrongAnswerRoutes);
app.use('/api/payments', paymentRoutes);

// Error handling middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error(err.stack);
  res.status(500).json({
    success: false,
    message: '服务器内部错误',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// Start server
const server = createServer(app);

// 同步数据库并启动服务器
sequelize.sync({ alter: false }).then(() => {
  console.log('Database synced');
  
  // 初始化所有关联 - 现在所有关联都统一在 associations.ts 中管理
  setupAssociations();
  
  console.log('All associations initialized');
  appState.associationsInitialized = true;
  
  // 确保 HomepageSettings 表有初始数据
  return HomepageSettings.findOne();
}).then(settings => {
  if (!settings) {
    console.log('创建首页默认设置');
    return HomepageSettings.create(defaultHomepageSettings);
  }
  return settings;
}).then(() => {
  // 初始化 Socket.io
  const io = initializeSocket(server);
  console.log('Socket.io 初始化完成');
  
  // 启动 HTTP 服务器
  server.listen(PORT, () => {
    console.log(`服务器已启动, 端口: ${PORT}`);
  });
}).catch(err => {
  console.error('Error during server initialization:', err);
});

export default app; 