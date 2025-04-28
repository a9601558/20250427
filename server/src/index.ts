import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import dotenv from 'dotenv';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import path from 'path';
import fs from 'fs';
import { sequelize, syncModels } from './models';
import { createServer } from 'http';
import { Server } from 'socket.io';

// Load environment variables
dotenv.config();

// Import database connection
import pool from './config/db';

// Import models to ensure they are initialized
import './models/HomepageSettings';

// Import routes (will create these next)
import userRoutes from './routes/userRoutes';
import questionSetRoutes from './routes/questionSetRoutes';
import questionRoutes from './routes/questionRoutes';
import purchaseRoutes from './routes/purchaseRoutes';
import redeemCodeRoutes from './routes/redeemCodeRoutes';
import homepageRoutes from './routes/homepageRoutes';
import userProgressRoutes from './routes/userProgressRoutes';

// Initialize express app
const app = express();
const PORT = process.env.PORT || 5000;

// 设置trust proxy，但使用具体的IP段或本地地址，避免信任所有代理
// 只信任本地反向代理和内网IP
app.set('trust proxy', ['loopback', 'linklocal', 'uniquelocal']);

// Create HTTP server
const httpServer = createServer(app);

// Initialize Socket.IO
const io = new Server(httpServer, {
  cors: {
    origin: '*', // 允许所有来源，也可以指定具体域名
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    credentials: true,
    allowedHeaders: ['Authorization', 'Content-Type']
  },
  transports: ['polling', 'websocket'], // 先尝试polling，然后尝试websocket
  connectTimeout: 30000, // 连接超时设置
  pingTimeout: 30000, // ping 超时设置
  pingInterval: 25000, // ping 间隔设置
  allowUpgrades: true, // 允许升级传输
  serveClient: false, // 不提供客户端文件
  maxHttpBufferSize: 1e8 // 最大 HTTP 缓冲区大小
});

// 添加中间件以记录所有连接相关事件
io.use((socket, next) => {
  console.log('Socket.IO 中间件处理连接:', socket.id);
  next();
});

// Socket.IO connection handling
io.on('connection', (socket) => {
  const clientIP = socket.handshake.headers['x-forwarded-for'] || socket.handshake.address;
  console.log(`Socket.IO 新连接: ID=${socket.id}, IP=${clientIP}, 传输方式=${socket.conn.transport.name}`);

  // 处理握手数据
  console.log('Socket.IO 握手信息:', {
    headers: socket.handshake.headers,
    query: socket.handshake.query,
    time: socket.handshake.time
  });

  // 用户认证
  socket.on('authenticate', (userId: string) => {
    console.log(`Socket.IO 用户认证: ID=${socket.id}, UserID=${userId}`);
    socket.join(`user:${userId}`);
    // 发送认证成功的确认
    socket.emit('authenticated', { userId, success: true });
  });

  // 断开连接
  socket.on('disconnect', (reason) => {
    console.log(`Socket.IO 断开连接: ID=${socket.id}, 原因=${reason}`);
  });

  // 错误处理
  socket.on('error', (error) => {
    console.error(`Socket.IO 错误: ID=${socket.id}`, error);
  });

  // 测试消息响应
  socket.on('message', (data) => {
    console.log(`Socket.IO 收到消息: ID=${socket.id}, 数据=`, data);
    // 回复消息，测试双向通信
    socket.emit('message', `服务器收到消息: ${data} (${new Date().toISOString()})`);
  });
});

// Export io instance for use in other files
export { io };

// Body parsing middleware
// 确保最先配置body解析中间件，防止请求体解析问题
app.use(express.json({ 
  limit: '100mb',
  verify: (req: express.Request, res: express.Response, buf: Buffer) => {
    try {
      JSON.parse(buf.toString());
    } catch (e: any) {
      console.error('JSON解析错误:', e.message);
      // 注意：verify函数中不能直接发送响应，会导致Express错误
      // 我们只记录错误，让Express的错误处理机制处理无效JSON
      req.body = { _jsonParseError: true, message: e.message };
    }
  }
}));

app.use(express.urlencoded({ 
  extended: true, 
  limit: '100mb'
}));

// 添加请求日志中间件
app.use((req, res, next) => {
  if (req.method === 'POST') {
    console.log(`收到POST请求: ${req.method} ${req.url}`);
    console.log('Content-Type:', req.headers['content-type']);
  }
  next();
});

// Security middleware
app.use(helmet());

// Rate limit configuration
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests per IP
  standardHeaders: true,
  // 配置IP提取方式，使用X-Forwarded-For，但限制标头数量
  keyGenerator: (req) => {
    // 通过X-Forwarded-For获取第一个IP（最可信的代理IP）
    const xForwardedFor = req.headers['x-forwarded-for'];
    const clientIp = Array.isArray(xForwardedFor) 
      ? xForwardedFor[0] 
      : (typeof xForwardedFor === 'string' ? xForwardedFor.split(',')[0].trim() : req.ip);
    
    // 确保返回一个字符串，避免undefined
    return clientIp || req.ip || 'unknown-ip';
  },
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
  // 配置IP提取方式，使用X-Forwarded-For，但限制标头数量
  keyGenerator: (req) => {
    // 通过X-Forwarded-For获取第一个IP（最可信的代理IP）
    const xForwardedFor = req.headers['x-forwarded-for'];
    const clientIp = Array.isArray(xForwardedFor) 
      ? xForwardedFor[0] 
      : (typeof xForwardedFor === 'string' ? xForwardedFor.split(',')[0].trim() : req.ip);
    
    // 确保返回一个字符串，避免undefined
    return clientIp || req.ip || 'unknown-ip';
  },
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
app.use(morgan('dev'));

// Serve static files
app.use(express.static(path.join(__dirname, '../public')));
app.use('/images', express.static(path.join(__dirname, '../public/images')));

// Apply global rate limit
app.use(generalLimiter);

// 在控制台输出一个清晰的分隔符
console.log('=========== API路由注册开始 ===========');

// Routes
app.use('/api/users/login', loginLimiter);
app.use('/api/users', userRoutes);
console.log('注册路由: /api/users, 包含登录和注册功能');

// QuestionSet路由处理所有题库相关的功能
console.log('注册路由: /api/question-sets');
app.use('/api/question-sets', questionSetRoutes);

// Question路由处理单个题目的增删改查
console.log('注册路由: /api/questions');
app.use('/api/questions', questionRoutes);

app.use('/api/purchases', purchaseRoutes);
app.use('/api/redeem-codes', redeemCodeRoutes);
app.use('/api/homepage', homepageRoutes);
app.use('/api/user-progress', userProgressRoutes);
console.log('注册路由: /api/user-progress, 处理用户进度');

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

// 同步数据库结构
const ensureDatabaseSync = async () => {
  try {
    console.log('正在同步数据库结构...');
    await syncModels();
    console.log('数据库同步完成');
    return true;
  } catch (error) {
    console.error('数据库同步失败:', error);
    // 不中断服务器启动，但记录错误
    return false;
  }
};

// 启动服务器
const startServer = async () => {
  try {
    // 尝试同步数据库
    await ensureDatabaseSync();
    
    // 使用httpServer替代app来启动服务器
    httpServer.listen({
      port: Number(PORT),
      host: '0.0.0.0'
    }, () => {
      console.log(`服务器运行在 http://0.0.0.0:${PORT}`);
      console.log(`Socket.IO 服务已启动`);
    });
  } catch (error) {
    console.error('服务器启动失败:', error);
    process.exit(1);
  }
};

// 启动服务器
startServer();

export default app; 