#!/usr/bin/env node

/**
 * Sequelize实例自动修复工具
 * 
 * 此脚本会扫描所有编译后的JS文件，自动修复"No Sequelize instance passed"错误
 * 适用于宝塔服务器环境
 * 
 * 用法: node sequelize-instance-fix.js [目标目录]
 */

const fs = require('fs');
const path = require('path');

// 检查命令行参数
const targetDir = process.argv[2] || '/www/wwwroot/root/git/dist/dist/server';
console.log(`[修复工具] 目标目录: ${targetDir}`);

// 创建Sequelize修复代码
const sequelizeFixCode = `
// === 自动注入的Sequelize实例修复代码 ===
const seq_path = require('path');
const seq_fs = require('fs');
const seq_dotenv = require('dotenv');

// 确保环境变量已加载
const seq_envPath = seq_path.join(process.cwd(), '.env');
if (seq_fs.existsSync(seq_envPath)) {
  console.log('[数据库] 加载环境变量文件: ' + seq_envPath);
  seq_dotenv.config({ path: seq_envPath });
}

// 确保全局Sequelize实例存在
if (!global.sequelize) {
  try {
    const { Sequelize } = require('sequelize');
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
    console.log('[数据库] 全局Sequelize实例创建成功');
  } catch (error) {
    console.error('[数据库] 全局Sequelize实例创建失败:', error);
  }
}

// 确保导出实例可用
const sequelize = global.sequelize;
`;

// 创建数据库配置文件的内容
const dbConfigContent = `'use strict';

/**
 * 自动生成的数据库配置文件
 * 生成时间: ${new Date().toISOString()}
 */

const { Sequelize } = require('sequelize');
const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');

// 加载环境变量
const envPath = path.join(process.cwd(), '.env');
if (fs.existsSync(envPath)) {
  console.log(\`[数据库] 加载环境变量文件: \${envPath}\`);
  dotenv.config({ path: envPath });
}

// 数据库配置
const dbConfig = {
  dialect: 'mysql',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '3306'),
  username: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'quiz_app',
  logging: false,
  pool: {
    max: 5,
    min: 0,
    acquire: 30000,
    idle: 10000
  },
  dialectOptions: {
    connectTimeout: 10000
  }
};

// 确保全局变量可用
if (typeof global.sequelize === 'undefined') {
  try {
    global.sequelize = new Sequelize(
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
  } catch (error) {
    console.error('[数据库] 创建全局Sequelize实例失败:', error);
  }
}

// 创建或获取 Sequelize 实例
const sequelize = global.sequelize || new Sequelize(
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
module.exports.default = sequelize;
`;

// 创建User.init修复片段
const userInitFixCode = `
// User.init 安全检查
if (!sequelize || typeof sequelize.define !== 'function') {
  console.error('[紧急修复] User.init失败: 无效的Sequelize实例，使用全局实例');
  sequelize = global.sequelize;
  
  if (!sequelize) {
    const { Sequelize } = require('sequelize');
    sequelize = new Sequelize(
      process.env.DB_NAME || 'quiz_app',
      process.env.DB_USER || 'root',
      process.env.DB_PASSWORD || '',
      {
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT || '3306'),
        dialect: 'mysql',
        logging: false
      }
    );
    global.sequelize = sequelize;
  }
}

// 继续使用有效的sequelize实例
User.init(
`;

// 递归地扫描目录
const scanDir = (dir) => {
  if (!fs.existsSync(dir)) {
    console.error(`[修复工具] 错误: 目录不存在: ${dir}`);
    return;
  }

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    
    if (entry.isDirectory()) {
      scanDir(fullPath); // 递归扫描子目录
    } else if (entry.isFile() && entry.name.endsWith('.js')) {
      fixFile(fullPath);
    }
  }
};

// 修复单个文件
const fixFile = (filePath) => {
  try {
    // 读取文件内容
    let content = fs.readFileSync(filePath, 'utf8');
    let modified = false;
    
    // 检查是否是模型文件
    const isModelFile = content.includes('Model.init(') || 
                        content.includes('User.init(') || 
                        content.includes('extends Model');
    
    // 检查是否是数据库配置文件
    const isDbConfigFile = filePath.includes('database.js') || 
                          filePath.includes('db.js') || 
                          content.includes('new Sequelize(');
    
    // 1. 修复数据库配置文件
    if (isDbConfigFile) {
      console.log(`[修复工具] 检测到数据库配置文件: ${filePath}`);
      fs.writeFileSync(filePath, dbConfigContent, 'utf8');
      console.log(`[修复工具] 已更新数据库配置文件: ${filePath}`);
      return;
    }
    
    // 2. 修复模型文件
    if (isModelFile) {
      console.log(`[修复工具] 检测到模型文件: ${filePath}`);
      
      // 检查是否包含sequelize变量
      const hasSequelize = content.includes('const sequelize =') || 
                          content.includes('let sequelize =') ||
                          content.includes('var sequelize =');
      
      // 检查是否包含User.init()调用
      const hasUserInit = content.includes('User.init(');
      
      // 只在文件开头添加修复代码（如果还没有）
      if (!content.includes('=== 自动注入的Sequelize实例修复代码 ===')) {
        content = sequelizeFixCode + content;
        modified = true;
      }
      
      // 修复User.init调用
      if (hasUserInit && !content.includes('User.init 安全检查')) {
        content = content.replace(/User\.init\s*\(\s*/g, userInitFixCode);
        modified = true;
      }
      
      if (modified) {
        // 创建备份
        const backupPath = `${filePath}.bak`;
        fs.writeFileSync(backupPath, fs.readFileSync(filePath), 'utf8');
        
        // 写入修改后的内容
        fs.writeFileSync(filePath, content, 'utf8');
        console.log(`[修复工具] 已修复模型文件: ${filePath}`);
      }
    }
    
    // 3. 确保数据库配置文件存在
    if (filePath.includes('/models/')) {
      const configDir = path.join(path.dirname(filePath), '../../config');
      if (!fs.existsSync(configDir)) {
        fs.mkdirSync(configDir, { recursive: true });
        console.log(`[修复工具] 创建配置目录: ${configDir}`);
      }
      
      const dbJsPath = path.join(configDir, 'database.js');
      if (!fs.existsSync(dbJsPath)) {
        fs.writeFileSync(dbJsPath, dbConfigContent, 'utf8');
        console.log(`[修复工具] 创建数据库配置文件: ${dbJsPath}`);
      }
    }
    
  } catch (error) {
    console.error(`[修复工具] 处理文件时出错: ${filePath}`, error);
  }
};

// 开始扫描
console.log(`[修复工具] 开始扫描并修复文件...`);
scanDir(targetDir);
console.log(`[修复工具] 扫描完成！`);

// 创建配置目录和文件
try {
  const configDir = path.join(targetDir, 'src/config');
  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true });
    console.log(`[修复工具] 创建配置目录: ${configDir}`);
  }
  
  const dbJsPath = path.join(configDir, 'database.js');
  fs.writeFileSync(dbJsPath, dbConfigContent, 'utf8');
  console.log(`[修复工具] 已创建数据库配置文件: ${dbJsPath}`);
} catch (error) {
  console.error('[修复工具] 创建配置文件时出错:', error);
}

console.log('[修复工具] 所有修复工作已完成！请重新启动服务器。'); 