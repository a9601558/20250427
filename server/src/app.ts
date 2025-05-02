import express from 'express';
import cors from 'cors';
import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import helmet from 'helmet';
// @ts-ignore
import compression from 'compression';
import morgan from 'morgan';
import path from 'path';
import sequelize from './config/database';
import registerSocketHandlers from './socket/handlers';
import configureRoutes from './routes';
import { logger } from './utils/logger';

// 创建Express应用
const app = express();

// 配置中间件
app.use(cors());
// @ts-ignore
app.use(helmet({
  contentSecurityPolicy: false, // 如有需要，调整CSP设置
}));
// @ts-ignore
app.use(compression());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 开发环境下使用morgan日志
if (process.env.NODE_ENV !== 'production') {
  app.use(morgan('dev'));
}

// 注册API路由
configureRoutes(app);

// 配置静态文件服务
const staticPath = path.join(__dirname, '../../public');
app.use(express.static(staticPath));

// 创建HTTP服务器
const server = http.createServer(app);

// 设置Socket.IO
const io = new SocketIOServer(server, {
  cors: {
    origin: '*', // 生产环境中应设置为特定域名
    methods: ['GET', 'POST'],
  },
});

// 注册Socket处理程序
registerSocketHandlers(io);

// 处理根路径
app.get('/', (req, res) => {
  res.send('服务器正常运行');
});

// 捕获所有其他路由并返回静态文件
// 这允许前端使用客户端路由
app.get('*', (req, res) => {
  res.sendFile(path.join(staticPath, 'index.html'));
});

// 启动数据库同步（如果需要）
export const syncDatabase = async () => {
  try {
    await sequelize.sync({ alter: true });
    logger.info('数据库同步完成');
    return true;
  } catch (error) {
    logger.error('数据库同步失败:', error);
    return false;
  }
};

// 导出app和server
export default server; 