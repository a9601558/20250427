import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import dotenv from 'dotenv';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import path from 'path';
import fs from 'fs';

// Load environment variables
dotenv.config();

// Import database connection
import pool, { sequelize } from './config/db';

// Import models to ensure they are initialized
import { syncModels } from './models';
import './models/HomepageSettings';

// Import routes (will create these next)
import userRoutes from './routes/userRoutes';
import questionSetRoutes from './routes/questionSetRoutes';
import purchaseRoutes from './routes/purchaseRoutes';
import redeemCodeRoutes from './routes/redeemCodeRoutes';
import homepageRoutes from './routes/homepageRoutes';

// Initialize express app
const app = express();
const PORT = process.env.PORT || 5000;

// Security middleware
app.use(helmet());

// Rate limit configuration
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests per IP
  standardHeaders: true,
  message: {
    success: false,
    message: '请求过于频繁，请稍后再试'
  }
});

// Login attempt limit
const loginLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // 10 login attempts per IP
  standardHeaders: true,
  message: {
    success: false,
    message: '登录尝试次数过多，请稍后再试'
  }
});

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}));
app.use(express.json({ limit: '50mb' }));
app.use(morgan('dev'));

// Serve static files
app.use(express.static(path.join(__dirname, '../public')));
app.use('/images', express.static(path.join(__dirname, '../public/images')));

// Apply global rate limit
app.use(generalLimiter);

// 在控制台输出一个清晰的分隔符
console.log('=========== API路由注册开始 ===========');

// Routes
app.use('/api/users/login', loginLimiter); // Login route extra restriction
app.use('/api/users', userRoutes);

// QuestionSet路由处理所有题库相关的功能
console.log('注册路由: /api/question-sets');
app.use('/api/question-sets', questionSetRoutes);

app.use('/api/purchases', purchaseRoutes);
app.use('/api/redeem-codes', redeemCodeRoutes);
app.use('/api/homepage', homepageRoutes);

console.log('=========== API路由注册结束 ===========');

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}
app.use('/uploads', express.static(uploadsDir));

// Base route
app.get('/', (req, res) => {
  res.json({ message: '欢迎使用在线考试练习系统API' });
});

// 健康检查端点
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    message: '系统正常运行',
    timestamp: new Date().toISOString()
  });
});

// 404 handler
app.use((req, res, next) => {
  console.error(`找不到路径 - ${req.originalUrl}`); // 添加错误日志
  res.status(404).json({
    success: false,
    message: `找不到路径 - ${req.originalUrl}`
  });
});

// Error handling middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('服务器错误:', err.stack);
  
  const statusCode = err.statusCode || 500;
  const message = err.message || '服务器内部错误';
  
  res.status(statusCode).json({
    success: false,
    message,
    error: process.env.NODE_ENV === 'development' ? err.stack : undefined
  });
});

// 同步数据库模型，然后启动服务器
(async () => {
  try {
    console.log('开始同步数据库模型...');
    await syncModels();
    console.log('数据库模型同步完成');
    
    // Start server
    app.listen(PORT, () => {
      console.log(`服务器以 ${process.env.NODE_ENV} 模式运行，端口 ${PORT}`);
    });
  } catch (error) {
    console.error('服务器启动失败:', error);
  }
})();

export default app; 