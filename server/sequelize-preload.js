'use strict';

/**
 * Sequelize预加载修复脚本
 * 自动生成于 2025-05-02T12:13:13.046Z
 * 
 * 此脚本在Node.js加载过程中最早执行，修复Sequelize构造函数问题
 */

// 保存原始的require函数
const originalRequire = module.constructor.prototype.require;

// 替换require函数，拦截sequelize模块的加载
module.constructor.prototype.require = function(path) {
  const result = originalRequire.apply(this, arguments);
  
  // 当加载sequelize模块时
  if (path === 'sequelize') {
    try {
      // 确保全局sequelize实例存在
      if (!global.sequelize) {
        const dotenv = require('dotenv');
        const fs = require('fs');
        const envPath = require('path').join(process.cwd(), '.env');
        
        if (fs.existsSync(envPath)) {
          console.log('[预加载] 加载环境变量文件: ' + envPath);
          dotenv.config({ path: envPath });
        }
        
        // 创建全局sequelize实例
        try {
          const { Sequelize } = result;
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
          console.log('[预加载] 全局Sequelize实例创建成功');
        } catch (error) {
          console.error('[预加载] 全局Sequelize实例创建失败:', error);
        }
      }
      
      // 修复返回的Sequelize构造函数
      if (!result || typeof result !== 'function') {
        console.warn('[预加载] sequelize模块没有返回构造函数');
        
        if (result && typeof result.Sequelize === 'function') {
          console.log('[预加载] 使用result.Sequelize作为主导出');
          return result.Sequelize;
        }
      }
    } catch (error) {
      console.error('[预加载] 修复sequelize模块失败:', error);
    }
  }
  
  return result;
};

console.log('[预加载] Sequelize预加载修复已启用');
