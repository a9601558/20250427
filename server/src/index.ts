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
import errorMiddleware from './middleware/errorMiddleware';
import { DataTypes, Sequelize } from 'sequelize';

// Load environment variables
const envPath = path.resolve(__dirname, '../.env');
if (fs.existsSync(envPath)) {
  console.log('加载环境变量文件:', envPath);
  dotenv.config({ path: envPath });
} else {
  console.log('未找到.env文件，使用默认环境变量');
  dotenv.config();
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
import quizRoutes from './routes/quizRoutes';

// Initialize express app
const app = express();
const PORT = process.env.PORT || 5000;

// 设置trust proxy为1，只信任第一级代理（通常是Nginx）
app.set('trust proxy', 1);

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
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
app.use('/api/quiz', quizRoutes);

// 添加路由别名，解决旧路径问题
app.use('/api/progress', userProgressRoutes);
// 添加别名路由 /api/users/:userId/progress
app.use('/api/users/:userId/progress', (req, res, next) => {
  // 将请求转发到 /api/user-progress/:userId
  req.url = '/' + req.params.userId;
  userProgressRoutes(req, res, next);
});

// Error handling middleware
app.use(errorMiddleware);

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

// 同步数据库并启动服务器
// 修改: 禁用自动 alter 选项，避免"Too many keys"错误
const syncOptions = {
  alter: process.env.NODE_ENV === 'development' && process.env.DB_ALTER === 'true'
};

console.log(`数据库同步选项: ${JSON.stringify(syncOptions)}`);

const startServer = async () => {
  try {
    // Test database connection
    await sequelize.authenticate();
    console.log('数据库连接成功!');
    
    // Run migrations first if in production
    if (process.env.NODE_ENV === 'production' || process.env.DB_MIGRATE === 'true') {
      console.log('正在运行数据库迁移脚本...');
      try {
        // Check if Sequelize CLI is available
        const { exec } = require('child_process');
        exec('npx sequelize-cli db:migrate', (error: any, stdout: string, stderr: string) => {
          if (error) {
            console.error('迁移脚本执行错误:', error);
            console.error('尝试使用内部迁移脚本...');
          } else {
            console.log('迁移脚本执行输出:', stdout);
            if (stderr) console.error('迁移脚本错误输出:', stderr);
          }
        });
      } catch (migrationError) {
        console.error('迁移流程错误:', migrationError);
      }
    }
    
    // Sync database models if needed
    if (process.env.DB_SYNC === 'true') {
      await sequelize.sync(syncOptions);
      console.log('数据库模型同步完成');
    }
  
    // 确保 HomepageSettings 表有初始数据
    try {
      const tableExists = await sequelize.getQueryInterface().showAllTables()
        .then(tables => tables.includes('homepage_settings'));
    
      if (!tableExists) {
        console.log('homepage_settings表不存在，正在创建...');
        await sequelize.getQueryInterface().createTable('homepage_settings', {
          id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true,
            allowNull: false
          },
          welcome_title: {
            type: DataTypes.STRING(255),
            allowNull: false,
            defaultValue: 'ExamTopics Practice'
          },
          welcome_description: {
            type: DataTypes.TEXT,
            allowNull: false,
            defaultValue: 'Choose any of the following question sets to practice and test your knowledge'
          },
          featured_categories: {
            type: DataTypes.TEXT,
            allowNull: true,
            defaultValue: JSON.stringify(['Network Protocols', 'Programming Languages', 'Computer Basics'])
          },
          announcements: {
            type: DataTypes.TEXT,
            allowNull: true,
            defaultValue: 'Welcome to the online quiz system. New question sets will be updated regularly!'
          },
          footer_text: {
            type: DataTypes.STRING(255),
            allowNull: true,
            defaultValue: '© 2023 ExamTopics Online Quiz System. All rights reserved.'
          },
          banner_image: {
            type: DataTypes.STRING(255),
            allowNull: true,
            defaultValue: '/images/banner.jpg'
          },
          theme: {
            type: DataTypes.STRING(50),
            allowNull: true,
            defaultValue: 'light'
          },
          created_at: {
            type: DataTypes.DATE,
            allowNull: false,
            defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
          },
          updated_at: {
            type: DataTypes.DATE,
            allowNull: false,
            defaultValue: Sequelize.literal('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP')
          }
        });
        
        // Insert initial record
        await sequelize.getQueryInterface().bulkInsert('homepage_settings', [{
          id: 1,
          welcome_title: "ExamTopics 模拟练习",
          welcome_description: "选择以下任一题库开始练习，测试您的知识水平",
          featured_categories: JSON.stringify(["网络协议", "编程语言", "计算机基础"]),
          announcements: "欢迎使用在线题库系统，新增题库将定期更新，请持续关注！",
          footer_text: "© 2023 ExamTopics 在线题库系统 保留所有权利",
          banner_image: "/images/banner.jpg",
          theme: 'light',
          created_at: new Date(),
          updated_at: new Date()
        }]);
        
        console.log('homepage_settings表创建并初始化完成');
      }

      HomepageSettings.findByPk(1).then((homepageSettings: HomepageSettings | null) => {
        if (!homepageSettings) {
          console.log('创建 HomepageSettings 初始数据...');
          return HomepageSettings.create({
            id: 1,
            welcome_title: "ExamTopics 模拟练习",
            welcome_description: "选择以下任一题库开始练习，测试您的知识水平",
            featured_categories: ["网络协议", "编程语言", "计算机基础"],
            announcements: "欢迎使用在线题库系统，新增题库将定期更新，请持续关注！",
            footer_text: "© 2023 ExamTopics 在线题库系统 保留所有权利",
            banner_image: "/images/banner.jpg",
            theme: 'light'
          });
        }
      }).then(() => {
        server.listen(PORT, () => {
          console.log(`Server is running on port ${PORT}`);
        });
      }).catch(error => {
        console.error('HomepageSettings初始化错误:', error);
        // 即使初始化HomepageSettings失败，仍然启动服务器
        server.listen(PORT, () => {
          console.log(`Server is running on port ${PORT} (degraded mode)`);
        });
      });
    } catch (error) {
      console.error('检查HomepageSettings表时出错:', error);
      // 启动服务器，即使HomepageSettings表检查失败
      server.listen(PORT, () => {
        console.log(`Server is running on port ${PORT} (degraded mode)`);
      });
    }
  } catch (error) {
    console.error('服务器启动失败:', error);
    
    // Continue running the server even if database connection fails
    // This allows routes to handle errors gracefully
    server.listen(PORT, () => {
      console.log(`服务器运行在降级模式下 http://localhost:${PORT} (数据库连接失败)`);
      console.log('请运行 node src/scripts/setup-database.js 获取数据库设置帮助');
    });
    
    // Initialize Socket.IO in degraded mode
    initializeSocket(server, true);
  }
};

// Start the server
startServer();

// 添加进程异常处理，防止因数据库错误导致整个应用崩溃
process.on('uncaughtException', (error) => {
  console.error('未捕获的异常:', error);
  // 不要终止进程，让应用继续运行
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('未处理的Promise拒绝:', reason);
  // 不要终止进程，让应用继续运行
});

export default app; 