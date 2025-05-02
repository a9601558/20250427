#!/usr/bin/env node

/**
 * 简化启动脚本 - 绕过路由问题直接启动应用
 * 
 * 此脚本绕过了有问题的路由，直接初始化应用核心部分
 * 使数据库连接和基本功能正常工作
 */

// 设置全局Sequelize实例
global.sequelize = null;
const { Sequelize } = require('sequelize');
const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');
const express = require('express');
const cors = require('cors');

// 加载环境变量
const envPath = path.join(process.cwd(), '.env');
if (fs.existsSync(envPath)) {
  console.log(`加载环境变量文件: ${envPath}`);
  dotenv.config({ path: envPath });
}

// 创建全局sequelize实例
global.sequelize = new Sequelize(
  process.env.DB_NAME || 'quiz_app',
  process.env.DB_USER || 'root',
  process.env.DB_PASSWORD || '',
  {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '3306'),
    dialect: 'mysql',
    logging: console.log,
    pool: { max: 5, min: 0, acquire: 30000, idle: 10000 }
  }
);

console.log('全局Sequelize实例创建成功');

// 创建Express应用
const app = express();

// 基本中间件
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 创建测试路由
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: '服务器已启动 - 简化模式',
    version: '1.0.0',
    time: new Date().toISOString()
  });
});

// 测试数据库连接
app.get('/api/test-db', async (req, res) => {
  try {
    await global.sequelize.authenticate();
    res.json({
      success: true,
      message: '数据库连接成功',
      dialect: global.sequelize.getDialect(),
      config: {
        host: global.sequelize.config.host,
        port: global.sequelize.config.port,
        database: global.sequelize.config.database
      }
    });
  } catch (error) {
    console.error('数据库连接失败:', error);
    res.status(500).json({
      success: false,
      message: '数据库连接失败',
      error: error.message
    });
  }
});

// 启动服务器
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`简化模式服务器已启动，运行端口: ${PORT}`);
});

// 处理未捕获的异常
process.on('uncaughtException', (err) => {
  console.error('未捕获的异常:', err);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('未处理的拒绝:', reason);
});

console.log('简化启动脚本已成功执行'); 