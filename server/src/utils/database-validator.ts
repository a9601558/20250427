import { Sequelize } from 'sequelize';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { logger } from './logger';

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
  const envPath = path.join(process.cwd(), '.env');
  if (fs.existsSync(envPath)) {
    logger.info(`从验证器加载环境变量: ${envPath}`);
    dotenv.config({ path: envPath });
    return true;
  } 
  return false;
};

// 创建紧急Sequelize实例
const createEmergencySequelize = (): Sequelize => {
  loadEnv();
  
  logger.info('创建紧急Sequelize实例');
  return new Sequelize(
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
};

// 验证并获取有效的Sequelize实例
const getValidSequelize = async (): Promise<Sequelize | null> => {
  try {
    // 尝试从标准位置导入
    const databaseModule = require('../config/database');
    const sequelize = databaseModule.default || databaseModule;
    
    // 验证实例
    if (sequelize && typeof sequelize.authenticate === 'function') {
      try {
        await sequelize.authenticate();
        logger.info('已验证现有Sequelize实例');
        return sequelize;
      } catch (error) {
        logger.error('现有Sequelize实例认证失败:', error);
      }
    }
    
    // 实例无效，尝试创建新实例
    logger.info('尝试创建新的Sequelize实例');
    const emergencySequelize = createEmergencySequelize();
    await emergencySequelize.authenticate();
    logger.info('紧急Sequelize实例认证成功');
    return emergencySequelize;
  } catch (error) {
    logger.error('无法创建有效的Sequelize实例:', error);
    return null;
  }
};

// 验证数据库连接并修复问题
export const validateDatabaseConnection = async (): Promise<boolean> => {
  try {
    loadEnv();
    
    // 获取有效的Sequelize实例
    const sequelize = await getValidSequelize();
    if (!sequelize) {
      logger.error('无法获取有效的Sequelize实例');
      return false;
    }
    
    // 确保全局对象和模块导出都指向有效实例
    (global as any).sequelize = sequelize;
    
    try {
      // 尝试替换config/database.js中的实例
      const dbModulePath = require.resolve('../config/database');
      if (dbModulePath) {
        // 清除已缓存的模块
        delete require.cache[dbModulePath];
        
        // 重新加载时会使用我们注入的全局实例
        logger.info('成功重置数据库模块缓存');
      }
    } catch (error) {
      logger.error('清除数据库模块缓存失败:', error);
    }
    
    // 如果需要，尝试进行数据库同步
    try {
      // 只验证连接，不进行模式更改
      await sequelize.authenticate();
      logger.info('数据库连接验证成功');
      return true;
    } catch (error) {
      logger.error('数据库连接验证失败:', error);
      return false;
    }
  } catch (error) {
    logger.error('验证数据库连接时发生错误:', error);
    return false;
  }
};

// 导出紧急创建的实例，以便在需要时使用
export const createEmergencyInstance = createEmergencySequelize; 