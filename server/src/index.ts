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
import { questionSetAttributes, purchaseAttributes } from './utils/sequelizeHelpers';
import { applyGlobalFieldMappings, testFieldMappings } from './utils/applyFieldMappings';
import { Sequelize } from 'sequelize';
import { validateDatabaseConnection } from './utils/database-validator';
import { logger } from './utils/logger';

// 确保在一开始就加载环境变量
const envPath = path.join(process.cwd(), '.env');
if (fs.existsSync(envPath)) {
  logger.info(`加载环境变量文件: ${envPath}`);
  dotenv.config({ path: envPath });
} else {
  logger.warn(`警告: 环境变量文件不存在: ${envPath}`);
}

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
  max: 100, // limit each IP to 100 requests per windowMs
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

// Error handling middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error(err.stack);
  res.status(500).json({
    success: false,
    message: '服务器内部错误',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined,
  });
});

// Start server
const server = createServer(app);

// Initialize socket
initializeSocket(server);

// 初始化模型关联
console.log('正在初始化模型关联...');
setupAssociations();
appState.associationsInitialized = true;
console.log('模型关联初始化完成');

// 应用字段映射修复
applyGlobalFieldMappings();

// 启动验证和主程序
async function bootstrap() {
  try {
    // 首先验证数据库连接
    logger.info('正在验证数据库连接...');
    const isDbValid = await validateDatabaseConnection();
    
    if (!isDbValid) {
      logger.error('数据库连接验证失败，尝试使用紧急恢复措施...');
      // 尝试应急措施，但继续启动应用
    } else {
      logger.info('数据库连接验证成功！');
    }
    
    // 在验证之后导入主应用，确保数据库已准备就绪
    const { default: server, syncDatabase } = await import('./app');
    
    // 同步数据库
    await syncDatabase();
    
    // 获取PORT
    const PORT = process.env.PORT || 3001;
    
    // 启动服务器
    server.listen(PORT, () => {
      logger.info(`服务器在端口 ${PORT} 上运行`);
    });
    
    // 处理未捕获的异常
    process.on('uncaughtException', (err) => {
      logger.error('未捕获的异常:', err);
    });
    
    // 处理未处理的Promise拒绝
    process.on('unhandledRejection', (reason) => {
      logger.error('未处理的Promise拒绝:', reason);
    });
    
    // 确保 HomepageSettings 表有初始数据
    const homepageSettingsModule = await import('./models/HomepageSettings');
    const HomepageSettings = homepageSettingsModule.default;
    
    const settingsCount = await HomepageSettings.count();
    
    if (settingsCount === 0) {
      logger.info('创建默认首页设置...');
      await HomepageSettings.create({
        featuredCategories: [],
        siteTitle: '考试平台',
        welcomeMessage: '欢迎使用我们的考试平台！',
        footerText: '© 2024 考试平台 版权所有',
      });
    }
    
    // 导出server实例以便测试
    return server;
  } catch (error) {
    logger.error('服务器启动失败:', error);
    process.exit(1);
  }
}

// 启动应用
bootstrap().catch(err => {
  logger.error('启动过程中出错:', err);
  process.exit(1);
});

export default app; 
