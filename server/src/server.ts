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
app.use(cors());
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
const PORT = process.env.PORT || 5000;
httpServer.listen(PORT, () => {
  console.log(`服务器运行在端口 ${PORT}`);
}); 