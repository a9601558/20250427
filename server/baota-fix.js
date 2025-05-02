#!/usr/bin/env node

/**
 * Baota面板Sequelize修复工具
 * 
 * 用于修复Sequelize在Baota面板环境下的错误:
 * SyntaxError: Identifier 'safeExport' has already been declared
 */

const fs = require('fs');
const path = require('path');

// 查找sequelize.js文件
function findSequelizeFile() {
  const baseDir = process.cwd();
  console.log(`[Baota修复] 正在查找sequelize.js，基础目录: ${baseDir}`);
  
  // 在pnpm目录结构中查找
  const pnpmPattern = path.join(baseDir, 'node_modules', '.pnpm', 'sequelize@*', 'node_modules', 'sequelize', 'lib', 'sequelize.js');
  
  // 使用glob模式查找
  const { globSync } = require('glob');
  const files = globSync(pnpmPattern);
  
  if (files.length > 0) {
    console.log(`[Baota修复] 找到sequelize.js: ${files[0]}`);
    return files[0];
  }
  
  // 常规node_modules路径
  const regularPath = path.join(baseDir, 'node_modules', 'sequelize', 'lib', 'sequelize.js');
  if (fs.existsSync(regularPath)) {
    console.log(`[Baota修复] 找到sequelize.js: ${regularPath}`);
    return regularPath;
  }
  
  console.error('[Baota修复] 未找到sequelize.js文件');
  return null;
}

// 修复sequelize.js文件
function fixSequelizeFile(filePath) {
  if (!filePath) return false;
  
  try {
    // 读取文件内容
    let content = fs.readFileSync(filePath, 'utf8');
    
    // 检查是否已经修复
    if (content.includes('// const safeExport = module.exports; // 已被Baota修复工具注释')) {
      console.log('[Baota修复] sequelize.js已经被修复，跳过');
      return true;
    }
    
    // 修复safeExport声明
    const fixedContent = content.replace(
      'const safeExport = module.exports;',
      '// const safeExport = module.exports; // 已被Baota修复工具注释'
    );
    
    // 检查是否实际进行了替换
    if (content === fixedContent) {
      console.log('[Baota修复] 未找到需要修复的代码行，可能已被修改或版本不匹配');
      return false;
    }
    
    // 创建备份
    const backupPath = `${filePath}.bak`;
    fs.writeFileSync(backupPath, content, 'utf8');
    console.log(`[Baota修复] 创建备份: ${backupPath}`);
    
    // 写入修复后的文件
    fs.writeFileSync(filePath, fixedContent, 'utf8');
    console.log('[Baota修复] sequelize.js修复成功');
    
    return true;
  } catch (error) {
    console.error('[Baota修复] 修复sequelize.js时出错:', error);
    return false;
  }
}

// 创建安全的预加载文件
function createSafePreload() {
  const preloadPath = path.join(process.cwd(), 'sequelize-preload-safe.js');
  
  const preloadContent = `/**
 * Sequelize安全预加载脚本 (Baota面板兼容版)
 * 
 * 此脚本在不修改module.exports的情况下注入全局Sequelize实例
 */

console.log('[预加载-安全版] Sequelize安全预加载修复已启用');

const originalRequire = module.constructor.prototype.require;

// 创建全局Sequelize实例
if (!global.sequelize) {
  try {
    // 加载配置
    const path = require('path');
    const fs = require('fs');
    const dotenv = require('dotenv');
    
    // 加载环境变量
    const envPath = path.join(process.cwd(), '.env');
    if (fs.existsSync(envPath)) {
      dotenv.config({ path: envPath });
    }
    
    // 获取数据库连接信息
    const dbConfig = {
      database: process.env.DB_NAME || 'quizdb',
      username: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '3306'),
      dialect: 'mysql'
    };
    
    // 直接使用原始require加载Sequelize
    const { Sequelize } = originalRequire('sequelize');
    
    // 创建Sequelize实例
    global.sequelize = new Sequelize(
      dbConfig.database,
      dbConfig.username,
      dbConfig.password,
      {
        host: dbConfig.host,
        port: dbConfig.port,
        dialect: dbConfig.dialect,
        logging: false
      }
    );
    
    console.log('[预加载-安全版] 成功创建全局Sequelize实例');
  } catch (error) {
    console.error('[预加载-安全版] 创建全局Sequelize实例失败:', error);
  }
}`;

  try {
    fs.writeFileSync(preloadPath, preloadContent, 'utf8');
    console.log(`[Baota修复] 创建安全预加载文件: ${preloadPath}`);
    return true;
  } catch (error) {
    console.error('[Baota修复] 创建安全预加载文件失败:', error);
    return false;
  }
}

// 更新package.json
function updatePackageJson() {
  const packageJsonPath = path.join(process.cwd(), 'package.json');
  
  try {
    // 读取package.json
    const packageJsonContent = fs.readFileSync(packageJsonPath, 'utf8');
    let packageJson = JSON.parse(packageJsonContent);
    
    // 备份原始package.json
    const backupPath = `${packageJsonPath}.bak`;
    fs.writeFileSync(backupPath, packageJsonContent, 'utf8');
    console.log(`[Baota修复] 已创建package.json备份: ${backupPath}`);
    
    // 更新启动脚本
    packageJson.scripts = packageJson.scripts || {};
    
    // 添加安全的启动脚本
    const originalStart = packageJson.scripts.start || '';
    packageJson.scripts.start = 'NODE_OPTIONS="--require ./sequelize-preload-safe.js" ' + 
      (originalStart.replace('NODE_OPTIONS="--require ./sequelize-preload.js" ', ''));
    
    // 添加其他脚本
    packageJson.scripts.startsafe = 'bash ./start-safe.sh';
    packageJson.scripts.fixbaota = 'node baota-fix.js';
    
    // 写入更新后的package.json
    fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2), 'utf8');
    console.log(`[Baota修复] 已更新package.json`);
    
    return true;
  } catch (error) {
    console.error('[Baota修复] 更新package.json失败:', error);
    return false;
  }
}

// 创建安全启动脚本
function createStartScript() {
  const scriptPath = path.join(process.cwd(), 'start-safe.sh');
  
  const scriptContent = `#!/bin/bash

# 安全启动脚本 (Baota面板兼容版)
echo "===== 安全启动脚本 ====="

# 运行修复脚本
echo "运行Sequelize修复..."
node baota-fix.js

# 设置环境变量并启动
echo "启动应用..."
NODE_OPTIONS="--require ./sequelize-preload-safe.js" ts-node src/index.ts
`;

  try {
    fs.writeFileSync(scriptPath, scriptContent, 'utf8');
    fs.chmodSync(scriptPath, '755'); // 添加执行权限
    console.log(`[Baota修复] 创建安全启动脚本: ${scriptPath}`);
    return true;
  } catch (error) {
    console.error('[Baota修复] 创建安全启动脚本失败:', error);
    return false;
  }
}

// 主函数
async function main() {
  console.log('===== Baota面板Sequelize修复工具 =====');
  
  // 查找并修复sequelize.js
  const sequelizeFilePath = findSequelizeFile();
  const fixResult = fixSequelizeFile(sequelizeFilePath);
  
  // 创建安全的预加载文件
  const preloadResult = createSafePreload();
  
  // 更新package.json
  const packageResult = updatePackageJson();
  
  // 创建安全启动脚本
  const scriptResult = createStartScript();
  
  if (fixResult && preloadResult && packageResult && scriptResult) {
    console.log('\n===== 修复完成 =====');
    console.log('您现在可以使用以下命令启动应用:');
    console.log('  npm run startsafe   # 使用安全脚本启动');
    console.log('  npm start           # 使用修改后的package.json启动');
  } else {
    console.log('\n===== 修复部分完成 =====');
    console.log('某些修复步骤失败，请查看上方日志');
  }
}

// 执行主函数
main(); 