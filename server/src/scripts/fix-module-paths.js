'use strict';

/**
 * 修复编译后的模块路径问题
 * 此脚本在部署时运行，创建兼容性文件以解决模块导入路径不一致的问题
 * 
 * 使用方法: node fix-module-paths.js
 */

const fs = require('fs');
const path = require('path');

console.log('开始修复模块路径问题...');

// 获取项目根路径
const rootDir = path.resolve(__dirname, '../../..');
const distDir = path.join(rootDir, 'dist');
const configDir = path.join(distDir, 'server/src/config');

// 检查目录是否存在
if (!fs.existsSync(configDir)) {
  console.log(`创建目录: ${configDir}`);
  fs.mkdirSync(configDir, { recursive: true });
}

// 检查数据库配置文件是否存在
const databaseJsPath = path.join(configDir, 'database.js');
const dbJsPath = path.join(configDir, 'db.js');

if (fs.existsSync(databaseJsPath)) {
  // 复制 database.js 到 db.js
  try {
    const databaseContent = fs.readFileSync(databaseJsPath, 'utf8');
    fs.writeFileSync(dbJsPath, databaseContent, 'utf8');
    console.log(`成功: 已复制 ${databaseJsPath} 到 ${dbJsPath}`);
  } catch (error) {
    console.error(`错误: 复制文件失败:`, error);
  }
} else {
  // 如果 database.js 不存在，创建一个简单的 db.js 导出默认 Sequelize 实例
  const content = `'use strict';

/**
 * 兼容性数据库配置文件
 * 自动生成于 ${new Date().toISOString()}
 */
const { Sequelize } = require('sequelize');
const path = require('path');
require('dotenv').config({ path: path.join(process.cwd(), '.env') });

const sequelize = new Sequelize(
  process.env.DB_NAME || 'quiz_app',
  process.env.DB_USER || 'root',
  process.env.DB_PASSWORD || '',
  {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '3306'),
    dialect: 'mysql',
    logging: console.log,
    dialectOptions: {
      connectTimeout: 20000
    }
  }
);

module.exports = sequelize;
`;

  fs.writeFileSync(dbJsPath, content, 'utf8');
  console.log(`成功: 已创建兼容性文件 ${dbJsPath}`);
}

console.log('模块路径修复完成'); 