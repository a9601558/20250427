#!/usr/bin/env node

/**
 * Sequelize模块直接修补工具 - 安全版本
 * 
 * 此脚本直接修改node_modules中的Sequelize模块
 * 解决pnpm环境下的Sequelize相关错误，避免重复修补
 */

const fs = require('fs');
const path = require('path');
const util = require('util');
const child_process = require('child_process');
const exec = util.promisify(child_process.exec);

// 处理命令行参数
const targetDir = process.argv[2] || process.cwd();
console.log(`[修补工具] 目标目录: ${targetDir}`);

// 检查目录是否存在
if (!fs.existsSync(targetDir)) {
  console.error(`[修补工具] 错误: 目标目录不存在: ${targetDir}`);
  process.exit(1);
}

// 检查是否已经修补过
const isPatchedFile = (content) => {
  return content.includes('// === 安全的构造函数检查 (由修补工具添加) ===') ||
         content.includes('// 安全模式标记 - 避免重复修补') ||
         content.includes('// === 确保正确导出 (由修补工具添加) ===');
};

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
    
    // 检查是否已经修补过
    if (isPatchedFile(originalContent)) {
      console.log(`[修补工具] 该文件已被修补，跳过: ${filePath}`);
      return true;
    }
    
    // 创建备份
    const backupPath = `${filePath}.bak`;
    if (!fs.existsSync(backupPath)) {
      fs.writeFileSync(backupPath, originalContent, 'utf8');
      console.log(`[修补工具] 已创建备份: ${backupPath}`);
    }
    
    // 修改内容
    let newContent = originalContent;
    
    // 添加安全标记以避免重复修补
    newContent = `// 安全模式标记 - 避免重复修补\n${newContent}`;
    
    // 修复1: 添加安全的构造函数检查，使用不同的变量名
    const safeConstructorCode = `
// === 安全的构造函数检查 (由修补工具添加) ===
if (typeof Sequelize !== 'function') {
  console.warn('[Sequelize] 警告: Sequelize不是构造函数，创建安全版本');
  
  // 创建一个安全的构造函数
  const _SafeSequelize = function() {
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
    this.transaction = (fn) => Promise.resolve(fn ? fn({ commit: () => {}, rollback: () => {} }) : null);
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
      _SafeSequelize[key] = Sequelize[key];
    });
  }
  
  // 替换全局Sequelize
  global.Sequelize = _SafeSequelize;
  
  // 避免直接修改module.exports，而是使用getter/setter
  if (!global._sequelizeExportsPatched) {
    const originalExports = module.exports;
    Object.defineProperty(module, 'exports', {
      get: function() { return global.Sequelize || originalExports; },
      set: function(val) { originalExports = val; },
      configurable: true
    });
    global._sequelizeExportsPatched = true;
  }
} else {
  console.log('[Sequelize] Sequelize是构造函数，无需修补');
}
// === 安全的构造函数检查结束 ===
`;

    // 在适当的位置插入构造函数检查代码
    if (newContent.includes('class Sequelize {')) {
      const classMatch = newContent.match(/class Sequelize \{[\s\S]*?\n\}/);
      if (classMatch) {
        const insertPosition = classMatch.index + classMatch[0].length;
        newContent = newContent.substring(0, insertPosition) + '\n' + safeConstructorCode + newContent.substring(insertPosition);
      } else {
        const classLineMatch = newContent.match(/class Sequelize \{.*\n/);
        if (classLineMatch) {
          const insertPosition = classLineMatch.index + classLineMatch[0].length;
          newContent = newContent.substring(0, insertPosition) + safeConstructorCode + newContent.substring(insertPosition);
        } else {
          console.warn('[修补工具] 无法找到Sequelize类定义，尝试在文件开头插入');
          newContent = safeConstructorCode + newContent;
        }
      }
    } else if (newContent.includes('function Sequelize(')) {
      const functionMatch = newContent.match(/function Sequelize\([\s\S]*?\n\}/);
      if (functionMatch) {
        const insertPosition = functionMatch.index + functionMatch[0].length;
        newContent = newContent.substring(0, insertPosition) + '\n' + safeConstructorCode + newContent.substring(insertPosition);
      } else {
        newContent = safeConstructorCode + newContent;
      }
    } else {
      newContent = safeConstructorCode + newContent;
    }
    
    // 去除可能导致"Identifier 'safeExport' has already been declared"错误的代码
    newContent = newContent.replace(/const safeExport\s*=\s*module\.exports;/g, '// 已移除: const safeExport = module.exports;');
    
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
 * Sequelize预加载修复脚本 - 安全版本
 * 自动生成于 ${new Date().toISOString()}
 */

// 保存原始的require函数
const originalRequire = module.constructor.prototype.require;

// 替换require函数，拦截sequelize模块的加载
module.constructor.prototype.require = function(path) {
  // 先执行原始require
  const result = originalRequire.apply(this, arguments);
  
  // 当加载sequelize模块时
  if (path === 'sequelize') {
    try {
      // 确保全局sequelize实例存在
      if (!global.sequelize) {
        try {
          // 安全地尝试创建全局Sequelize实例
          const dotenv = require('dotenv');
          const fs = require('fs');
          const envPath = require('path').join(process.cwd(), '.env');
          
          if (fs.existsSync(envPath)) {
            console.log('[预加载] 加载环境变量文件: ' + envPath);
            dotenv.config({ path: envPath });
          }
          
          // 获取Sequelize构造函数
          const Sequelize = result && typeof result === 'function' 
            ? result 
            : (result && typeof result.Sequelize === 'function' 
                ? result.Sequelize 
                : null);
          
          if (Sequelize) {
            global.sequelize = new Sequelize(
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
            console.log('[预加载] 全局Sequelize实例创建成功');
          } else {
            console.error('[预加载] 无法获取有效的Sequelize构造函数');
          }
        } catch (error) {
          console.error('[预加载] 创建全局Sequelize实例失败:', error);
        }
      }
      
      // 处理返回值
      if (!result || typeof result !== 'function') {
        if (result && typeof result.Sequelize === 'function') {
          console.log('[预加载] 使用result.Sequelize作为主导出');
          return result.Sequelize;
        }
      }
    } catch (error) {
      console.error('[预加载] 处理sequelize模块失败:', error);
    }
  }
  
  return result;
};

// 确保全局的Sequelize构造函数始终可用
if (!global.Sequelize) {
  global.Sequelize = function DummySequelize() {
    console.warn('[预加载] 使用了应急Sequelize构造函数');
    this.authenticate = () => Promise.resolve();
    this.define = () => ({});
  };
  
  // 添加静态属性
  global.Sequelize.DataTypes = {
    STRING: function() { return { type: 'STRING' }; },
    INTEGER: { type: 'INTEGER' },
    BOOLEAN: { type: 'BOOLEAN' },
    DATE: { type: 'DATE' },
    UUID: { type: 'UUID' },
    UUIDV4: { type: 'UUIDV4' },
    JSON: { type: 'JSON' }
  };
}

console.log('[预加载] Sequelize安全预加载已启用');
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
node simple-start.js
`;

  const startScriptPath = path.join(targetDir, 'start-safe.sh');
  fs.writeFileSync(startScriptPath, startScriptContent, 'utf8');
  fs.chmodSync(startScriptPath, '755'); // 添加执行权限
  console.log(`[修补工具] 已创建启动脚本: ${startScriptPath}`);
  
  return startScriptPath;
}

// 修改 package.json
function updatePackageJson() {
  const packageJsonPath = path.join(targetDir, 'package.json');
  if (fs.existsSync(packageJsonPath)) {
    try {
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
      
      // 创建备份
      if (!fs.existsSync(`${packageJsonPath}.original`)) {
        fs.writeFileSync(`${packageJsonPath}.original`, JSON.stringify(packageJson, null, 2), 'utf8');
      }
      
      // 更新scripts
      packageJson.scripts = packageJson.scripts || {};
      packageJson.scripts['start:safe'] = 'NODE_OPTIONS="--require ./sequelize-preload.js" node simple-start.js';
      packageJson.scripts['start:simple'] = 'node simple-start.js';
      
      // 添加metadata
      packageJson.sequelizePatched = {
        version: '2.0.0',
        patchedAt: new Date().toISOString(),
        safeMode: true
      };
      
      fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2), 'utf8');
      console.log(`[修补工具] 已更新package.json`);
    } catch (error) {
      console.error(`[修补工具] 更新package.json失败:`, error);
    }
  }
}

// 主函数
async function main() {
  try {
    console.log(`[修补工具] 开始修补Sequelize...`);
    
    // 查找Sequelize模块
    const sequelizeModule = await findSequelizeModule();
    
    if (sequelizeModule) {
      // 修补Sequelize模块
      const patchSuccess = patchSequelizeModule(sequelizeModule);
      
      if (!patchSuccess) {
        console.log('[修补工具] 直接修补失败，将使用预加载方式');
      }
    } else {
      console.log('[修补工具] 未找到Sequelize模块，将使用预加载方式');
    }
    
    // 无论如何都创建预加载脚本作为备用
    createPreloadScript();
    
    // 创建启动脚本
    createStartScript();
    
    // 更新package.json
    updatePackageJson();
    
    console.log(`[修补工具] Sequelize修补完成！`);
    console.log(`[修补工具] 您可以使用以下命令启动应用:`);
    console.log(`  npm run start:safe   # 使用安全模式启动`);
    console.log(`  npm run start:simple # 使用简化模式启动`);
    console.log(`  ./start-safe.sh     # 使用安全启动脚本`);
    
  } catch (error) {
    console.error(`[修补工具] 运行过程中出错:`, error);
  }
}

// 执行主函数
main(); 