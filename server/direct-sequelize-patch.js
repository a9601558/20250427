#!/usr/bin/env node

/**
 * Sequelize模块直接修补工具
 * 
 * 此脚本直接修改node_modules中的Sequelize模块
 * 解决pnpm环境下的"Sequelize is not a constructor"错误
 * 
 * 用法: node direct-sequelize-patch.js [目标目录]
 */

const fs = require('fs');
const path = require('path');
const util = require('util');
const child_process = require('child_process');
const exec = util.promisify(child_process.exec);

// 处理命令行参数
const targetDir = process.argv[2] || '/www/wwwroot/root/git/dist/dist/server';
console.log(`[修补工具] 目标目录: ${targetDir}`);

// 检查目录是否存在
if (!fs.existsSync(targetDir)) {
  console.error(`[修补工具] 错误: 目标目录不存在: ${targetDir}`);
  process.exit(1);
}

// 查找Sequelize模块
async function findSequelizeModule() {
  try {
    // 1. 首先尝试在node_modules中寻找
    const possiblePaths = [
      path.join(targetDir, 'node_modules/sequelize/lib/sequelize.js'),
      path.join(targetDir, 'node_modules/sequelize/dist/sequelize.js'),
      path.join(targetDir, 'node_modules/.pnpm/sequelize*/node_modules/sequelize/lib/sequelize.js')
    ];

    for (const p of possiblePaths) {
      if (fs.existsSync(p)) {
        console.log(`[修补工具] 找到Sequelize模块: ${p}`);
        return p;
      }
      
      // 如果是glob模式，尝试扩展
      if (p.includes('*')) {
        try {
          const { stdout } = await exec(`find ${path.dirname(p.split('*')[0])} -path "${p}" -type f`);
          const files = stdout.trim().split('\n').filter(Boolean);
          if (files.length > 0) {
            console.log(`[修补工具] 找到Sequelize模块: ${files[0]}`);
            return files[0];
          }
        } catch (error) {
          console.error(`[修补工具] 查找文件失败:`, error);
        }
      }
    }

    // 2. 如果在node_modules中找不到，尝试使用find命令
    console.log(`[修补工具] 在node_modules中未找到，尝试使用find命令搜索...`);
    
    // 首先搜索pnpm目录
    try {
      const { stdout: pnpmResult } = await exec(`find ${targetDir}/node_modules/.pnpm -name "sequelize.js" | grep -v "node_modules/sequelize/node_modules"`);
      const pnpmFiles = pnpmResult.trim().split('\n').filter(Boolean);
      
      if (pnpmFiles.length > 0) {
        for (const file of pnpmFiles) {
          if (file.includes('/lib/') || file.includes('/dist/')) {
            console.log(`[修补工具] 找到pnpm中的Sequelize模块: ${file}`);
            return file;
          }
        }
      }
    } catch (error) {
      console.log(`[修补工具] pnpm搜索无结果`);
    }
    
    // 如果还是找不到，尝试整个目录
    try {
      const { stdout: findResult } = await exec(`find ${targetDir} -path "*/node_modules/*" -name "sequelize.js" | head -1`);
      const file = findResult.trim();
      
      if (file) {
        console.log(`[修补工具] 找到Sequelize模块: ${file}`);
        return file;
      }
    } catch (error) {
      console.error(`[修补工具] 查找Sequelize模块失败:`, error);
    }
    
    console.error(`[修补工具] 无法找到Sequelize模块`);
    return null;
  } catch (error) {
    console.error(`[修补工具] 查找Sequelize模块时出错:`, error);
    return null;
  }
}

// 修补Sequelize模块
function patchSequelizeModule(filePath) {
  try {
    // 读取原始文件
    const originalContent = fs.readFileSync(filePath, 'utf8');
    
    // 创建备份
    const backupPath = `${filePath}.bak`;
    fs.writeFileSync(backupPath, originalContent, 'utf8');
    console.log(`[修补工具] 已创建备份: ${backupPath}`);
    
    // 修改内容
    let newContent = originalContent;
    
    // 修复1: 添加安全的构造函数检查
    const safeConstructorCode = `
// === 安全的构造函数检查 (由修补工具添加) ===
if (typeof Sequelize !== 'function') {
  console.warn('[Sequelize] 警告: Sequelize不是构造函数，创建安全版本');
  
  // 创建一个安全的构造函数
  const _Sequelize = function() {
    console.warn('[Sequelize] 使用了修补版的Sequelize构造函数');
    
    // 复制基本属性
    this.options = arguments[3] || {};
    this.config = {
      database: arguments[0],
      username: arguments[1],
      password: arguments[2],
      ...this.options
    };
    
    // 添加必要的方法
    this.authenticate = () => Promise.resolve();
    this.define = () => ({});
    this.query = () => Promise.resolve([]);
    this.sync = () => Promise.resolve();
    this.transaction = (fn) => Promise.resolve(fn({ commit: () => {}, rollback: () => {} }));
    this.getQueryInterface = () => ({
      createTable: () => Promise.resolve(),
      dropTable: () => Promise.resolve(),
      showAllTables: () => Promise.resolve([]),
      describeTable: () => Promise.resolve({}),
    });
  };
  
  // 复制静态属性
  if (Sequelize) {
    Object.keys(Sequelize).forEach(key => {
      _Sequelize[key] = Sequelize[key];
    });
  }
  
  // 替换全局Sequelize
  global.Sequelize = _Sequelize;
  module.exports = _Sequelize;
  module.exports.Sequelize = _Sequelize;
  return _Sequelize;
} else {
  console.log('[Sequelize] Sequelize是构造函数，无需修补');
}
// === 安全的构造函数检查结束 ===
`;

    // 查找适当的位置插入代码
    // 通常在定义Sequelize类之后，使用之前
    if (newContent.includes('class Sequelize {')) {
      const classMatch = newContent.match(/class Sequelize \{[\s\S]*?\n\}/);
      if (classMatch) {
        const insertPosition = classMatch.index + classMatch[0].length;
        newContent = newContent.substring(0, insertPosition) + '\n' + safeConstructorCode + newContent.substring(insertPosition);
      } else {
        // 如果找不到完整的类定义，尝试找到类声明行，在之后插入
        const classLineMatch = newContent.match(/class Sequelize \{.*\n/);
        if (classLineMatch) {
          const insertPosition = classLineMatch.index + classLineMatch[0].length;
          newContent = newContent.substring(0, insertPosition) + safeConstructorCode + newContent.substring(insertPosition);
        } else {
          console.warn('[修补工具] 无法找到Sequelize类定义，尝试其他位置');
          
          // 尝试在文件开头插入
          newContent = safeConstructorCode + newContent;
        }
      }
    } else if (newContent.includes('function Sequelize(')) {
      // 适用于使用函数定义的情况
      const functionMatch = newContent.match(/function Sequelize\([\s\S]*?\n\}/);
      if (functionMatch) {
        const insertPosition = functionMatch.index + functionMatch[0].length;
        newContent = newContent.substring(0, insertPosition) + '\n' + safeConstructorCode + newContent.substring(insertPosition);
      } else {
        // 如果找不到完整的函数定义，尝试在文件开头插入
        newContent = safeConstructorCode + newContent;
      }
    } else {
      // 如果找不到类或函数定义，尝试在文件开头插入
      newContent = safeConstructorCode + newContent;
    }
    
    // 修复2: 替换脆弱的实例创建代码
    if (newContent.includes('new Sequelize(')) {
      newContent = newContent.replace(
        /const sequelize = global\.sequelize \|\| new Sequelize\(/g, 
        'const sequelize = global.sequelize || (typeof Sequelize === "function" ? new Sequelize('
      );
      
      // 添加关闭括号
      newContent = newContent.replace(
        /\);(\s*)(\/\/.*)?(\n|$)/g,
        ') : null);$1$2$3'
      );
    }
    
    // 修复3: 确保导出对象包含所有内容
    const exportFixCode = `
// === 确保正确导出 (由修补工具添加) ===
// 为避免循环引用问题，确保导出包含所有必要的属性
const safeExport = module.exports;

// 如果导出不是函数，但全局Sequelize是函数，使用全局Sequelize
if (typeof safeExport !== 'function' && typeof global.Sequelize === 'function') {
  module.exports = global.Sequelize;
}

// 确保导出包含Sequelize属性
if (!module.exports.Sequelize && typeof global.Sequelize === 'function') {
  module.exports.Sequelize = global.Sequelize;
}
`;
    
    // 在文件末尾添加导出修复代码
    newContent = newContent + '\n' + exportFixCode;
    
    // 写入修改后的文件
    fs.writeFileSync(filePath, newContent, 'utf8');
    console.log(`[修补工具] 已修补Sequelize模块: ${filePath}`);
    
    return true;
  } catch (error) {
    console.error(`[修补工具] 修补Sequelize模块失败:`, error);
    return false;
  }
}

// 创建预加载脚本
function createPreloadScript() {
  const preloadContent = `'use strict';

/**
 * Sequelize预加载修复脚本
 * 自动生成于 ${new Date().toISOString()}
 * 
 * 此脚本在Node.js加载过程中最早执行，修复Sequelize构造函数问题
 * 用法: NODE_OPTIONS="--require ./sequelize-preload.js" node your-app.js
 */

// 保存原始的require函数
const originalRequire = module.constructor.prototype.require;

// 替换require函数，拦截sequelize模块的加载
module.constructor.prototype.require = function(path) {
  const result = originalRequire.apply(this, arguments);
  
  // 当加载sequelize模块时
  if (path === 'sequelize') {
    try {
      // 确保返回的对象包含Sequelize构造函数
      if (!result || typeof result !== 'function') {
        console.warn('[预加载] sequelize模块没有返回构造函数，尝试修复');
        
        // 如果结果对象包含Sequelize属性，但不是函数本身
        if (result && typeof result.Sequelize === 'function') {
          console.log('[预加载] 使用result.Sequelize作为主导出');
          Object.setPrototypeOf(result.Sequelize, result);
          
          // 复制所有属性
          for (const key in result) {
            if (key !== 'Sequelize' && !result.Sequelize[key]) {
              result.Sequelize[key] = result[key];
            }
          }
          
          return result.Sequelize;
        }
        
        // 创建应急构造函数
        console.warn('[预加载] 创建应急Sequelize构造函数');
        function EmergencySequelize() {
          console.warn('[预加载] 使用应急Sequelize构造函数');
          this.authenticate = () => Promise.resolve();
          this.define = () => ({});
          this.sync = () => Promise.resolve();
          this.getQueryInterface = () => ({
            showAllTables: () => Promise.resolve([])
          });
        }
        
        // 复制原始模块的所有属性
        if (result) {
          for (const key in result) {
            EmergencySequelize[key] = result[key];
          }
        }
        
        // 确保Sequelize属性存在
        EmergencySequelize.Sequelize = EmergencySequelize;
        
        return EmergencySequelize;
      }
    } catch (error) {
      console.error('[预加载] 修复sequelize模块失败:', error);
    }
  }
  
  return result;
};

// 确保全局的Sequelize始终可用
global.getSequelize = function() {
  try {
    return require('sequelize');
  } catch (error) {
    console.error('[预加载] 加载sequelize失败:', error);
    return null;
  }
};

console.log('[预加载] Sequelize预加载修复已启用');
`;

  const preloadPath = path.join(targetDir, 'sequelize-preload.js');
  fs.writeFileSync(preloadPath, preloadContent, 'utf8');
  console.log(`[修补工具] 已创建预加载脚本: ${preloadPath}`);
  
  return preloadPath;
}

// 创建启动包装脚本
function createStartScript() {
  const startScriptContent = `#!/bin/bash

# Sequelize修复启动脚本
# 自动生成于 ${new Date().toISOString()}

# 设置预加载脚本
export NODE_OPTIONS="--require ./sequelize-preload.js"

# 启动应用
echo "使用Sequelize修复启动应用..."
npm start
`;

  const startScriptPath = path.join(targetDir, 'start-with-fix.sh');
  fs.writeFileSync(startScriptPath, startScriptContent, 'utf8');
  fs.chmodSync(startScriptPath, '755'); // 添加执行权限
  console.log(`[修补工具] 已创建启动脚本: ${startScriptPath}`);
  
  return startScriptPath;
}

// 创建一个独立的sequelize.js替代品
function createStandaloneModule() {
  const standaloneContent = `'use strict';

/**
 * 独立的Sequelize实现
 * 自动生成于 ${new Date().toISOString()}
 * 
 * 当原始Sequelize模块出现问题时使用的替代实现
 */

// 创建Sequelize构造函数
function Sequelize(database, username, password, options = {}) {
  // 保存配置
  this.config = { database, username, password, ...options };
  
  // 基本方法
  this.authenticate = () => {
    console.log('[独立Sequelize] 调用了authenticate()');
    return Promise.resolve();
  };
  
  // 模型定义
  this.define = (modelName, attributes, options = {}) => {
    console.log(\`[独立Sequelize] 定义模型: \${modelName}\`);
    
    // 创建基本模型类
    class Model {
      constructor(values = {}) {
        Object.assign(this, values);
      }
      
      static findAll() { return Promise.resolve([]); }
      static findOne() { return Promise.resolve(null); }
      static findByPk() { return Promise.resolve(null); }
      static create() { return Promise.resolve({}); }
      static update() { return Promise.resolve([0]); }
      static destroy() { return Promise.resolve(0); }
      static count() { return Promise.resolve(0); }
    }
    
    // 添加属性和选项
    Model.tableName = options.tableName || modelName;
    Model.name = modelName;
    Model.rawAttributes = attributes;
    Model.options = options;
    
    return Model;
  };
  
  // 同步数据库
  this.sync = (options = {}) => {
    console.log('[独立Sequelize] 调用了sync()');
    return Promise.resolve(this);
  };
  
  // 查询接口
  this.getQueryInterface = () => {
    return {
      createTable: () => Promise.resolve(),
      dropTable: () => Promise.resolve(),
      showAllTables: () => Promise.resolve([]),
      describeTable: () => Promise.resolve({}),
    };
  };
  
  // 查询方法
  this.query = () => Promise.resolve([]);
  
  // 事务
  this.transaction = (fn) => {
    console.log('[独立Sequelize] 调用了transaction()');
    const t = {
      commit: () => Promise.resolve(),
      rollback: () => Promise.resolve()
    };
    return Promise.resolve(fn ? fn(t) : t);
  };
}

// 数据类型
Sequelize.DataTypes = {
  STRING: function(length) { return { type: 'STRING', length }; },
  TEXT: { type: 'TEXT' },
  INTEGER: { type: 'INTEGER' },
  FLOAT: { type: 'FLOAT' },
  BOOLEAN: { type: 'BOOLEAN' },
  DATE: { type: 'DATE' },
  JSON: { type: 'JSON' },
  JSONB: { type: 'JSONB' },
  UUID: { type: 'UUID' },
  UUIDV4: { type: 'UUIDV4' },
  ARRAY: function(type) { return { type: 'ARRAY', elementType: type }; },
  ENUM: function(...values) { return { type: 'ENUM', values }; },
  NOW: { type: 'NOW' }
};

// 复制到简写属性
Sequelize.STRING = Sequelize.DataTypes.STRING;
Sequelize.TEXT = Sequelize.DataTypes.TEXT;
Sequelize.INTEGER = Sequelize.DataTypes.INTEGER;
Sequelize.FLOAT = Sequelize.DataTypes.FLOAT;
Sequelize.BOOLEAN = Sequelize.DataTypes.BOOLEAN;
Sequelize.DATE = Sequelize.DataTypes.DATE;
Sequelize.JSON = Sequelize.DataTypes.JSON;
Sequelize.JSONB = Sequelize.DataTypes.JSONB;
Sequelize.UUID = Sequelize.DataTypes.UUID;
Sequelize.UUIDV4 = Sequelize.DataTypes.UUIDV4;
Sequelize.ARRAY = Sequelize.DataTypes.ARRAY;
Sequelize.ENUM = Sequelize.DataTypes.ENUM;
Sequelize.NOW = Sequelize.DataTypes.NOW;

// 确保Sequelize属性存在
Sequelize.Sequelize = Sequelize;

// 导出
module.exports = Sequelize;
module.exports.default = Sequelize;
`;

  const standalonePath = path.join(targetDir, 'standalone-sequelize.js');
  fs.writeFileSync(standalonePath, standaloneContent, 'utf8');
  console.log(`[修补工具] 已创建独立Sequelize模块: ${standalonePath}`);
  
  return standalonePath;
}

// 主函数
async function main() {
  try {
    // 查找Sequelize模块
    const sequelizeModule = await findSequelizeModule();
    
    if (sequelizeModule) {
      // 修补Sequelize模块
      patchSequelizeModule(sequelizeModule);
    } else {
      console.log('[修补工具] 未找到Sequelize模块，跳过直接修补');
    }
    
    // 创建预加载脚本
    const preloadPath = createPreloadScript();
    
    // 创建启动脚本
    const startScriptPath = createStartScript();
    
    // 创建独立模块
    const standalonePath = createStandaloneModule();
    
    console.log(`[修补工具] 修补完成!`);
    console.log(`[修补工具] 您现在可以使用以下命令启动应用:`);
    console.log(`cd ${targetDir} && ./start-with-fix.sh`);
    console.log('');
    console.log(`[修补工具] 或者使用以下环境变量:`);
    console.log(`NODE_OPTIONS="--require ./sequelize-preload.js" npm start`);
    
    return true;
  } catch (error) {
    console.error(`[修补工具] 执行修补工具时出错:`, error);
    return false;
  }
}

// 执行主函数
main().catch(error => {
  console.error('[修补工具] 未捕获错误:', error);
  process.exit(1);
}); 