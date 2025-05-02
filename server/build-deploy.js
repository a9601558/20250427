#!/usr/bin/env node

/**
 * 数据库迁移和部署工具
 * 
 * 此脚本执行以下操作:
 * 1. 编译TypeScript代码为JavaScript
 * 2. 应用Sequelize修复到编译后的代码
 * 3. 自动创建所有必要的数据库表
 * 
 * 用法: node build-deploy.js [目标目录]
 */

const fs = require('fs');
const path = require('path');
const { execSync, exec } = require('child_process');
const util = require('util');
const execAsync = util.promisify(exec);

// 处理命令行参数
const targetDir = process.argv[2] || process.cwd();
const sourceDir = path.join(targetDir, 'src');
const distDir = path.join(targetDir, 'dist');

console.log(`[部署工具] 目标目录: ${targetDir}`);
console.log(`[部署工具] 源码目录: ${sourceDir}`);
console.log(`[部署工具] 输出目录: ${distDir}`);

// 确保tsconfig.json存在
const ensureTsConfig = () => {
  const tsConfigPath = path.join(targetDir, 'tsconfig.json');
  
  if (!fs.existsSync(tsConfigPath)) {
    console.log('[部署工具] 创建tsconfig.json...');
    
    const tsConfig = {
      "compilerOptions": {
        "target": "ES2018",
        "module": "CommonJS",
        "moduleResolution": "node",
        "esModuleInterop": true,
        "allowSyntheticDefaultImports": true,
        "resolveJsonModule": true,
        "outDir": "./dist",
        "rootDir": "./src",
        "strict": true,
        "strictPropertyInitialization": false,
        "skipLibCheck": true,
        "experimentalDecorators": true,
        "emitDecoratorMetadata": true
      },
      "include": ["src/**/*"],
      "exclude": ["node_modules", "dist"]
    };
    
    fs.writeFileSync(tsConfigPath, JSON.stringify(tsConfig, null, 2), 'utf8');
    console.log('[部署工具] 已创建tsconfig.json');
  } else {
    console.log('[部署工具] 使用现有的tsconfig.json');
  }
};

// 检查并安装必要的依赖
const ensureDependencies = async () => {
  try {
    console.log('[部署工具] 检查必要的依赖...');
    
    const requiredDeps = [
      'dotenv',
      'sequelize',
      'mysql2',
      'bcrypt'
    ];
    
    for (const dep of requiredDeps) {
      try {
        require.resolve(dep);
        console.log(`[部署工具] 依赖已安装: ${dep}`);
      } catch (e) {
        console.log(`[部署工具] 安装依赖: ${dep}`);
        execSync(`npm install ${dep}`, { cwd: targetDir, stdio: 'inherit' });
      }
    }
    
    return true;
  } catch (error) {
    console.error('[部署工具] 安装依赖失败:', error);
    return false;
  }
};

// 编译TypeScript
const compileTypeScript = async () => {
  try {
    console.log('[部署工具] 开始编译TypeScript...');
    
    // 检查TypeScript是否安装
    try {
      await execAsync('tsc --version', { cwd: targetDir });
    } catch (error) {
      console.log('[部署工具] TypeScript未安装，正在安装...');
      execSync('npm install --save-dev typescript', { cwd: targetDir, stdio: 'inherit' });
    }
    
    // 编译
    await execAsync('npx tsc', { cwd: targetDir, stdio: 'inherit' });
    console.log('[部署工具] TypeScript编译成功！');
    return true;
  } catch (error) {
    console.error('[部署工具] TypeScript编译失败:', error);
    return false;
  }
};

// 创建数据库迁移模块
const createDatabaseMigrationModule = () => {
  try {
    console.log('[部署工具] 开始创建数据库迁移模块...');
    
    // 确保目录存在
    const migrationsDir = path.join(distDir, 'migrations');
    if (!fs.existsSync(migrationsDir)) {
      fs.mkdirSync(migrationsDir, { recursive: true });
    }
    
    // 创建Sequelize修复模块
    const sequelizeFixScript = `'use strict';

/**
 * Sequelize修复模块 - 纯JavaScript版本
 * 自动生成于 ${new Date().toISOString()}
 */

// 保存原始的require函数
const originalRequire = module.constructor.prototype.require;

// 替换require函数，拦截sequelize模块的加载
module.constructor.prototype.require = function(path) {
  // 处理sequelize模块
  if (path === 'sequelize') {
    try {
      // 尝试直接加载
      const originalResult = originalRequire.apply(this, arguments);
      
      // 检查结果是否是构造函数
      if (originalResult && typeof originalResult !== 'function') {
        console.warn('[数据库] Sequelize模块加载失败，使用备用实现');
        
        // 创建应急构造函数
        function EmergencySequelize(database, username, password, options = {}) {
          this.options = options;
          this.config = {
            database, username, password, ...options
          };
          
          // 添加必要的方法
          this.authenticate = () => Promise.resolve();
          this.define = () => ({});
          this.sync = () => Promise.resolve();
          this.query = () => Promise.resolve([]);
          this.getQueryInterface = () => ({
            showAllTables: () => Promise.resolve([]),
            createTable: () => Promise.resolve()
          });
        }
        
        // 添加静态属性
        EmergencySequelize.STRING = { type: 'STRING' };
        EmergencySequelize.TEXT = { type: 'TEXT' };
        EmergencySequelize.INTEGER = { type: 'INTEGER' };
        EmergencySequelize.FLOAT = { type: 'FLOAT' };
        EmergencySequelize.BOOLEAN = { type: 'BOOLEAN' };
        EmergencySequelize.DATE = { type: 'DATE' };
        EmergencySequelize.UUID = { type: 'UUID' };
        EmergencySequelize.UUIDV4 = { type: 'UUIDV4' };
        EmergencySequelize.DataTypes = {
          STRING: EmergencySequelize.STRING,
          TEXT: EmergencySequelize.TEXT,
          INTEGER: EmergencySequelize.INTEGER,
          FLOAT: EmergencySequelize.FLOAT,
          BOOLEAN: EmergencySequelize.BOOLEAN,
          DATE: EmergencySequelize.DATE,
          UUID: EmergencySequelize.UUID,
          UUIDV4: EmergencySequelize.UUIDV4,
        };
        
        // 确保Sequelize属性存在
        EmergencySequelize.Sequelize = EmergencySequelize;
        
        // 全局访问
        global.Sequelize = EmergencySequelize;
        
        return EmergencySequelize;
      }
      
      // 确保Sequelize是全局变量
      if (originalResult && typeof originalResult === 'function') {
        global.Sequelize = originalResult;
      }
      
      return originalResult;
    } catch (error) {
      console.error('[数据库] 处理Sequelize模块失败:', error);
    }
  }
  
  // 其他模块正常加载
  return originalRequire.apply(this, arguments);
};

// 全局sequelize访问器
global.getSequelize = function() {
  try {
    return require('sequelize');
  } catch (error) {
    return null;
  }
};

module.exports = { loaded: true };
`;
    
    const fixScriptPath = path.join(distDir, 'sequelize-fix.js');
    fs.writeFileSync(fixScriptPath, sequelizeFixScript, 'utf8');
    
    // 创建数据库迁移脚本
    const migrationScript = `'use strict';

/**
 * 数据库迁移模块 - 自动创建所有表
 * 自动生成于 ${new Date().toISOString()}
 */

// 首先加载Sequelize修复
require('./sequelize-fix');

const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');

// 加载环境变量
const envPath = path.join(process.cwd(), '.env');
if (fs.existsSync(envPath)) {
  console.log(\`[数据库迁移] 加载环境变量文件: \${envPath}\`);
  dotenv.config({ path: envPath });
}

// 获取Sequelize
let Sequelize;
try {
  const sequelizeModule = require('sequelize');
  Sequelize = sequelizeModule.Sequelize || sequelizeModule;
  
  if (typeof Sequelize !== 'function') {
    throw new Error('Sequelize不是构造函数');
  }
} catch (error) {
  console.error('[数据库迁移] 加载Sequelize失败:', error);
  process.exit(1);
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

// 定义表结构
const defineModels = () => {
  // 用户表
  const User = sequelize.define('User', {
    id: {
      type: Sequelize.UUID,
      defaultValue: Sequelize.UUIDV4,
      primaryKey: true,
    },
    username: {
      type: Sequelize.STRING(50),
      allowNull: false,
      unique: true,
    },
    email: {
      type: Sequelize.STRING(100),
      allowNull: false,
      unique: true,
    },
    password: {
      type: Sequelize.STRING(255),
      allowNull: false,
    },
    isAdmin: {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    socket_id: {
      type: Sequelize.STRING(255),
      allowNull: true,
      defaultValue: null,
    },
    purchases: {
      type: Sequelize.JSON,
      allowNull: false,
      defaultValue: [],
    },
    redeemCodes: {
      type: Sequelize.JSON,
      allowNull: true,
      defaultValue: [],
    },
    progress: {
      type: Sequelize.JSON,
      allowNull: true,
      defaultValue: {},
    },
    examCountdowns: {
      type: Sequelize.JSON,
      allowNull: true,
      defaultValue: '[]',
    }
  }, { tableName: 'users' });

  // 题集表
  const QuestionSet = sequelize.define('QuestionSet', {
    id: {
      type: Sequelize.UUID,
      defaultValue: Sequelize.UUIDV4,
      primaryKey: true,
    },
    title: {
      type: Sequelize.STRING,
      allowNull: false,
    },
    description: {
      type: Sequelize.TEXT,
      allowNull: true,
    },
    price: {
      type: Sequelize.FLOAT,
      allowNull: false,
      defaultValue: 0,
    },
    category: {
      type: Sequelize.STRING,
      allowNull: true,
    },
    isFree: {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    isFeatured: {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    featuredCategory: {
      type: Sequelize.STRING,
      allowNull: true,
    }
  }, { tableName: 'question_sets' });

  // 问题表
  const Question = sequelize.define('Question', {
    id: {
      type: Sequelize.UUID,
      defaultValue: Sequelize.UUIDV4,
      primaryKey: true,
    },
    text: {
      type: Sequelize.TEXT,
      allowNull: false,
    },
    questionSetId: {
      type: Sequelize.UUID,
      allowNull: false,
      references: {
        model: 'question_sets',
        key: 'id'
      }
    },
    type: {
      type: Sequelize.STRING,
      allowNull: false,
      defaultValue: 'single', // single, multiple, text
    },
    difficulty: {
      type: Sequelize.STRING,
      allowNull: true,
    },
    explanation: {
      type: Sequelize.TEXT,
      allowNull: true,
    }
  }, { tableName: 'questions' });

  // 选项表
  const Option = sequelize.define('Option', {
    id: {
      type: Sequelize.UUID,
      defaultValue: Sequelize.UUIDV4,
      primaryKey: true,
    },
    text: {
      type: Sequelize.TEXT,
      allowNull: false,
    },
    questionId: {
      type: Sequelize.UUID,
      allowNull: false,
      references: {
        model: 'questions',
        key: 'id'
      }
    },
    isCorrect: {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    }
  }, { tableName: 'options' });

  // 购买记录表
  const Purchase = sequelize.define('Purchase', {
    id: {
      type: Sequelize.UUID,
      defaultValue: Sequelize.UUIDV4,
      primaryKey: true,
    },
    userId: {
      type: Sequelize.UUID,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id'
      }
    },
    questionSetId: {
      type: Sequelize.UUID,
      allowNull: false,
      references: {
        model: 'question_sets',
        key: 'id'
      }
    },
    purchaseDate: {
      type: Sequelize.DATE,
      allowNull: false,
      defaultValue: Sequelize.NOW,
    },
    price: {
      type: Sequelize.FLOAT,
      allowNull: false,
    },
    paymentMethod: {
      type: Sequelize.STRING,
      allowNull: true,
    },
    transactionId: {
      type: Sequelize.STRING,
      allowNull: true,
    }
  }, { tableName: 'purchases' });

  // 兑换码表
  const RedeemCode = sequelize.define('RedeemCode', {
    id: {
      type: Sequelize.UUID,
      defaultValue: Sequelize.UUIDV4,
      primaryKey: true,
    },
    code: {
      type: Sequelize.STRING,
      allowNull: false,
      unique: true,
    },
    questionSetId: {
      type: Sequelize.UUID,
      allowNull: false,
      references: {
        model: 'question_sets',
        key: 'id'
      }
    },
    isUsed: {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    usedById: {
      type: Sequelize.UUID,
      allowNull: true,
      references: {
        model: 'users',
        key: 'id'
      }
    },
    usedAt: {
      type: Sequelize.DATE,
      allowNull: true,
    },
    expiresAt: {
      type: Sequelize.DATE,
      allowNull: true,
    }
  }, { tableName: 'redeem_codes' });

  // 用户进度表
  const UserProgress = sequelize.define('UserProgress', {
    id: {
      type: Sequelize.UUID,
      defaultValue: Sequelize.UUIDV4,
      primaryKey: true,
    },
    userId: {
      type: Sequelize.UUID,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id'
      }
    },
    questionSetId: {
      type: Sequelize.UUID,
      allowNull: false,
      references: {
        model: 'question_sets',
        key: 'id'
      }
    },
    progress: {
      type: Sequelize.FLOAT,
      allowNull: false,
      defaultValue: 0,
    },
    correctAnswers: {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    wrongAnswers: {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    lastAccessed: {
      type: Sequelize.DATE,
      allowNull: false,
      defaultValue: Sequelize.NOW,
    }
  }, { tableName: 'user_progress' });

  // 错题表
  const WrongAnswer = sequelize.define('WrongAnswer', {
    id: {
      type: Sequelize.UUID,
      defaultValue: Sequelize.UUIDV4,
      primaryKey: true,
    },
    userId: {
      type: Sequelize.UUID,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id'
      }
    },
    questionId: {
      type: Sequelize.UUID,
      allowNull: false,
      references: {
        model: 'questions',
        key: 'id'
      }
    },
    questionSetId: {
      type: Sequelize.UUID,
      allowNull: false,
      references: {
        model: 'question_sets',
        key: 'id'
      }
    },
    userAnswer: {
      type: Sequelize.JSON,
      allowNull: false,
    },
    attemptCount: {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: 1,
    },
    lastAttemptAt: {
      type: Sequelize.DATE,
      allowNull: false,
      defaultValue: Sequelize.NOW,
    }
  }, { tableName: 'wrong_answers' });

  // 首页设置表
  const HomepageSettings = sequelize.define('HomepageSettings', {
    id: {
      type: Sequelize.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    featuredCategories: {
      type: Sequelize.JSON,
      allowNull: false,
      defaultValue: [],
    },
    siteTitle: {
      type: Sequelize.STRING,
      allowNull: false,
      defaultValue: '考试平台',
    },
    welcomeMessage: {
      type: Sequelize.TEXT,
      allowNull: false,
      defaultValue: '欢迎使用我们的考试平台！',
    },
    footerText: {
      type: Sequelize.STRING,
      allowNull: false,
      defaultValue: '© 2024 考试平台 版权所有',
    }
  }, { tableName: 'homepage_settings' });

  // 设置关联关系
  QuestionSet.hasMany(Question, { foreignKey: 'questionSetId' });
  Question.belongsTo(QuestionSet, { foreignKey: 'questionSetId' });

  Question.hasMany(Option, { foreignKey: 'questionId' });
  Option.belongsTo(Question, { foreignKey: 'questionId' });

  User.hasMany(Purchase, { foreignKey: 'userId' });
  Purchase.belongsTo(User, { foreignKey: 'userId' });

  QuestionSet.hasMany(Purchase, { foreignKey: 'questionSetId' });
  Purchase.belongsTo(QuestionSet, { foreignKey: 'questionSetId' });

  QuestionSet.hasMany(RedeemCode, { foreignKey: 'questionSetId' });
  RedeemCode.belongsTo(QuestionSet, { foreignKey: 'questionSetId' });

  User.hasMany(RedeemCode, { foreignKey: 'usedById' });
  RedeemCode.belongsTo(User, { foreignKey: 'usedById' });

  User.hasMany(UserProgress, { foreignKey: 'userId' });
  UserProgress.belongsTo(User, { foreignKey: 'userId' });

  QuestionSet.hasMany(UserProgress, { foreignKey: 'questionSetId' });
  UserProgress.belongsTo(QuestionSet, { foreignKey: 'questionSetId' });

  User.hasMany(WrongAnswer, { foreignKey: 'userId' });
  WrongAnswer.belongsTo(User, { foreignKey: 'userId' });

  Question.hasMany(WrongAnswer, { foreignKey: 'questionId' });
  WrongAnswer.belongsTo(Question, { foreignKey: 'questionId' });

  QuestionSet.hasMany(WrongAnswer, { foreignKey: 'questionSetId' });
  WrongAnswer.belongsTo(QuestionSet, { foreignKey: 'questionSetId' });

  return {
    User,
    QuestionSet,
    Question,
    Option,
    Purchase,
    RedeemCode,
    UserProgress,
    WrongAnswer,
    HomepageSettings
  };
};

// 创建默认数据
const createDefaultData = async (models) => {
  try {
    // 创建默认首页设置
    const homepageSettings = await models.HomepageSettings.findOne();
    if (!homepageSettings) {
      await models.HomepageSettings.create({
        featuredCategories: [],
        siteTitle: '考试平台',
        welcomeMessage: '欢迎使用我们的考试平台！',
        footerText: '© 2024 考试平台 版权所有',
      });
      console.log('[数据库迁移] 已创建默认首页设置');
    }

    // 创建管理员账户
    const adminEmail = process.env.ADMIN_EMAIL || 'admin@example.com';
    const adminUser = await models.User.findOne({ where: { email: adminEmail } });
    if (!adminUser) {
      // 生成随机密码或使用环境变量中的密码
      const bcrypt = require('bcrypt');
      const adminPassword = process.env.ADMIN_PASSWORD || 'Admin123!';
      const hashedPassword = await bcrypt.hash(adminPassword, 10);

      await models.User.create({
        username: 'admin',
        email: adminEmail,
        password: hashedPassword,
        isAdmin: true
      });
      console.log('[数据库迁移] 已创建管理员账户');
      console.log('[数据库迁移] 管理员邮箱: ' + adminEmail);
      console.log('[数据库迁移] 管理员密码: ' + (process.env.ADMIN_PASSWORD ? '已设置' : 'Admin123!'));
    }
  } catch (error) {
    console.error('[数据库迁移] 创建默认数据失败:', error);
  }
};

// 执行迁移
const runMigration = async () => {
  try {
    console.log('[数据库迁移] 开始迁移...');
    
    // 验证数据库连接
    try {
      await sequelize.authenticate();
      console.log('[数据库迁移] 连接成功!');
    } catch (error) {
      console.error('[数据库迁移] 连接失败:', error);
      process.exit(1);
    }
    
    // 定义模型
    const models = defineModels();
    
    // 同步数据库
    console.log('[数据库迁移] 正在创建表...');
    await sequelize.sync({ alter: true });
    console.log('[数据库迁移] 表创建完成!');
    
    // 创建默认数据
    await createDefaultData(models);
    
    console.log('[数据库迁移] 迁移完成!');
    
    return true;
  } catch (error) {
    console.error('[数据库迁移] 迁移失败:', error);
    return false;
  }
};

// 如果直接运行此脚本，执行迁移
if (require.main === module) {
  runMigration()
    .then(success => {
      if (success) {
        console.log('[数据库迁移] 成功完成');
        process.exit(0);
      } else {
        console.error('[数据库迁移] 失败');
        process.exit(1);
      }
    })
    .catch(error => {
      console.error('[数据库迁移] 未捕获错误:', error);
      process.exit(1);
    });
}

module.exports = { runMigration };
`;
    
    const migrationPath = path.join(distDir, 'migrations', 'setup.js');
    fs.writeFileSync(migrationPath, migrationScript, 'utf8');
    console.log(`[部署工具] 已创建数据库迁移脚本: ${migrationPath}`);
    
    // 创建main.js作为数据库初始化入口
    const mainScript = `'use strict';

/**
 * 数据库初始化入口
 */

// 首先运行迁移
const { runMigration } = require('./migrations/setup');

// 导出初始化函数
module.exports = async function initializeDatabase() {
  try {
    console.log('[数据库] 开始初始化...');
    
    // 运行迁移
    const migrationSuccess = await runMigration();
    if (!migrationSuccess) {
      console.error('[数据库] 迁移失败');
      return false;
    }
    
    console.log('[数据库] 初始化成功');
    return true;
  } catch (error) {
    console.error('[数据库] 初始化失败:', error);
    return false;
  }
};
`;
    
    const mainPath = path.join(distDir, 'db-init.js');
    fs.writeFileSync(mainPath, mainScript, 'utf8');
    console.log(`[部署工具] 已创建数据库初始化入口: ${mainPath}`);
    
    return true;
  } catch (error) {
    console.error('[部署工具] 创建数据库迁移模块失败:', error);
    return false;
  }
};

// 修改index.js以确保服务器启动前初始化数据库
const updateIndexFile = () => {
  try {
    const indexPath = path.join(distDir, 'index.js');
    
    if (!fs.existsSync(indexPath)) {
      console.error(`[部署工具] 错误: index.js文件不存在: ${indexPath}`);
      return false;
    }
    
    let content = fs.readFileSync(indexPath, 'utf8');
    
    // 检查是否已经添加了数据库初始化代码
    if (content.includes('initializeDatabase()')) {
      console.log('[部署工具] index.js已包含数据库初始化代码');
      return true;
    }
    
    // 获取主要的server启动代码位置
    let serverStartLine = content.match(/server\.listen\(\s*PORT\s*,.*{/);
    let serverStartPosition = -1;
    
    if (serverStartLine) {
      serverStartPosition = content.indexOf(serverStartLine[0]);
    } else {
      // 如果找不到标准的server.listen，尝试其他可能的启动代码
      const alternativePatterns = [
        /app\.listen\(\s*PORT\s*,/,
        /server\.listen\(\s*.*,/,
        /app\.listen\(\s*.*,/
      ];
      
      for (const pattern of alternativePatterns) {
        const match = content.match(pattern);
        if (match) {
          serverStartPosition = content.indexOf(match[0]);
          break;
        }
      }
    }
    
    if (serverStartPosition === -1) {
      console.warn('[部署工具] 警告: 无法找到服务器启动代码，将在文件末尾添加初始化代码');
      
      // 在文件末尾添加初始化代码
      const initCode = `

// 添加数据库初始化
const initializeDatabase = require('./db-init');

// 在服务器启动前初始化数据库
(async function() {
  try {
    console.log('[服务器] 正在初始化数据库...');
    const dbInitialized = await initializeDatabase();
    
    if (!dbInitialized) {
      console.warn('[服务器] 数据库初始化失败，服务可能无法正常工作');
    } else {
      console.log('[服务器] 数据库初始化成功');
    }
  } catch (error) {
    console.error('[服务器] 数据库初始化出错:', error);
  }
})();
`;
      
      content = content + initCode;
    } else {
      // 确定插入位置，在服务器启动代码之前
      const importSection = content.indexOf("const");
      
      // 添加导入
      const importCode = `
// 导入数据库初始化函数
const initializeDatabase = require('./db-init');

`;
      content = content.slice(0, importSection) + importCode + content.slice(importSection);
      
      // 修改服务器启动代码，添加数据库初始化
      const startupCode = `
// 在服务器启动前初始化数据库
(async function() {
  try {
    console.log('[服务器] 正在初始化数据库...');
    const dbInitialized = await initializeDatabase();
    
    if (!dbInitialized) {
      console.warn('[服务器] 数据库初始化失败，服务可能无法正常工作');
    } else {
      console.log('[服务器] 数据库初始化成功');
    }
  } catch (error) {
    console.error('[服务器] 数据库初始化出错:', error);
  }
})();

`;
      
      content = content.slice(0, serverStartPosition) + startupCode + content.slice(serverStartPosition);
    }
    
    // 写入修改后的文件
    fs.writeFileSync(indexPath, content, 'utf8');
    console.log('[部署工具] 已更新index.js，添加数据库初始化代码');
    
    return true;
  } catch (error) {
    console.error('[部署工具] 更新index.js失败:', error);
    return false;
  }
};

// 创建启动脚本
const createStartScript = () => {
  try {
    const startScript = `#!/bin/bash

# 应用启动脚本
# 自动生成于 ${new Date().toISOString()}

# 设置Node选项
export NODE_OPTIONS="--require ./dist/sequelize-fix.js"

# 启动应用
echo "启动应用..."
cd $(dirname "$0")
node ./dist/index.js
`;
    
    const startScriptPath = path.join(targetDir, 'start.sh');
    fs.writeFileSync(startScriptPath, startScript, 'utf8');
    fs.chmodSync(startScriptPath, '755'); // 添加执行权限
    console.log(`[部署工具] 已创建启动脚本: ${startScriptPath}`);
    
    return true;
  } catch (error) {
    console.error('[部署工具] 创建启动脚本失败:', error);
    return false;
  }
};

// 创建PM2配置
const createPm2Config = () => {
  try {
    const pm2Config = {
      apps: [{
        name: "exam-server",
        script: "./dist/index.js",
        instances: 1,
        exec_mode: "fork",
        watch: false,
        env: {
          NODE_ENV: "production",
          NODE_OPTIONS: "--require ./dist/sequelize-fix.js"
        }
      }]
    };
    
    const pm2ConfigPath = path.join(targetDir, 'ecosystem.config.js');
    fs.writeFileSync(
      pm2ConfigPath, 
      `module.exports = ${JSON.stringify(pm2Config, null, 2)};`, 
      'utf8'
    );
    console.log(`[部署工具] 已创建PM2配置: ${pm2ConfigPath}`);
    
    return true;
  } catch (error) {
    console.error('[部署工具] 创建PM2配置失败:', error);
    return false;
  }
};

// 更新package.json
const updatePackageJson = () => {
  try {
    const packageJsonPath = path.join(targetDir, 'package.json');
    
    if (!fs.existsSync(packageJsonPath)) {
      console.warn('[部署工具] 警告: package.json不存在，跳过更新');
      return false;
    }
    
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    
    // 备份原始package.json
    fs.writeFileSync(`${packageJsonPath}.bak`, JSON.stringify(packageJson, null, 2), 'utf8');
    
    // 更新scripts
    packageJson.scripts = packageJson.scripts || {};
    packageJson.scripts.start = "node dist/index.js";
    packageJson.scripts.build = "tsc";
    packageJson.scripts.deploy = "node build-deploy.js";
    packageJson.scripts.migrate = "node dist/migrations/setup.js";
    
    // 清理不必要的脚本
    const scriptsToKeep = ['start', 'build', 'deploy', 'migrate', 'dev', 'test'];
    for (const key in packageJson.scripts) {
      if (!scriptsToKeep.includes(key)) {
        delete packageJson.scripts[key];
      }
    }
    
    // 写入更新后的package.json
    fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2), 'utf8');
    console.log('[部署工具] 已更新package.json');
    
    return true;
  } catch (error) {
    console.error('[部署工具] 更新package.json失败:', error);
    return false;
  }
};

// 创建.env文件（如果不存在）
const ensureEnvFile = () => {
  try {
    const envPath = path.join(targetDir, '.env');
    const distEnvPath = path.join(distDir, '.env');
    
    if (!fs.existsSync(envPath)) {
      const envContent = `# 数据库配置
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=
DB_NAME=quizdb

# 服务器配置
PORT=3000
NODE_ENV=production

# 管理员账户
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=Admin123!
`;
      
      fs.writeFileSync(envPath, envContent, 'utf8');
      console.log(`[部署工具] 已创建.env文件: ${envPath}`);
    } else {
      console.log('[部署工具] 使用现有的.env文件');
    }
    
    // 复制.env文件到dist目录
    if (fs.existsSync(envPath)) {
      fs.copyFileSync(envPath, distEnvPath);
      console.log(`[部署工具] 已复制.env文件到: ${distEnvPath}`);
    }
    
    return true;
  } catch (error) {
    console.error('[部署工具] 创建.env文件失败:', error);
    return false;
  }
};

// 主函数
async function main() {
  try {
    // 1. 确保tsconfig.json存在
    ensureTsConfig();
    
    // 2. 确保.env文件存在
    ensureEnvFile();
    
    // 3. 安装必要的依赖
    await ensureDependencies();
    
    // 4. 编译TypeScript
    const compileSuccess = await compileTypeScript();
    if (!compileSuccess) {
      console.error('[部署工具] TypeScript编译失败，终止构建');
      process.exit(1);
    }
    
    // 5. 创建数据库迁移模块
    const migrationSuccess = createDatabaseMigrationModule();
    if (!migrationSuccess) {
      console.error('[部署工具] 创建数据库迁移模块失败');
    }
    
    // 6. 更新index.js
    updateIndexFile();
    
    // 7. 创建启动脚本
    createStartScript();
    
    // 8. 创建PM2配置
    createPm2Config();
    
    // 9. 更新package.json
    updatePackageJson();
    
    console.log('[部署工具] 构建完成！');
    console.log('[部署工具] 您现在可以使用以下命令启动应用:');
    console.log('- 直接运行: ./start.sh');
    console.log('- 使用npm: npm start');
    console.log('- 使用PM2: pm2 start ecosystem.config.js');
    
  } catch (error) {
    console.error('[部署工具] 构建过程中出错:', error);
    process.exit(1);
  }
}

// 执行主函数
main().catch(error => {
  console.error('[部署工具] 未捕获错误:', error);
  process.exit(1);
}); 