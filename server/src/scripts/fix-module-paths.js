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
// 处理可能的编译输出路径差异
const configDirOptions = [
  path.join(distDir, 'server/src/config'),
  path.join(distDir, 'src/config'),
  path.join(rootDir, 'dist/config'),
  path.join(rootDir, 'server/dist/config'),
];

let configDir = null;
for (const dir of configDirOptions) {
  if (fs.existsSync(dir)) {
    configDir = dir;
    console.log(`找到配置目录: ${configDir}`);
    break;
  }
}

if (!configDir) {
  console.log('未找到配置目录，创建默认路径');
  configDir = configDirOptions[0];
  fs.mkdirSync(configDir, { recursive: true });
}

// 检查数据库配置文件是否存在
const dbJsPath = path.join(configDir, 'db.js');

// 创建一个直接的 CommonJS 兼容的数据库配置文件
const content = `'use strict';

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
  fs.writeFileSync(dbJsPath, content, 'utf8');
  console.log(`成功: 已创建兼容性文件 ${dbJsPath}`);
} catch (error) {
  console.error('错误: 创建文件失败:', error);
}

// 创建任何其他所需的兼容性文件
// ...

console.log('模块路径修复完成'); 
