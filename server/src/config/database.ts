import { Sequelize, Dialect } from 'sequelize';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

// 使用相对路径指向项目根目录的.env文件
const envPath = path.join(process.cwd(), '.env');

// 检查并加载 .env 文件
if (fs.existsSync(envPath)) {
  console.log(`加载环境变量文件: ${envPath}`);
  dotenv.config({ path: envPath });
} else {
  console.warn(`警告: 环境变量文件不存在: ${envPath}`);
}

// 数据库配置
const dbConfig = {
  dialect: 'mysql' as Dialect,
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '3306'),
  username: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'quiz_app',
  logging: console.log, // 启用日志以便调试
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

// 测试数据库连接
const testConnection = async () => {
  try {
    await sequelize.authenticate();
    console.log('数据库连接成功！');
  } catch (error) {
    console.error('无法连接到数据库:', error);
    // 不要立即退出进程，以防止应用程序无法启动
    console.error('将尝试继续运行，但可能出现数据库相关的错误');
  }
};

// 立即测试连接
testConnection();

// 为了兼容性，同时支持 CommonJS 和 ES Module
// @ts-ignore
if (typeof module !== 'undefined') {
  // @ts-ignore
  module.exports = sequelize;
  // @ts-ignore
  module.exports.default = sequelize;
}

export default sequelize; 
