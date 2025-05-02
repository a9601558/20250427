'use strict';

/**
 * 直接修复User.js文件中的Sequelize导入
 * 
 * 此脚本查找编译后的User.js文件，并直接修改文件中的导入语句
 * 用法: node fix-user-model.js
 */

const fs = require('fs');
const path = require('path');

console.log('开始直接修复User.js文件...');

// 找到编译后的 User.js 文件
const possibleUserJsPaths = [
  path.join(__dirname, 'dist/server/src/models/User.js'),
  path.join(__dirname, 'dist/src/models/User.js'),
  path.join(__dirname, 'dist/models/User.js'),
  path.join(__dirname, 'server/dist/models/User.js'),
];

let userJsPath = null;
for (const filePath of possibleUserJsPaths) {
  if (fs.existsSync(filePath)) {
    userJsPath = filePath;
    console.log(`找到 User.js 文件: ${userJsPath}`);
    break;
  }
}

if (!userJsPath) {
  console.error('错误: 无法找到编译后的 User.js 文件');
  process.exit(1);
}

try {
  // 读取 User.js 文件
  let userJsContent = fs.readFileSync(userJsPath, 'utf8');
  console.log('已读取User.js文件内容');
  
  // 输出文件的前100个字符，帮助调试
  console.log('文件内容开头:', userJsContent.substring(0, 500));
  
  // 备份原始文件
  const backupPath = `${userJsPath}.bak`;
  fs.writeFileSync(backupPath, userJsContent, 'utf8');
  console.log(`已备份原始文件到 ${backupPath}`);
  
  // 创建内联的Sequelize配置，确保在User.init前已有有效的sequelize实例
  const inlineSequelizeCode = `
// 内联的 Sequelize 配置，解决模块导入问题
const { Sequelize } = require('sequelize');
const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');

// 检查并加载 .env 文件
const envPath = path.join(process.cwd(), '.env');
if (fs.existsSync(envPath)) {
  console.log(\`加载环境变量文件: \${envPath}\`);
  dotenv.config({ path: envPath });
}

// 创建 Sequelize 实例
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
`;

  // 确保sequelize变量被正确定义并传递给User.init
  const modifiedInitCode = `
// 确保有一个有效的 Sequelize 实例
let sequelizeInstance = sequelize;

// 如果没有有效的 sequelize 实例，创建一个
if (!sequelizeInstance) {
  console.log('警告: sequelize 实例无效，创建备用实例');
  
  const { Sequelize } = require('sequelize');
  sequelizeInstance = new Sequelize(
    process.env.DB_NAME || 'quiz_app',
    process.env.DB_USER || 'root',
    process.env.DB_PASSWORD || '',
    {
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '3306'),
      dialect: 'mysql',
      logging: console.log
    }
  );
}

// 确保 User.init 总是使用有效的 sequelize 实例
User.init(`;

  // 替换原始的导入语句
  const originalImportPattern = /const sequelize = require\(['"]\.\.\/config\/db['"]\);/;
  
  if (originalImportPattern.test(userJsContent)) {
    // 使用正则表达式替换导入语句
    userJsContent = userJsContent.replace(originalImportPattern, inlineSequelizeCode);
    console.log('已替换Sequelize导入语句');
  } else {
    // 如果找不到匹配的导入语句，在文件开头插入Sequelize配置
    console.log('未找到匹配的导入语句，在文件开头插入Sequelize配置');
    
    // 查找第一个有效的 require 语句
    const firstRequireIndex = userJsContent.indexOf('require');
    if (firstRequireIndex > 0) {
      const insertPosition = userJsContent.lastIndexOf('\n', firstRequireIndex);
      if (insertPosition > 0) {
        userJsContent = userJsContent.substring(0, insertPosition) + inlineSequelizeCode + userJsContent.substring(insertPosition);
      } else {
        userJsContent = inlineSequelizeCode + userJsContent;
      }
    } else {
      userJsContent = inlineSequelizeCode + userJsContent;
    }
  }
  
  // 替换User.init部分
  const userInitPattern = /User\.init\(/;
  if (userInitPattern.test(userJsContent)) {
    userJsContent = userJsContent.replace(userInitPattern, modifiedInitCode);
    console.log('已修改User.init代码，确保使用有效的sequelize实例');
  } else {
    console.log('警告: 未找到User.init调用');
  }
  
  // 保存修改后的文件
  fs.writeFileSync(userJsPath, userJsContent, 'utf8');
  console.log('已保存修改后的 User.js 文件');
  
  console.log('User.js文件修复完成');
} catch (error) {
  console.error('修复User.js文件时出错:', error);
  process.exit(1);
} 
