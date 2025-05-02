
// Sequelize Instance Recovery - 自动添加于 2025-05-02T10:30:00.514Z
// 这段代码确保Sequelize模型总是有有效的实例，即使在模块导入失败的情况下
(function() {
  try {
    // 修复空的sequelize实例
    if (typeof global.sequelize === 'undefined' && 
        (typeof sequelize === 'undefined' || !sequelize)) {
      const { Sequelize } = require('sequelize');
      const path = require('path');
      const fs = require('fs');
      const dotenv = require('dotenv');
      
      // 加载环境变量
      const envPath = path.join(process.cwd(), '.env');
      if (fs.existsSync(envPath)) {
        console.log('Recovery: 加载环境变量文件', envPath);
        dotenv.config({ path: envPath });
      }
      
      console.log('Recovery: 创建应急Sequelize实例');
      global.sequelize = new Sequelize(
        process.env.DB_NAME || 'quiz_app',
        process.env.DB_USER || 'root',
        process.env.DB_PASSWORD || '',
        {
          host: process.env.DB_HOST || 'localhost',
          port: parseInt(process.env.DB_PORT || '3306'),
          dialect: 'mysql',
          logging: false,
          pool: { max: 5, min: 0, acquire: 30000, idle: 10000 }
        }
      );
      
      // 设置全局变量，避免"未定义"错误
      if (typeof sequelize === 'undefined') {
        global.sequelize = global.sequelize;
      }
    }
  } catch (error) {
    console.error('Recovery: Sequelize恢复机制出错', error);
  }
})();
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const sequelize_1 = require("sequelize");
const dotenv_1 = __importDefault(require("dotenv"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const logger_1 = require("../utils/logger");
// 使用相对路径指向项目根目录的.env文件
const envPath = path_1.default.join(process.cwd(), '.env');
// 检查并加载 .env 文件
if (fs_1.default.existsSync(envPath)) {
    logger_1.logger.info(`加载环境变量文件: ${envPath}`);
    dotenv_1.default.config({ path: envPath });
}
else {
    logger_1.logger.warn(`警告: 环境变量文件不存在: ${envPath}`);
}
// 数据库配置
const dbConfig = {
    dialect: 'mysql',
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '3306'),
    username: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'quiz_app',
    logging: (msg) => logger_1.logger.debug(msg), // 使用logger进行日志记录
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
const sequelize = new sequelize_1.Sequelize(dbConfig.database, dbConfig.username, dbConfig.password, {
    host: dbConfig.host,
    port: dbConfig.port,
    dialect: dbConfig.dialect,
    logging: dbConfig.logging,
    pool: dbConfig.pool,
    dialectOptions: dbConfig.dialectOptions,
});
// 验证连接是否有效
let connectionVerified = false;
// 测试数据库连接
const testConnection = async () => {
    try {
        await sequelize.authenticate();
        connectionVerified = true;
        logger_1.logger.info('数据库连接成功！');
    }
    catch (error) {
        logger_1.logger.error('无法连接到数据库:', error);
        // 不要立即退出进程，以防止应用程序无法启动
        logger_1.logger.error('将尝试继续运行，但可能出现数据库相关的错误');
    }
};
// 立即测试连接
testConnection();
const databaseModule = sequelize;
// 添加检查方法
databaseModule.isValid = () => connectionVerified;
// 确保模块可以被CommonJS和ES模块系统同时使用
if (typeof module !== 'undefined' && module.exports) {
    module.exports = databaseModule;
    module.exports.default = databaseModule;
}
exports.default = databaseModule;
