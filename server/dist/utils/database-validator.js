
// Sequelize Instance Recovery - 自动添加于 2025-05-02T10:30:00.532Z
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
exports.createEmergencyInstance = exports.validateDatabaseConnection = void 0;
const sequelize_1 = require("sequelize");
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const dotenv_1 = __importDefault(require("dotenv"));
const logger_1 = require("./logger");
/**
 * 数据库连接验证器
 *
 * 这个模块负责:
 * 1. 验证数据库连接
 * 2. 尝试修复常见的连接问题
 * 3. 确保所有模型都有有效的Sequelize实例
 */
// 确保环境变量已加载
const loadEnv = () => {
    const envPath = path_1.default.join(process.cwd(), '.env');
    if (fs_1.default.existsSync(envPath)) {
        logger_1.logger.info(`从验证器加载环境变量: ${envPath}`);
        dotenv_1.default.config({ path: envPath });
        return true;
    }
    return false;
};
// 创建紧急Sequelize实例
const createEmergencySequelize = () => {
    loadEnv();
    logger_1.logger.info('创建紧急Sequelize实例');
    return new sequelize_1.Sequelize(process.env.DB_NAME || 'quiz_app', process.env.DB_USER || 'root', process.env.DB_PASSWORD || '', {
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
    });
};
// 验证并获取有效的Sequelize实例
const getValidSequelize = async () => {
    try {
        // 尝试从标准位置导入
        const databaseModule = require('../config/database');
        const sequelize = databaseModule.default || databaseModule;
        // 验证实例
        if (sequelize && typeof sequelize.authenticate === 'function') {
            try {
                await sequelize.authenticate();
                logger_1.logger.info('已验证现有Sequelize实例');
                return sequelize;
            }
            catch (error) {
                logger_1.logger.error('现有Sequelize实例认证失败:', error);
            }
        }
        // 实例无效，尝试创建新实例
        logger_1.logger.info('尝试创建新的Sequelize实例');
        const emergencySequelize = createEmergencySequelize();
        await emergencySequelize.authenticate();
        logger_1.logger.info('紧急Sequelize实例认证成功');
        return emergencySequelize;
    }
    catch (error) {
        logger_1.logger.error('无法创建有效的Sequelize实例:', error);
        return null;
    }
};
// 验证数据库连接并修复问题
const validateDatabaseConnection = async () => {
    try {
        loadEnv();
        // 获取有效的Sequelize实例
        const sequelize = await getValidSequelize();
        if (!sequelize) {
            logger_1.logger.error('无法获取有效的Sequelize实例');
            return false;
        }
        // 确保全局对象和模块导出都指向有效实例
        global.sequelize = sequelize;
        try {
            // 尝试替换config/database.js中的实例
            const dbModulePath = require.resolve('../config/database');
            if (dbModulePath) {
                // 清除已缓存的模块
                delete require.cache[dbModulePath];
                // 重新加载时会使用我们注入的全局实例
                logger_1.logger.info('成功重置数据库模块缓存');
            }
        }
        catch (error) {
            logger_1.logger.error('清除数据库模块缓存失败:', error);
        }
        // 如果需要，尝试进行数据库同步
        try {
            // 只验证连接，不进行模式更改
            await sequelize.authenticate();
            logger_1.logger.info('数据库连接验证成功');
            return true;
        }
        catch (error) {
            logger_1.logger.error('数据库连接验证失败:', error);
            return false;
        }
    }
    catch (error) {
        logger_1.logger.error('验证数据库连接时发生错误:', error);
        return false;
    }
};
exports.validateDatabaseConnection = validateDatabaseConnection;
// 导出紧急创建的实例，以便在需要时使用
exports.createEmergencyInstance = createEmergencySequelize;
