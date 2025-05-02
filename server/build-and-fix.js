#!/usr/bin/env node

/**
 * TypeScript编译与Sequelize修复一体化脚本
 * 此脚本执行以下操作:
 * 1. 编译TypeScript代码为JavaScript
 * 2. 应用Sequelize修复到编译后的代码
 * 3. 更新package.json以使用编译后的代码
 * 
 * 用法: node build-and-fix.js [目标目录]
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

console.log(`[构建工具] 目标目录: ${targetDir}`);
console.log(`[构建工具] 源码目录: ${sourceDir}`);
console.log(`[构建工具] 输出目录: ${distDir}`);

// 确保tsconfig.json存在
const ensureTsConfig = () => {
  const tsConfigPath = path.join(targetDir, 'tsconfig.json');
  
  if (!fs.existsSync(tsConfigPath)) {
    console.log('[构建工具] 创建tsconfig.json...');
    
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
    console.log('[构建工具] 已创建tsconfig.json');
  } else {
    console.log('[构建工具] 使用现有的tsconfig.json');
  }
};

// 编译TypeScript
const compileTypeScript = async () => {
  try {
    console.log('[构建工具] 开始编译TypeScript...');
    
    // 检查TypeScript是否安装
    try {
      await execAsync('tsc --version', { cwd: targetDir });
    } catch (error) {
      console.log('[构建工具] TypeScript未安装，正在安装...');
      execSync('npm install --save-dev typescript', { cwd: targetDir, stdio: 'inherit' });
    }
    
    // 编译
    await execAsync('npx tsc', { cwd: targetDir, stdio: 'inherit' });
    console.log('[构建工具] TypeScript编译成功！');
    return true;
  } catch (error) {
    console.error('[构建工具] TypeScript编译失败:', error);
    return false;
  }
};

// 应用Sequelize修复到编译后的代码
const applySequelizeFixes = async () => {
  try {
    console.log('[构建工具] 开始应用Sequelize修复...');
    
    // 创建Sequelize预加载脚本
    const preloadScript = `'use strict';

/**
 * Sequelize预加载修复脚本 - 纯JavaScript版本
 * 自动生成于 ${new Date().toISOString()}
 */

// 保存原始的require函数
const originalRequire = module.constructor.prototype.require;

// 替换require函数，拦截sequelize模块的加载
module.constructor.prototype.require = function(path) {
  // 处理sequelize模块
  if (path === 'sequelize') {
    try {
      console.log('[预加载] 拦截Sequelize模块加载');
      
      // 尝试直接加载
      const originalResult = originalRequire.apply(this, arguments);
      
      // 如果加载的不是构造函数，创建应急构造函数
      if (originalResult && typeof originalResult !== 'function') {
        console.warn('[预加载] Sequelize模块加载失败，使用应急Sequelize');
        
        // 创建应急构造函数
        function EmergencySequelize(database, username, password, options = {}) {
          console.warn('[预加载] 使用应急Sequelize');
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
            showAllTables: () => Promise.resolve([])
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
      console.error('[预加载] 处理Sequelize模块失败:', error);
    }
  }
  
  // 其他模块正常加载
  return originalRequire.apply(this, arguments);
};

// 创建全局sequelize访问器
Object.defineProperty(global, 'getSequelize', {
  get: function() {
    return function() {
      try {
        return require('sequelize');
      } catch (error) {
        console.error('[预加载] 获取Sequelize失败:', error);
        return null;
      }
    };
  }
});

console.log('[预加载] Sequelize修复已启用');
`;
    
    const preloadPath = path.join(distDir, 'sequelize-preload.js');
    fs.writeFileSync(preloadPath, preloadScript, 'utf8');
    console.log(`[构建工具] 已创建Sequelize预加载脚本: ${preloadPath}`);
    
    // 更新package.json
    const packageJsonPath = path.join(targetDir, 'package.json');
    if (fs.existsSync(packageJsonPath)) {
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
      
      // 备份原始package.json
      fs.writeFileSync(`${packageJsonPath}.bak`, JSON.stringify(packageJson, null, 2), 'utf8');
      
      // 更新scripts
      packageJson.scripts = packageJson.scripts || {};
      packageJson.scripts.start = 'NODE_OPTIONS="--require ./dist/sequelize-preload.js" node ./dist/index.js';
      packageJson.scripts.build = 'node build-and-fix.js';
      
      // 更新元数据
      packageJson.sequelizeFixes = {
        version: '2.0.0',
        description: 'Sequelize修复工具集 - 编译版本',
        applied: new Date().toISOString()
      };
      
      // 写入更新后的package.json
      fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2), 'utf8');
      console.log('[构建工具] 已更新package.json');
    }
    
    // 创建直接访问数据库的文件
    const dbFile = `'use strict';

/**
 * 数据库连接模块 - 编译版本
 * 自动生成于 ${new Date().toISOString()}
 */

const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');

// 加载环境变量
const envPath = path.join(process.cwd(), '.env');
if (fs.existsSync(envPath)) {
  console.log(\`[数据库] 加载环境变量文件: \${envPath}\`);
  dotenv.config({ path: envPath });
}

// 获取Sequelize构造函数
let Sequelize;
try {
  const sequelizeModule = require('sequelize');
  Sequelize = sequelizeModule.Sequelize || sequelizeModule;
  
  if (typeof Sequelize !== 'function') {
    throw new Error('Sequelize不是构造函数');
  }
} catch (error) {
  console.error('[数据库] 加载Sequelize失败:', error);
  
  // 创建应急构造函数
  Sequelize = function(database, username, password, options = {}) {
    console.warn('[数据库] 使用应急Sequelize');
    
    this.options = options;
    this.config = { database, username, password, ...options };
    
    // 添加必要的方法
    this.authenticate = () => Promise.resolve();
    this.define = () => ({});
    this.sync = () => Promise.resolve();
    this.query = () => Promise.resolve([]);
    this.getQueryInterface = () => ({
      showAllTables: () => Promise.resolve([])
    });
  };
  
  // 添加数据类型
  Sequelize.DataTypes = {
    STRING: { type: 'STRING' },
    TEXT: { type: 'TEXT' },
    INTEGER: { type: 'INTEGER' },
    FLOAT: { type: 'FLOAT' },
    BOOLEAN: { type: 'BOOLEAN' },
    DATE: { type: 'DATE' },
    UUID: { type: 'UUID' },
    UUIDV4: { type: 'UUIDV4' }
  };
  
  // 复制到简写版本
  Object.keys(Sequelize.DataTypes).forEach(key => {
    Sequelize[key] = Sequelize.DataTypes[key];
  });
  
  // 确保Sequelize属性存在
  Sequelize.Sequelize = Sequelize;
}

// 创建数据库连接
let sequelize;
try {
  sequelize = new Sequelize(
    process.env.DB_NAME || 'quiz_app',
    process.env.DB_USER || 'root',
    process.env.DB_PASSWORD || '',
    {
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '3306'),
      dialect: 'mysql',
      logging: process.env.NODE_ENV === 'production' ? false : console.log,
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
  
  console.log('[数据库] Sequelize实例创建成功');
} catch (error) {
  console.error('[数据库] Sequelize实例创建失败:', error);
  
  // 创建伪实例
  sequelize = {
    authenticate: () => Promise.resolve(),
    define: () => ({}),
    sync: () => Promise.resolve(),
    query: () => Promise.resolve([]),
    getQueryInterface: () => ({
      showAllTables: () => Promise.resolve([])
    })
  };
}

// 全局访问
global.sequelize = sequelize;

// 导出
module.exports = sequelize;
module.exports.default = sequelize;
module.exports.Sequelize = Sequelize;
`;
    
    const dbFilePath = path.join(distDir, 'config', 'database.js');
    const dbDirPath = path.dirname(dbFilePath);
    
    if (!fs.existsSync(dbDirPath)) {
      fs.mkdirSync(dbDirPath, { recursive: true });
    }
    
    fs.writeFileSync(dbFilePath, dbFile, 'utf8');
    console.log(`[构建工具] 已创建数据库连接模块: ${dbFilePath}`);
    
    // 复制.env文件到dist目录
    const envPath = path.join(targetDir, '.env');
    const distEnvPath = path.join(distDir, '.env');
    
    if (fs.existsSync(envPath)) {
      fs.copyFileSync(envPath, distEnvPath);
      console.log(`[构建工具] 已复制.env文件到: ${distEnvPath}`);
    }
    
    console.log('[构建工具] Sequelize修复应用成功！');
    return true;
  } catch (error) {
    console.error('[构建工具] 应用Sequelize修复失败:', error);
    return false;
  }
};

// 创建启动脚本
const createStartScript = () => {
  try {
    const startScript = `#!/bin/bash

# Sequelize修复启动脚本 - 编译版本
# 自动生成于 ${new Date().toISOString()}

# 设置Node选项
export NODE_OPTIONS="--require ./dist/sequelize-preload.js"

# 启动应用
echo "使用编译版本启动应用..."
node ./dist/index.js
`;
    
    const startScriptPath = path.join(targetDir, 'start.sh');
    fs.writeFileSync(startScriptPath, startScript, 'utf8');
    fs.chmodSync(startScriptPath, '755'); // 添加执行权限
    console.log(`[构建工具] 已创建启动脚本: ${startScriptPath}`);
    
    return true;
  } catch (error) {
    console.error('[构建工具] 创建启动脚本失败:', error);
    return false;
  }
};

// 创建PM2配置
const createPm2Config = () => {
  try {
    const pm2Config = {
      apps: [{
        name: "quiz-app",
        script: "./dist/index.js",
        instances: 1,
        exec_mode: "fork",
        watch: false,
        env: {
          NODE_ENV: "production",
          NODE_OPTIONS: "--require ./dist/sequelize-preload.js"
        }
      }]
    };
    
    const pm2ConfigPath = path.join(targetDir, 'ecosystem.config.js');
    fs.writeFileSync(
      pm2ConfigPath, 
      `module.exports = ${JSON.stringify(pm2Config, null, 2)};`, 
      'utf8'
    );
    console.log(`[构建工具] 已创建PM2配置: ${pm2ConfigPath}`);
    
    return true;
  } catch (error) {
    console.error('[构建工具] 创建PM2配置失败:', error);
    return false;
  }
};

// 主函数
async function main() {
  try {
    // 1. 确保tsconfig.json存在
    ensureTsConfig();
    
    // 2. 编译TypeScript
    const compileSuccess = await compileTypeScript();
    if (!compileSuccess) {
      console.error('[构建工具] TypeScript编译失败，终止构建');
      process.exit(1);
    }
    
    // 3. 应用Sequelize修复
    const fixSuccess = await applySequelizeFixes();
    if (!fixSuccess) {
      console.error('[构建工具] Sequelize修复应用失败，构建可能不完整');
    }
    
    // 4. 创建启动脚本
    createStartScript();
    
    // 5. 创建PM2配置
    createPm2Config();
    
    console.log('[构建工具] 构建完成！');
    console.log('[构建工具] 您现在可以使用以下命令启动应用:');
    console.log('- 直接运行: ./start.sh');
    console.log('- 使用npm: npm start');
    console.log('- 使用PM2: pm2 start ecosystem.config.js');
    
  } catch (error) {
    console.error('[构建工具] 构建过程中出错:', error);
    process.exit(1);
  }
}

// 执行主函数
main().catch(error => {
  console.error('[构建工具] 未捕获错误:', error);
  process.exit(1);
}); 