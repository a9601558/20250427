'use strict';

/**
 * 数据库模块修复脚本
 * 
 * 此脚本直接在服务器上运行，用于修复编译后的 JavaScript 文件中的数据库模块导入问题
 * 用法: node fix-sequelize-paths.js
 */

const fs = require('fs');
const path = require('path');

console.log('开始修复数据库模块路径问题...');

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

// 创建 db.js 文件
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

// 读取 User.js 文件，修复导入语句
let userJsContent = fs.readFileSync(userJsPath, 'utf8');

// 创建 db.js 文件
const dbJsPath = path.join(path.dirname(userJsPath), '../config/db.js');
const dbDir = path.dirname(dbJsPath);

if (!fs.existsSync(dbDir)) {
  console.log(`创建目录: ${dbDir}`);
  fs.mkdirSync(dbDir, { recursive: true });
}

try {
  fs.writeFileSync(dbJsPath, dbJsContent, 'utf8');
  console.log(`成功: 已创建数据库配置文件 ${dbJsPath}`);
} catch (error) {
  console.error('错误: 创建数据库配置文件失败:', error);
  process.exit(1);
}

console.log('数据库模块路径修复完成'); 
