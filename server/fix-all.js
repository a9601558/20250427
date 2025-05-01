'use strict';

/**
 * 一站式修复脚本 - 解决所有编译和模块问题
 * 
 * 此脚本解决以下问题:
 * 1. 直接修复User.js中的Sequelize导入
 * 2. 创建兼容的db.js文件
 * 3. 修复数据库索引限制问题
 * 
 * 用法: node fix-all.js
 */

const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

console.log('开始执行一站式修复...');

// 获取项目根路径
const rootDir = __dirname;
const distDir = path.join(rootDir, 'dist');

// 找到编译后的 User.js 文件
const possibleUserJsPaths = [
  path.join(rootDir, 'dist/server/src/models/User.js'),
  path.join(rootDir, 'dist/src/models/User.js'),
  path.join(rootDir, 'dist/models/User.js'),
  path.join(rootDir, 'server/dist/models/User.js'),
  // 添加更多可能的路径
  path.join(distDir, 'server/src/models/User.js'),
  path.join(distDir, 'src/models/User.js'),
  path.join(distDir, 'models/User.js')
];

// 1. 修复 User.js 文件
console.log('步骤1: 修复User.js文件...');

let userJsPath = null;
for (const filePath of possibleUserJsPaths) {
  if (fs.existsSync(filePath)) {
    userJsPath = filePath;
    console.log(`找到 User.js 文件: ${userJsPath}`);
    break;
  }
}

if (userJsPath) {
  try {
    // 读取 User.js 文件
    let userJsContent = fs.readFileSync(userJsPath, 'utf8');
    console.log('已读取User.js文件');
    
    // 备份原始文件
    const backupPath = `${userJsPath}.bak-${Date.now()}`;
    fs.writeFileSync(backupPath, userJsContent, 'utf8');
    console.log(`已备份原始文件到 ${backupPath}`);
    
    // 创建内联的Sequelize配置
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
    
    // 替换或添加Sequelize配置
    if (userJsContent.includes("require('../config/db')") || userJsContent.includes("require(\"../config/db\")")) {
      userJsContent = userJsContent.replace(/const sequelize = require\(['"]\.\.\/config\/db['"]\);/, inlineSequelizeCode);
      console.log('已替换Sequelize导入语句');
    } else {
      console.log('未找到匹配的导入语句，在文件开头插入Sequelize配置');
      const requireIndex = userJsContent.indexOf('require');
      if (requireIndex > 0) {
        const insertPosition = userJsContent.lastIndexOf('\n', requireIndex);
        if (insertPosition > 0) {
          userJsContent = userJsContent.substring(0, insertPosition) + inlineSequelizeCode + userJsContent.substring(insertPosition);
        } else {
          userJsContent = inlineSequelizeCode + userJsContent;
        }
      } else {
        userJsContent = inlineSequelizeCode + userJsContent;
      }
    }
    
    // 保存修改后的文件
    fs.writeFileSync(userJsPath, userJsContent, 'utf8');
    console.log('User.js文件修复完成');
  } catch (error) {
    console.error('修复User.js文件时出错:', error);
  }
} else {
  console.log('警告: 未找到User.js文件，跳过步骤1');
}

// 2. 创建db.js文件
console.log('\n步骤2: 创建兼容的db.js文件...');

const possibleConfigDirs = [
  path.join(rootDir, 'dist/server/src/config'),
  path.join(rootDir, 'dist/src/config'),
  path.join(rootDir, 'dist/config'),
  path.join(rootDir, 'server/dist/config'),
  path.join(distDir, 'server/src/config'),
  path.join(distDir, 'src/config'),
  path.join(distDir, 'config')
];

let configDir = null;
for (const dir of possibleConfigDirs) {
  if (fs.existsSync(dir)) {
    configDir = dir;
    console.log(`找到配置目录: ${configDir}`);
    break;
  }
}

if (!configDir) {
  console.log('未找到配置目录，使用默认路径');
  configDir = possibleConfigDirs[0];
  fs.mkdirSync(configDir, { recursive: true });
}

const dbJsPath = path.join(configDir, 'db.js');
const dbJsContent = `'use strict';

/**
 * 兼容性数据库配置文件
 * 自动生成于 ${new Date().toISOString()}
 */
const { Sequelize } = require('sequelize');
const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');

// 使用相对路径指向项目根目录的.env文件
const envPath = path.join(process.cwd(), '.env');

// 检查并加载 .env 文件
if (fs.existsSync(envPath)) {
  console.log(\`加载环境变量文件: \${envPath}\`);
  dotenv.config({ path: envPath });
} else {
  console.warn(\`警告: 环境变量文件不存在: \${envPath}\`);
}

// 数据库配置
const dbConfig = {
  dialect: 'mysql',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '3306'),
  username: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'quiz_app',
  logging: console.log,
  pool: {
    max: 5,
    min: 0,
    acquire: 30000,
    idle: 10000
  },
  dialectOptions: {
    connectTimeout: 10000,
  }
};

// 创建 Sequelize 实例
const sequelize = new Sequelize(
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
`;

try {
  fs.writeFileSync(dbJsPath, dbJsContent, 'utf8');
  console.log(`成功: 已创建兼容性文件 ${dbJsPath}`);
} catch (error) {
  console.error(`错误: 创建数据库配置文件失败:`, error);
}

// 3. 复制或创建数据库配置
console.log('\n步骤3: 复制数据库配置到所有可能位置...');

const possibleDatabasePaths = [
  path.join(configDir, 'database.js')
];

possibleDatabasePaths.forEach(dbPath => {
  try {
    fs.writeFileSync(dbPath, dbJsContent, 'utf8');
    console.log(`成功: 已创建/更新数据库配置文件 ${dbPath}`);
  } catch (error) {
    console.error(`错误: 创建/更新数据库配置文件 ${dbPath} 失败:`, error);
  }
});

// 4. 运行数据库索引修复
console.log('\n步骤4: 检查并修复数据库索引...');

// 检查fix-db-indexes.js脚本是否存在并运行
const possibleIndexFixScripts = [
  path.join(rootDir, 'dist/scripts/fix-db-indexes.js'),
  path.join(rootDir, 'dist/server/src/scripts/fix-db-indexes.js'),
  path.join(rootDir, 'dist/src/scripts/fix-db-indexes.js'),
  path.join(distDir, 'scripts/fix-db-indexes.js'),
  path.join(distDir, 'server/src/scripts/fix-db-indexes.js'),
  path.join(distDir, 'src/scripts/fix-db-indexes.js')
];

let indexFixScript = null;
for (const scriptPath of possibleIndexFixScripts) {
  if (fs.existsSync(scriptPath)) {
    indexFixScript = scriptPath;
    console.log(`找到索引修复脚本: ${indexFixScript}`);
    break;
  }
}

if (indexFixScript) {
  // 异步执行索引修复脚本
  console.log(`执行索引修复脚本: ${indexFixScript}`);
  exec(`node ${indexFixScript}`, (error, stdout, stderr) => {
    if (error) {
      console.error(`执行索引修复脚本出错: ${error.message}`);
      return;
    }
    if (stderr) {
      console.error(`索引修复脚本错误输出: ${stderr}`);
      return;
    }
    console.log(`索引修复脚本输出: ${stdout}`);
  });
} else {
  console.log('未找到索引修复脚本，跳过此步骤');
}

console.log('\n所有修复完成！请尝试启动服务器。'); 