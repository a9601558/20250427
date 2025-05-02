'use strict';

/**
 * Sequelize预加载修复脚本 - 安全版本
 * 自动生成于 2025-05-02
 * 
 * 此脚本在Node.js加载过程中最早执行，修复Sequelize构造函数问题
 * 避免重复声明变量导致错误
 */

// 保存原始的require函数
const originalRequire = module.constructor.prototype.require;

// 替换require函数，拦截sequelize模块的加载
module.constructor.prototype.require = function(path) {
  // 先执行原始require
  const result = originalRequire.apply(this, arguments);
  
  // 当加载sequelize模块时
  if (path === 'sequelize') {
    try {
      // 确保全局sequelize实例存在
      if (!global.sequelize) {
        try {
          // 安全地尝试创建全局Sequelize实例
          const dotenv = require('dotenv');
          const fs = require('fs');
          const envPath = require('path').join(process.cwd(), '.env');
          
          if (fs.existsSync(envPath)) {
            console.log('[预加载] 加载环境变量文件: ' + envPath);
            dotenv.config({ path: envPath });
          }
          
          // 获取Sequelize构造函数
          const SequelizeClass = result && typeof result === 'function' 
            ? result 
            : (result && typeof result.Sequelize === 'function' 
                ? result.Sequelize 
                : null);
          
          if (SequelizeClass) {
            global.sequelize = new SequelizeClass(
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
          } else {
            console.error('[预加载] 无法获取有效的Sequelize构造函数');
          }
        } catch (error) {
          console.error('[预加载] 创建全局Sequelize实例失败:', error);
        }
      }
      
      // 修复sequelize模块代码，防止变量重复声明错误
      if (typeof result === 'object' && result !== null) {
        // 找到文件中可能导致问题的代码，返回前进行修复
        const file = result.__filename || '';
        if (file && file.includes('sequelize.js')) {
          try {
            const fs = require('fs');
            const content = fs.readFileSync(file, 'utf8');
            
            // 检查是否包含已知的问题代码
            if (content.includes('const safeExport = module.exports;')) {
              // 如果找到问题代码，但尚未修复，进行修复
              if (!content.includes('// FIXED: safeExport declaration removed')) {
                const fixed = content.replace(
                  'const safeExport = module.exports;', 
                  '// FIXED: safeExport declaration removed\n// const safeExport = module.exports;'
                );
                fs.writeFileSync(file, fixed, 'utf8');
                console.log('[预加载] 已修复sequelize.js中的变量声明问题');
              }
            }
          } catch (err) {
            // 忽略文件修复错误，继续使用预加载方式
            console.error('[预加载] 尝试修复sequelize.js文件失败:', err.message);
          }
        }
      }
      
      // 处理返回值
      if (!result || typeof result !== 'function') {
        if (result && typeof result.Sequelize === 'function') {
          console.log('[预加载] 使用result.Sequelize作为主导出');
          return result.Sequelize;
        }
      }
    } catch (error) {
      console.error('[预加载] 处理sequelize模块失败:', error);
    }
  }
  
  return result;
};

console.log('[预加载] Sequelize安全预加载已启用');
