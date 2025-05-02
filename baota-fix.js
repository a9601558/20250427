#!/usr/bin/env node

/**
 * Baota面板环境Sequelize修复工具
 * 
 * 此脚本直接修复pnpm环境下的sequelize.js文件
 * 解决"Identifier 'safeExport' has already been declared"错误
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('[宝塔修复] 开始执行Sequelize修复...');

// 目标路径 - 针对宝塔面板标准路径
const defaultTarget = '/www/wwwroot/root/git/dist/dist/server';

// 命令行参数或默认路径
const targetDir = process.argv[2] || defaultTarget;
console.log(`[宝塔修复] 目标目录: ${targetDir}`);

// 检查目录是否存在
if (!fs.existsSync(targetDir)) {
  console.error(`[宝塔修复] 错误: 目标目录不存在: ${targetDir}`);
  console.error(`[宝塔修复] 请指定正确的服务器目录: node baota-fix.js 你的目录路径`);
  process.exit(1);
}

// 查找pnpm目录中的sequelize.js文件
async function findSequelizeInPnpm() {
  try {
    // 尝试在pnpm目录结构中查找
    const nodeModulesPath = path.join(targetDir, 'node_modules');
    const pnpmPath = path.join(nodeModulesPath, '.pnpm');
    
    if (!fs.existsSync(pnpmPath)) {
      console.log(`[宝塔修复] pnpm目录不存在: ${pnpmPath}`);
      return null;
    }
    
    console.log(`[宝塔修复] 在pnpm目录中查找sequelize.js...`);
    
    // 使用find命令查找sequelize.js文件
    try {
      // 如果grep命令不可用，则不使用过滤
      const useGrep = true;
      try {
        execSync('grep --version', { stdio: 'ignore' });
      } catch (e) {
        useGrep = false;
      }
      
      let cmd = `find ${pnpmPath} -name "sequelize.js"`;
      if (useGrep) {
        cmd += ` | grep -v "node_modules/sequelize/node_modules"`;
      }
      cmd += ` | head -1`;
      
      const result = execSync(cmd, { encoding: 'utf8' }).trim();
      
      if (result) {
        console.log(`[宝塔修复] 找到sequelize.js文件: ${result}`);
        return result;
      }
    } catch (err) {
      console.log(`[宝塔修复] 搜索过程中出错: ${err.message}`);
    }
    
    // 手动遍历目录查找
    console.log(`[宝塔修复] 尝试手动查找sequelize.js...`);
    const sequelizeDirs = [];
    
    // 读取pnpm目录下的所有文件夹
    const pnpmDirs = fs.readdirSync(pnpmPath);
    for (const dir of pnpmDirs) {
      if (dir.startsWith('sequelize@')) {
        sequelizeDirs.push(path.join(pnpmPath, dir, 'node_modules/sequelize'));
      }
    }
    
    // 查找所有包含"sequelize"的目录
    if (sequelizeDirs.length === 0) {
      for (const dir of pnpmDirs) {
        const fullPath = path.join(pnpmPath, dir, 'node_modules');
        if (fs.existsSync(fullPath) && fs.existsSync(path.join(fullPath, 'sequelize'))) {
          sequelizeDirs.push(path.join(fullPath, 'sequelize'));
        }
      }
    }
    
    // 在找到的目录中寻找sequelize.js
    for (const dir of sequelizeDirs) {
      const libPath = path.join(dir, 'lib/sequelize.js');
      const distPath = path.join(dir, 'dist/sequelize.js');
      
      if (fs.existsSync(libPath)) {
        console.log(`[宝塔修复] 找到sequelize.js文件: ${libPath}`);
        return libPath;
      }
      
      if (fs.existsSync(distPath)) {
        console.log(`[宝塔修复] 找到sequelize.js文件: ${distPath}`);
        return distPath;
      }
    }
    
    // 最后尝试直接路径
    const directPath = path.join(nodeModulesPath, '.pnpm/sequelize@6.37.7_mysql2@3.14.1_pg@8.15.6/node_modules/sequelize/lib/sequelize.js');
    if (fs.existsSync(directPath)) {
      console.log(`[宝塔修复] 找到sequelize.js文件: ${directPath}`);
      return directPath;
    }
    
    console.log(`[宝塔修复] 未找到sequelize.js文件`);
    return null;
  } catch (err) {
    console.error(`[宝塔修复] 查找过程中出错:`, err);
    return null;
  }
}

// 直接修复safeExport问题
function fixSafeExport(filePath) {
  if (!filePath || !fs.existsSync(filePath)) {
    console.error(`[宝塔修复] 文件不存在: ${filePath}`);
    return false;
  }
  
  try {
    // 读取文件内容
    const content = fs.readFileSync(filePath, 'utf8');
    
    // 检查文件内容
    console.log(`[宝塔修复] 检查文件内容...`);
    
    // 匹配 "const safeExport = module.exports;"
    if (!content.includes('const safeExport = module.exports;')) {
      console.log(`[宝塔修复] 文件不包含目标代码, 尝试其他匹配...`);
      
      // 查找其他可能的模式
      if (!content.match(/const\s+safeExport\s*=/)) {
        console.log(`[宝塔修复] 文件不需要修复`);
        return true;
      }
    }
    
    // 创建备份
    const backupPath = `${filePath}.bak`;
    if (!fs.existsSync(backupPath)) {
      fs.writeFileSync(backupPath, content, 'utf8');
      console.log(`[宝塔修复] 已创建备份: ${backupPath}`);
    }
    
    // 修复文件: 将 "const safeExport = module.exports;" 替换为注释
    let fixedContent = content.replace(
      /const\s+safeExport\s*=\s*module\.exports\s*;/g,
      '/* FIXED BY BAOTA SCRIPT */ // const safeExport = module.exports;'
    );
    
    // 保存修改后的文件
    fs.writeFileSync(filePath, fixedContent, 'utf8');
    console.log(`[宝塔修复] 已修复文件: ${filePath}`);
    
    return true;
  } catch (err) {
    console.error(`[宝塔修复] 修复过程中出错:`, err);
    return false;
  }
}

// 创建安全的preload文件
function createSafePreload() {
  const preloadPath = path.join(targetDir, 'sequelize-preload-safe.js');
  const content = `'use strict';

/**
 * 安全版本Sequelize预加载脚本
 * 为宝塔环境特别优化
 * 生成于: ${new Date().toISOString()}
 */

console.log('[安全预加载] 初始化...');

// 全局变量初始化
if (typeof global.sequelize === 'undefined') {
  global.sequelize = null;
}

// 自定义require函数 - 不直接修改原始require
const originalRequire = module.constructor.prototype.require;
const customRequireMap = new Map();

// 自定义替代require
function safeRequire(path) {
  // 保存原始结果
  const result = originalRequire.apply(this, arguments);
  
  // 只处理sequelize模块
  if (path === 'sequelize' && result) {
    // 确保只处理一次
    if (customRequireMap.has(path)) {
      return customRequireMap.get(path);
    }
    
    try {
      // 如果结果已经是函数，直接使用
      if (typeof result === 'function') {
        if (!global.sequelize) {
          try {
            // 尝试创建实例
            const dotenv = require('dotenv');
            const fs = require('fs');
            const envPath = require('path').join(process.cwd(), '.env');
            
            if (fs.existsSync(envPath)) {
              dotenv.config({ path: envPath });
            }
            
            global.sequelize = new result(
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
            console.log('[安全预加载] 全局Sequelize实例已创建');
          } catch (err) {
            console.error('[安全预加载] 创建实例时出错:', err.message);
          }
        }
        
        customRequireMap.set(path, result);
        return result;
      }
      
      // 如果结果有Sequelize属性且是函数，使用它
      if (result && typeof result.Sequelize === 'function') {
        console.log('[安全预加载] 使用result.Sequelize');
        customRequireMap.set(path, result.Sequelize);
        return result.Sequelize;
      }
    } catch (err) {
      console.error('[安全预加载] 处理模块时出错:', err.message);
    }
  }
  
  return result;
}

// 替换require函数
module.constructor.prototype.require = function(path) {
  return safeRequire.call(this, path);
};

console.log('[安全预加载] 初始化完成');`;

  fs.writeFileSync(preloadPath, content, 'utf8');
  console.log(`[宝塔修复] 已创建安全版预加载脚本: ${preloadPath}`);
  
  return preloadPath;
}

// 更新package.json中的启动脚本
function updatePackageJson() {
  const packageJsonPath = path.join(targetDir, 'package.json');
  
  if (!fs.existsSync(packageJsonPath)) {
    console.log(`[宝塔修复] package.json不存在: ${packageJsonPath}`);
    return false;
  }
  
  try {
    // 读取package.json
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    
    // 备份
    const backupPath = path.join(targetDir, 'package.json.bak');
    if (!fs.existsSync(backupPath)) {
      fs.writeFileSync(backupPath, JSON.stringify(packageJson, null, 2), 'utf8');
      console.log(`[宝塔修复] 已备份package.json: ${backupPath}`);
    }
    
    // 修改scripts部分
    packageJson.scripts = packageJson.scripts || {};
    
    // 添加安全启动脚本
    packageJson.scripts['start:safe'] = 'NODE_OPTIONS="--require ./sequelize-preload-safe.js" node dist/index.js';
    packageJson.scripts['start:original'] = packageJson.scripts.start || 'node dist/index.js';
    packageJson.scripts['start'] = packageJson.scripts['start:safe'];
    
    // 添加修复信息
    packageJson.baotatFix = {
      applied: new Date().toISOString(),
      version: '1.0.0'
    };
    
    // 保存修改后的package.json
    fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2), 'utf8');
    console.log(`[宝塔修复] 已更新package.json`);
    
    return true;
  } catch (err) {
    console.error(`[宝塔修复] 更新package.json出错:`, err);
    return false;
  }
}

// 创建直接启动脚本
function createStartScript() {
  const startScriptPath = path.join(targetDir, 'start-safe.sh');
  const content = `#!/bin/bash

# 安全启动脚本 (宝塔面板专用)
# 生成时间: $(date)

cd $(dirname "$0")

# 设置环境变量
export NODE_OPTIONS="--require ./sequelize-preload-safe.js"

# 启动应用
echo "使用安全模式启动应用..."
node dist/index.js
`;

  fs.writeFileSync(startScriptPath, content, 'utf8');
  fs.chmodSync(startScriptPath, '755');
  console.log(`[宝塔修复] 已创建启动脚本: ${startScriptPath}`);
  
  return startScriptPath;
}

// 主函数
async function main() {
  try {
    // 1. 查找sequelize.js文件
    const sequelizeJsPath = await findSequelizeInPnpm();
    
    if (sequelizeJsPath) {
      // 2. 修复sequelize.js文件
      const fixed = fixSafeExport(sequelizeJsPath);
      if (fixed) {
        console.log(`[宝塔修复] 成功修复sequelize.js文件`);
      } else {
        console.log(`[宝塔修复] 无法修复sequelize.js文件，尝试其他方法...`);
      }
    } else {
      console.log(`[宝塔修复] 未找到sequelize.js文件，使用预加载方式修复`);
    }
    
    // 3. 创建安全的预加载文件
    const preloadPath = createSafePreload();
    
    // 4. 更新package.json
    updatePackageJson();
    
    // 5. 创建启动脚本
    createStartScript();
    
    // 6. 完成
    console.log(`\n[宝塔修复] 所有修复已完成！`);
    console.log(`[宝塔修复] 您现在可以使用以下命令启动应用:`);
    console.log(`  npm start         # 使用安全模式启动`);
    console.log(`  ./start-safe.sh   # 使用安全脚本启动`);
    console.log(`\n[宝塔修复] 如果仍然遇到问题，请运行:`);
    console.log(`  node dist/index.js # 直接启动，不使用预加载`);
  } catch (err) {
    console.error(`[宝塔修复] 执行过程中出错:`, err);
  }
}

// 执行主函数
main().catch(err => {
  console.error(`[宝塔修复] 执行出错:`, err);
}); 