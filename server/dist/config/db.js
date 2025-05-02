'use strict';

/**
 * 兼容性数据库配置文件
 * 自动生成于 2025-05-02T10:10:49.707Z
 */
const { Sequelize } = require('sequelize');
const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');

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
  dialect: 'mysql',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '3306'),
  username: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'quiz_app',
  logging: console.log,
  pool: {
    max: 5,
    min: 0,
    acquire: 30000,
    idle: 10000
  },
  dialectOptions: {
    connectTimeout: 10000,
  }
};

// 创建 Sequelize 实例
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
    dialectOptions: dbConfig.dialectOptions
  }
);

// 导出 Sequelize 实例
module.exports = sequelize;
