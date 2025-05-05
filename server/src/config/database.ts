import { Sequelize, Options } from 'sequelize';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

// Load environment variables from .env file
const envPath = path.resolve(__dirname, '../../.env');
if (fs.existsSync(envPath)) {
  console.log('加载环境变量文件:', envPath);
  dotenv.config({ path: envPath });
} else {
  console.log('未找到.env文件，使用默认配置');
  dotenv.config();
}

// Database configuration with fallbacks
const DB_HOST = process.env.DB_HOST || 'localhost';
const DB_PORT = parseInt(process.env.DB_PORT || '3306', 10);
const DB_NAME = process.env.DB_NAME || 'quiz_app';
const DB_USER = process.env.DB_USER || 'root'; // Default to root
const DB_PASSWORD = process.env.DB_PASSWORD || ''; // Default to empty password

console.log(`数据库连接信息: ${DB_HOST}:${DB_PORT}/${DB_NAME} (用户: ${DB_USER})`);

// Configure Sequelize
const sequelizeOptions: Options = {
  host: DB_HOST,
  port: DB_PORT,
  dialect: 'mysql',
  logging: process.env.NODE_ENV === 'development' ? console.log : false,
  timezone: '+08:00',
  define: {
    charset: 'utf8mb4',
    collate: 'utf8mb4_unicode_ci',
    timestamps: true,
  },
  pool: {
    max: 20,
    min: 0,
    acquire: 60000,
    idle: 10000
  }
};

// Handle connection errors gracefully
const sequelize = new Sequelize(
  DB_NAME,
  DB_USER,
  DB_PASSWORD,
  sequelizeOptions
);

// Test the connection
sequelize.authenticate()
  .then(() => {
    console.log('数据库连接成功!');
  })
  .catch(err => {
    console.error('数据库连接失败:', err);
    // Continue execution to allow for error handling in routes
  });

export default sequelize; 