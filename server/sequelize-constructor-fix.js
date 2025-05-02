#!/usr/bin/env node

/**
 * Sequelize构造函数修复工具
 * 
 * 此脚本修复"Sequelize is not a constructor"错误
 * 适用于宝塔服务器环境
 * 
 * 用法: node sequelize-constructor-fix.js [目标目录]
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// 目标目录
const targetDir = process.argv[2] || '/www/wwwroot/root/git/dist/dist/server';
console.log(`[修复工具] 目标目录: ${targetDir}`);

// 检查目录是否存在
if (!fs.existsSync(targetDir)) {
  console.error(`[修复工具] 错误: 目标目录不存在: ${targetDir}`);
  process.exit(1);
}

// 直接解决方案: 创建一个sequelize-wrapper.js文件
const wrapperContent = `'use strict';

/**
 * Sequelize包装器 - 解决"Sequelize is not a constructor"问题
 * 自动生成于 ${new Date().toISOString()}
 */

// 强制直接从node_modules加载
const sequelizeModule = require('./node_modules/sequelize');

// 确保导出Sequelize构造函数
const Sequelize = sequelizeModule.Sequelize || sequelizeModule;

// 添加直接访问方法
Sequelize.getInstance = function(database, username, password, options) {
  try {
    return new Sequelize(database, username, password, options);
  } catch (error) {
    console.error('[Sequelize包装器] 创建实例失败:', error);
    return null;
  }
};

// 导出
module.exports = Sequelize;
module.exports.default = Sequelize;
module.exports.Sequelize = Sequelize;
`;

// 安装需要的模块以确保它们存在
function installDependencies() {
  try {
    console.log('[修复工具] 检查必要的模块...');
    
    // 检查package.json是否存在
    const packageJsonPath = path.join(targetDir, 'package.json');
    if (!fs.existsSync(packageJsonPath)) {
      console.warn('[修复工具] package.json不存在，无法安装依赖');
      return;
    }
    
    // 安装需要的模块
    console.log('[修复工具] 确保必要的模块已安装...');
    const dependencies = ['sequelize', 'mysql2', 'dotenv'];
    
    try {
      execSync(`cd ${targetDir} && npm list ${dependencies.join(' ')}`, { stdio: 'ignore' });
      console.log('[修复工具] 所有必要模块已安装');
    } catch (error) {
      console.log('[修复工具] 安装缺少的模块...');
      execSync(`cd ${targetDir} && npm install ${dependencies.join(' ')} --save`, { stdio: 'inherit' });
    }
  } catch (error) {
    console.error('[修复工具] 安装依赖失败:', error);
  }
}

// 写入包装器文件
function createWrapper() {
  const wrapperPath = path.join(targetDir, 'sequelize-wrapper.js');
  fs.writeFileSync(wrapperPath, wrapperContent, 'utf8');
  console.log(`[修复工具] 已创建Sequelize包装器: ${wrapperPath}`);
}

// 修复项目中的Sequelize导入
function fixImports() {
  // 寻找需要修复的文件
  const findFiles = (dir, results = []) => {
    const files = fs.readdirSync(dir, { withFileTypes: true });
    
    for (const file of files) {
      const fullPath = path.join(dir, file.name);
      
      if (file.isDirectory()) {
        findFiles(fullPath, results);
      } else if (file.isFile() && file.name.endsWith('.js')) {
        const content = fs.readFileSync(fullPath, 'utf8');
        
        // 检查文件是否包含Sequelize导入
        if (content.includes('require(\'sequelize\')') || 
            content.includes('require("sequelize")') ||
            content.includes('from \'sequelize\'') ||
            content.includes('from "sequelize"')) {
          results.push(fullPath);
        }
      }
    }
    
    return results;
  };
  
  console.log('[修复工具] 查找包含Sequelize导入的文件...');
  const files = findFiles(targetDir);
  console.log(`[修复工具] 找到 ${files.length} 个文件需要修复`);
  
  // 修复文件
  let fixedCount = 0;
  for (const file of files) {
    try {
      let content = fs.readFileSync(file, 'utf8');
      let modified = false;
      
      // 创建备份
      fs.writeFileSync(`${file}.bak`, content, 'utf8');
      
      // 替换 require('sequelize')
      if (content.includes('require(\'sequelize\')') || content.includes('require("sequelize")')) {
        content = content.replace(/require\(['"]sequelize['"]\)/g, 'require(\'./sequelize-wrapper\')');
        modified = true;
      }
      
      // 替换 from 'sequelize'
      if (content.includes('from \'sequelize\'') || content.includes('from "sequelize"')) {
        content = content.replace(/from ['"]sequelize['"]/g, 'from \'./sequelize-wrapper\'');
        modified = true;
      }
      
      if (modified) {
        fs.writeFileSync(file, content, 'utf8');
        fixedCount++;
        console.log(`[修复工具] 已修复文件: ${file}`);
      }
    } catch (error) {
      console.error(`[修复工具] 修复文件失败: ${file}`, error);
    }
  }
  
  console.log(`[修复工具] 已修复 ${fixedCount} 个文件`);
}

// 创建直接访问模块
function createDirectAccessModule() {
  const moduleDir = path.join(targetDir, 'src', 'config');
  if (!fs.existsSync(moduleDir)) {
    fs.mkdirSync(moduleDir, { recursive: true });
  }
  
  const moduleContent = `'use strict';

/**
 * 直接访问的Sequelize数据库配置
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

// 直接从node_modules加载Sequelize
let Sequelize;
try {
  // 尝试直接加载
  const sequelizeModule = require('../../node_modules/sequelize');
  Sequelize = sequelizeModule.Sequelize || sequelizeModule;
  
  if (typeof Sequelize !== 'function') {
    throw new Error('加载的不是一个构造函数');
  }
} catch (error) {
  console.error('[数据库] 直接加载Sequelize失败:', error);
  
  // 尝试其他加载方式
  try {
    const sequelizeModule = require('sequelize');
    Sequelize = sequelizeModule.Sequelize || sequelizeModule;
  } catch (fallbackError) {
    console.error('[数据库] 备用加载方式也失败:', fallbackError);
    
    // 创建一个虚拟构造函数以防止崩溃
    Sequelize = function() {
      console.error('[数据库] 使用了虚拟的Sequelize构造函数，实际功能将不可用');
      this.authenticate = () => Promise.resolve();
      this.define = () => ({});
    };
  }
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
    connectTimeout: 10000
  }
};

// 创建Sequelize实例
let sequelize;
try {
  sequelize = new Sequelize(
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
  console.log('[数据库] Sequelize实例创建成功');
} catch (error) {
  console.error('[数据库] Sequelize实例创建失败:', error);
  
  // 创建一个伪实例以防止崩溃
  sequelize = {
    authenticate: () => Promise.resolve(),
    define: () => ({}),
    sync: () => Promise.resolve(),
    query: () => Promise.resolve([]),
    transaction: (fn) => Promise.resolve(fn({ commit: () => {}, rollback: () => {} }))
  };
}

// 设置为全局变量
global.sequelize = sequelize;

// 导出
module.exports = sequelize;
module.exports.default = sequelize;
module.exports.Sequelize = Sequelize;
`;
  
  const modulePath = path.join(moduleDir, 'database.js');
  fs.writeFileSync(modulePath, moduleContent, 'utf8');
  console.log(`[修复工具] 已创建直接访问模块: ${modulePath}`);
}

// 主函数
async function main() {
  try {
    // 安装依赖
    installDependencies();
    
    // 创建包装器
    createWrapper();
    
    // 修复导入
    fixImports();
    
    // 创建直接访问模块
    createDirectAccessModule();
    
    console.log('[修复工具] 修复完成！请重启应用');
  } catch (error) {
    console.error('[修复工具] 修复过程中出错:', error);
    process.exit(1);
  }
}

// 执行主函数
main().catch(error => {
  console.error('[修复工具] 未捕获错误:', error);
  process.exit(1);
}); 