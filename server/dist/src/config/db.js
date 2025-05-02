'use strict';

/**
 * 自动创建的数据库配置备份
 * 生成时间: 2025-05-02T10:36:55.666Z
 */

const { Sequelize } = require('sequelize');
const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');

// 加载环境变量
const envPath = path.join(process.cwd(), '.env');
if (fs.existsSync(envPath)) {
  console.log(`加载环境变量文件: ${envPath}`);
  dotenv.config({ path: envPath });
}

// 创建Sequelize实例
const sequelize = new Sequelize(
  process.env.DB_NAME || 'quiz_app',
  process.env.DB_USER || 'root',
  process.env.DB_PASSWORD || '',
  {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '3306'),
    dialect: 'mysql',
    logging: console.log,
    pool: {
      max: 5,
      min: 0,
      acquire: 30000,
      idle: 10000
    },
    dialectOptions: {
      connectTimeout: 10000
    }
  }
);

// 提供模块导出
module.exports = sequelize;
module.exports.default = sequelize;
