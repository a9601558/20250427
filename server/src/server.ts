import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { createServer } from 'http';
import { initializeSocket } from './config/socket';
import routes from './routes';
import { errorHandler } from './middleware/errorMiddleware';
import { sequelize } from './config/db';

const app = express();
const httpServer = createServer(app);

// 初始化Socket.IO
const io = initializeSocket(httpServer);

// 将io实例附加到app，以便在路由中使用
app.set('io', io);

// 中间件
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(helmet());
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 路由
app.use('/api', routes);

// 错误处理
app.use(errorHandler);

// 数据库同步
sequelize.sync({ alter: true }).then(() => {
  console.log('数据库已同步');
}).catch((error) => {
  console.error('数据库同步错误:', error);
});

// 启动服务器
const PORT = parseInt(process.env.PORT || '5000', 10);
httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`服务器运行在 0.0.0.0:${PORT}`);
});

// 添加服务器错误事件处理
httpServer.on('error', (error: any) => {
  if (error.code === 'EADDRINUSE') {
    console.error(`端口 ${PORT} 已被占用，请尝试其他端口`);
  } else {
    console.error('服务器错误:', error);
  }
  process.exit(1);
});

// 优雅关闭进程
process.on('SIGTERM', () => {
  console.log('SIGTERM 信号收到，优雅关闭中...');
  httpServer.close(() => {
    console.log('HTTP 服务器已关闭');
    sequelize.close().then(() => {
      console.log('数据库连接已关闭');
      process.exit(0);
    });
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT 信号收到，优雅关闭中...');
  httpServer.close(() => {
    console.log('HTTP 服务器已关闭');
    sequelize.close().then(() => {
      console.log('数据库连接已关闭');
      process.exit(0);
    });
  });
}); 