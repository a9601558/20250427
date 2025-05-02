import { Sequelize, Dialect } from 'sequelize';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { logger } from '../utils/logger';

// 使用相对路径指向项目根目录的.env文件
const envPath = path.join(process.cwd(), '.env');

// 检查并加载 .env 文件
if (fs.existsSync(envPath)) {
  logger.info(`加载环境变量文件: ${envPath}`);
  dotenv.config({ path: envPath });
} else {
  logger.warn(`警告: 环境变量文件不存在: ${envPath}`);
}

// 数据库配置
const dbConfig = {
  dialect: 'mysql' as Dialect,
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '3306'),
  username: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'quiz_app',
  logging: (msg: string) => logger.debug(msg), // 使用logger进行日志记录
  pool: {
    max: 5,
    min: 0,
    acquire: 30000,
    idle: 10000,
  },
  dialectOptions: {
    connectTimeout: 10000, // 10 秒连接超时
  },
};

// 创建 Sequelize 实例 - 修复初始化参数
const sequelize = new Sequelize(
  dbConfig.database,
  dbConfig.username,
  dbConfig.password,
  {
    host: dbConfig.host,
    port: dbConfig.port,
    dialect: dbConfig.dialect,
    logging: dbConfig.logging,
    pool: dbConfig.pool,
    dialectOptions: dbConfig.dialectOptions,
  }
);

// 验证连接是否有效
let connectionVerified = false;

// 测试数据库连接
const testConnection = async () => {
  try {
    await sequelize.authenticate();
    connectionVerified = true;
    logger.info('数据库连接成功！');
  } catch (error) {
    logger.error('无法连接到数据库:', error);
    // 不要立即退出进程，以防止应用程序无法启动
    logger.error('将尝试继续运行，但可能出现数据库相关的错误');
  }
};

// 立即测试连接
testConnection();

// 为兼容CommonJS和ES模块，确保导出格式正确
type ExtendedSequelize = Sequelize & { 
  isValid: () => boolean 
};

const databaseModule = sequelize as ExtendedSequelize;

// 添加检查方法
databaseModule.isValid = () => connectionVerified;

// 确保模块可以被CommonJS和ES模块系统同时使用
if (typeof module !== 'undefined' && module.exports) {
  module.exports = databaseModule;
  module.exports.default = databaseModule;
}

export default databaseModule; 
