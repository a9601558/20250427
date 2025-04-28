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
    idle: 10000
  },
  dialectOptions: {
    connectTimeout: 10000, // 10 秒连接超时
  }
};

// 创建 Sequelize 实例
const sequelize = new Sequelize(dbConfig);

// 测试数据库连接
const testConnection = async () => {
  try {
    await sequelize.authenticate();
    console.log('数据库连接成功！');
  } catch (error) {
    console.error('无法连接到数据库:', error);
    process.exit(1); // 如果无法连接，退出进程
  }
};

// 立即测试连接
testConnection();

export default sequelize; 