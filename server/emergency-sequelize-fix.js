'use strict';

/**
 * 紧急修复 - Sequelize实例缺失 (生产环境版本)
 * 
 * 此脚本用于服务器上直接修复 "No Sequelize instance passed" 错误
 * 专为宝塔服务器环境优化
 * 
 * 用法: node emergency-sequelize-fix.js [可选的User.js文件路径]
 */

const fs = require('fs');
const path = require('path');

console.log('[紧急修复] 开始执行紧急修复...');

// 可能的User.js文件位置 - 宝塔环境优先
const possiblePaths = [
  // 宝塔环境
  '/www/wwwroot/root/git/dist/dist/server/src/models/User.js',
  '/www/wwwroot/root/git/dist/server/src/models/User.js',
  '/www/wwwroot/root/git/dist/src/models/User.js',
  '/www/wwwroot/root/git/dist/models/User.js',
  '/www/wwwroot/root/git/server/dist/models/User.js',
  // 当前目录的相对路径
  path.join(__dirname, 'dist/server/src/models/User.js'),
  path.join(__dirname, 'dist/src/models/User.js'),
  path.join(__dirname, 'dist/models/User.js'),
];

// 寻找User.js文件
let userJsPath = null;
for (const filePath of possiblePaths) {
  if (fs.existsSync(filePath)) {
    userJsPath = filePath;
    console.log(`[紧急修复] 找到User.js文件: ${userJsPath}`);
    break;
  }
}

if (!userJsPath) {
  console.error('[紧急修复] 无法找到User.js文件，请检查路径');
  console.log('[紧急修复] 请手动指定文件路径，例如: node emergency-sequelize-fix.js /path/to/User.js');
  
  // 检查是否通过命令行参数提供了路径
  if (process.argv.length > 2) {
    userJsPath = process.argv[2];
    console.log(`[紧急修复] 使用命令行提供的路径: ${userJsPath}`);
    
    if (!fs.existsSync(userJsPath)) {
      console.error(`[紧急修复] 错误: 提供的路径不存在: ${userJsPath}`);
      process.exit(1);
    }
  } else {
    process.exit(1);
  }
}

try {
  // 读取User.js文件
  const content = fs.readFileSync(userJsPath, 'utf8');
  console.log(`[紧急修复] 成功读取文件，大小: ${content.length} 字节`);
  
  // 创建备份
  const backupPath = `${userJsPath}.bak-${Date.now()}`;
  fs.writeFileSync(backupPath, content, 'utf8');
  console.log(`[紧急修复] 已创建备份: ${backupPath}`);
  
  // 检查文件内容以确定修复方法
  const hasInit = content.includes('User.init(');
  const hasSequelize = content.includes('const sequelize =') || content.includes('let sequelize =');
  
  console.log(`[紧急修复] 文件分析: 包含User.init(): ${hasInit}, 包含sequelize声明: ${hasSequelize}`);
  
  // 定义完整的修复模块
  const completeFixModule = `
// =========== 紧急修复: Sequelize实例模块 ===========
// 自动生成于 ${new Date().toISOString()}

// 使用相对路径获取.env文件
const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');

// 加载环境变量
const envPath = path.join(process.cwd(), '.env');
if (fs.existsSync(envPath)) {
  console.log(\`[数据库] 加载环境变量文件: \${envPath}\`);
  dotenv.config({ path: envPath });
} else {
  console.warn(\`[数据库] 警告: 环境变量文件不存在: \${envPath}\`);
}

// 创建Sequelize实例
const { Sequelize, DataTypes } = require('sequelize');

// 添加全局变量声明以避免undefined错误
global.sequelize = global.sequelize || new Sequelize(
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

// 确保始终有sequelize变量，即使模块导入失败
const sequelize = global.sequelize;
console.log('[数据库] Sequelize实例恢复成功: ' + !!sequelize);

// 确保sequelize变量能在整个模块内使用
var sequelizeInstance = sequelize;
`;

  // 额外的User.init修复函数
  const userInitFixCode = `
// =========== User模型初始化修复 ===========
// 尝试初始化User模型
const initUserModel = () => {
  try {
    // 确认初始化用的sequelize实例
    if (!sequelize || typeof sequelize.define !== 'function') {
      console.error('[紧急修复] User.init失败: 无效的Sequelize实例，尝试修复');
      
      // 使用全局实例或创建新的
      const workingSequelize = global.sequelize || new Sequelize(
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
      
      // 覆盖现有变量
      global.sequelize = workingSequelize;
      sequelize = workingSequelize;
      sequelizeInstance = workingSequelize;
    }
    
    return true;
  } catch (error) {
    console.error('[紧急修复] 初始化尝试失败:', error);
    return false;
  }
};

// 立即执行初始化
initUserModel();
`;

  // 初始化验证和修复
  const initValidationCode = `
// User.init 之前的验证
if (typeof sequelize === 'undefined' || !sequelize) {
  console.error('[紧急修复] sequelize变量丢失，重新获取');
  sequelize = global.sequelize;
  
  if (!sequelize) {
    console.error('[紧急修复] 全局sequelize也不存在，创建新实例');
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

// 确保User.init总是使用有效的sequelize实例
User.init(
`;

  // 修改后的内容
  let newContent = content;
  
  // 替换策略：
  // 1. 如果找不到sequelize声明，在文件开头添加完整的修复模块
  if (!hasSequelize) {
    console.log('[紧急修复] 未找到sequelize声明，添加完整模块');
    newContent = completeFixModule + newContent + userInitFixCode;
  } else {
    // 2. 如果已有sequelize声明，添加用户模型初始化验证
    console.log('[紧急修复] 已找到sequelize声明，添加初始化验证');
    newContent = newContent + userInitFixCode;
  }
  
  // 3. 替换User.init调用部分，确保使用有效的sequelize实例
  if (hasInit) {
    console.log('[紧急修复] 找到User.init调用，添加初始化验证');
    newContent = newContent.replace(/User\.init\s*\(\s*/g, initValidationCode);
  }
  
  // 保存修改后的文件
  fs.writeFileSync(userJsPath, newContent, 'utf8');
  console.log('[紧急修复] 成功: User.js文件已修复并保存');
  
  // 现在修复数据库配置文件
  const configDir = path.join(path.dirname(userJsPath), '../config');
  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true });
    console.log(`[紧急修复] 创建配置目录: ${configDir}`);
  }
  
  const dbJsPath = path.join(configDir, 'db.js');
  const databaseJsPath = path.join(configDir, 'database.js');
  const dbJsContent = `'use strict';

/**
 * 紧急修复生成的数据库配置文件
 * 生成时间: ${new Date().toISOString()}
 */

const { Sequelize } = require('sequelize');
const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');

// 使用相对路径指向项目根目录的.env文件
const envPath = path.join(process.cwd(), '.env');

// 检查并加载 .env 文件
if (fs.existsSync(envPath)) {
  console.log(\`[数据库] 加载环境变量文件: \${envPath}\`);
  dotenv.config({ path: envPath });
} else {
  console.warn(\`[数据库] 警告: 环境变量文件不存在: \${envPath}\`);
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
    connectTimeout: 10000,
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
    console.log('[数据库] 全局Sequelize实例创建成功');
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
  
  // 写入db.js文件
  fs.writeFileSync(dbJsPath, dbJsContent, 'utf8');
  console.log(`[紧急修复] 已创建数据库配置文件: ${dbJsPath}`);
  
  // 同样写入database.js文件
  fs.writeFileSync(databaseJsPath, dbJsContent, 'utf8');
  console.log(`[紧急修复] 已创建数据库配置文件: ${databaseJsPath}`);
  
  console.log('[紧急修复] 所有修复工作已完成。请尝试重启服务器！');
} catch (error) {
  console.error('[紧急修复] 修复过程中出错:', error);
  process.exit(1);
} 