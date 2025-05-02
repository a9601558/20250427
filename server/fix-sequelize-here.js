#!/usr/bin/env node

/**
 * 本地目录Sequelize修复包装脚本
 * 
 * 此脚本将直接修补当前目录的Sequelize模块
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// 使用当前目录作为目标
const targetDir = process.cwd();
console.log(`[修复包装器] 目标目录: ${targetDir}`);

// 检测是否运行在生产环境
const isProduction = process.env.NODE_ENV === 'production';
console.log(`[修复包装器] 运行环境: ${isProduction ? '生产环境' : '开发环境'}`);

// 创建sequelize-preload.js文件
function createPreloadFile() {
  console.log('[修复包装器] 创建sequelize-preload.js文件');
  
  const preloadContent = `'use strict';

/**
 * Sequelize预加载修复脚本
 * 自动生成于 ${new Date().toISOString()}
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
`;

  const preloadPath = path.join(targetDir, 'sequelize-preload.js');
  fs.writeFileSync(preloadPath, preloadContent, 'utf8');
  console.log(`[修复包装器] 已创建预加载文件: ${preloadPath}`);
}

// 运行一系列修复
function runFixes() {
  try {
    // 1. 创建预加载文件
    createPreloadFile();
    
    // 2. 修改package.json的start脚本
    const packageJsonPath = path.join(targetDir, 'package.json');
    if (fs.existsSync(packageJsonPath)) {
      console.log(`[修复包装器] 修改package.json`);
      
      // 读取现有package.json
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
      
      // 备份
      fs.writeFileSync(`${packageJsonPath}.bak`, JSON.stringify(packageJson, null, 2), 'utf8');
      
      // 修改start脚本
      packageJson.scripts = packageJson.scripts || {};
      
      // 添加NODE_OPTIONS到start命令
      const originalStart = packageJson.scripts.start || '';
      if (!originalStart.includes('--require ./sequelize-preload.js')) {
        packageJson.scripts.start = `NODE_OPTIONS="--require ./sequelize-preload.js" ${originalStart}`;
      }
      
      // 更新package.json
      fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2), 'utf8');
      console.log(`[修复包装器] 已更新package.json`);
    }
    
    console.log('[修复包装器] 修复完成！现在可以使用 npm start 启动应用');
    
  } catch (error) {
    console.error('[修复包装器] 运行修复时出错:', error);
  }
}

// 执行修复
runFixes();