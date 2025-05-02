'use strict';

/**
 * 紧急修复 - Sequelize 实例缺失
 * 
 * 此脚本用于服务器上直接修复 "No Sequelize instance passed" 错误
 * 适用于已部署的环境
 * 
 * 用法: node emergency-sequelize-fix.js
 */

const fs = require('fs');
const path = require('path');

console.log('开始执行紧急修复...');

// 可能的User.js文件位置
const possiblePaths = [
  '/www/wwwroot/root/git/dist/dist/server/src/models/User.js',
  '/www/wwwroot/root/git/dist/server/src/models/User.js',
  '/www/wwwroot/root/git/dist/src/models/User.js',
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
    console.log(`找到User.js文件: ${userJsPath}`);
    break;
  }
}

if (!userJsPath) {
  console.error('无法找到User.js文件，请检查路径');
  console.log('请手动指定文件路径，例如: node emergency-sequelize-fix.js /path/to/User.js');
  
  // 检查是否通过命令行参数提供了路径
  if (process.argv.length > 2) {
    userJsPath = process.argv[2];
    console.log(`使用命令行提供的路径: ${userJsPath}`);
    
    if (!fs.existsSync(userJsPath)) {
      console.error(`错误: 提供的路径不存在: ${userJsPath}`);
      process.exit(1);
    }
  } else {
    process.exit(1);
  }
}

try {
  // 读取User.js文件
  const content = fs.readFileSync(userJsPath, 'utf8');
  console.log(`成功读取文件，大小: ${content.length} 字节`);
  
  // 创建备份
  const backupPath = `${userJsPath}.bak-${Date.now()}`;
  fs.writeFileSync(backupPath, content, 'utf8');
  console.log(`已创建备份: ${backupPath}`);
  
  // 检查文件内容以确定修复方法
  const hasInit = content.includes('User.init(');
  const hasSequelize = content.includes('const sequelize =') || content.includes('let sequelize =');
  
  console.log(`文件分析: 包含User.init(): ${hasInit}, 包含sequelize声明: ${hasSequelize}`);
  
  // 定义修复块
  const sequelizeBlock = `
// 紧急修复: 添加Sequelize实例
const { Sequelize } = require('sequelize');
const path = require('path');
const dotenv = require('dotenv');
const fs = require('fs');

// 加载环境变量
const envPath = path.join(process.cwd(), '.env');
if (fs.existsSync(envPath)) {
  console.log(\`加载环境变量文件: \${envPath}\`);
  dotenv.config({ path: envPath });
}

// 创建Sequelize实例
const sequelize = new Sequelize(
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
`;

  const initBlock = `
// 紧急修复: 确保有可用的sequelize实例
if (typeof sequelize === 'undefined' || !sequelize) {
  console.log('警告: sequelize实例缺失，创建备用实例');
  const { Sequelize } = require('sequelize');
  global.sequelize = new Sequelize(
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
  var sequelize = global.sequelize;
}

// 紧急修复: 确保每个模型使用正确的sequelize实例
User.init(
`;

  // 检测需要的修复类型
  let newContent = content;
  
  // 1. 如果没有sequelize声明，添加到文件顶部
  if (!hasSequelize) {
    // 找到第一个require语句
    const firstRequireIndex = content.indexOf('require');
    if (firstRequireIndex > 0) {
      // 找到require语句所在行的开头
      const lineStart = content.lastIndexOf('\n', firstRequireIndex);
      if (lineStart >= 0) {
        // 插入sequelize代码块
        newContent = content.substring(0, lineStart) + sequelizeBlock + content.substring(lineStart);
        console.log('已添加sequelize实例创建代码');
      }
    }
  }
  
  // 2. 修复Init调用
  if (hasInit) {
    newContent = newContent.replace(/User\.init\s*\(\s*/g, initBlock);
    console.log('已修复User.init调用');
  }
  
  // 3. 如果只有一行或内容过短，或找不到User.init，添加备用代码
  if (newContent.split('\n').length < 5 || newContent.length < 100 || !hasInit) {
    newContent += `

// 紧急备用修复
try {
  if (typeof User !== 'undefined' && User.init && !User.findAll) {
    // 如果User类存在但未初始化
    console.log('紧急修复: 重新初始化User模型');
    
    const { Sequelize, DataTypes } = require('sequelize');
    const fallbackSequelize = new Sequelize(
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
    
    // 尝试重新初始化User模型
    if (User.init) {
      User.init(
        {
          // 最小化的字段定义，确保基本功能
          id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true
          },
          username: DataTypes.STRING,
          email: DataTypes.STRING,
          password: DataTypes.STRING,
          isAdmin: DataTypes.BOOLEAN
        },
        {
          sequelize: fallbackSequelize,
          modelName: 'User',
          tableName: 'users'
        }
      );
    }
  }
} catch (error) {
  console.error('紧急备用修复失败:', error);
}
`;
    console.log('已添加紧急备用修复代码');
  }
  
  // 保存修改后的文件
  fs.writeFileSync(userJsPath, newContent, 'utf8');
  console.log('成功: 文件已修复并保存');
  
  // 如果存在database.js文件，也进行修复
  const dbPath = path.join(path.dirname(userJsPath), '../config/database.js');
  if (fs.existsSync(dbPath)) {
    console.log(`尝试修复数据库配置文件: ${dbPath}`);
    
    const dbJsContent = `'use strict';

/**
 * 紧急修复的数据库配置文件
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
module.exports.default = sequelize;
`;
    
    fs.writeFileSync(dbPath, dbJsContent, 'utf8');
    
    // 同样创建db.js
    const dbJsPath = path.join(path.dirname(dbPath), 'db.js');
    fs.writeFileSync(dbJsPath, dbJsContent, 'utf8');
    
    console.log('数据库配置文件已修复');
  }
  
  console.log('紧急修复完成！请重新启动服务器尝试。');
} catch (error) {
  console.error('修复过程中出错:', error);
  process.exit(1);
} 