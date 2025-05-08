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
import { setupAssociations as setupRedeemCodeAssociations } from './models/RedeemCode';
import { appState } from './utils/appstate';
import HomepageSettings from './models/HomepageSettings';
import { questionSetAttributes, purchaseAttributes } from './utils/sequelizeHelpers';
import { applyGlobalFieldMappings, testFieldMappings } from './utils/applyFieldMappings';

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

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});
app.use(limiter);

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
  
  // 显式初始化所有关联
  setupAssociations();
  
  // 确保 RedeemCode 的关联被正确设置
  setupRedeemCodeAssociations();
  
  console.log('All associations initialized');
  appState.associationsInitialized = true;
  
  // 确保 HomepageSettings 表有初始数据
  return HomepageSettings.findOne();
}).then(settings => {
  if (!settings) {
    console.log('创建首页默认设置');
    return HomepageSettings.create({
      welcomeTitle: "ExamTopics 模拟练习",
      welcomeDescription: "选择以下任一题库开始练习，测试您的知识水平",
      featuredCategories: ["网络协议", "编程语言", "计算机基础"],
      announcements: "欢迎使用在线题库系统，新增题库将定期更新，请持续关注！",
      footerText: "© 2023 ExamTopics 在线题库系统 保留所有权利"
    });
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