#!/usr/bin/env node

/**
 * 修复 Sequelize safeExport 变量重复声明问题
 * 
 * 此脚本查找并修复 sequelize.js 文件中的 safeExport 变量声明
 * 解决 "Identifier 'safeExport' has already been declared" 错误
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// 使用当前目录
const targetDir = process.cwd();
console.log(`[修复工具] 目标目录: ${targetDir}`);

// 查找sequelize.js文件
async function findSequelizeJs() {
  try {
    // 在node_modules中查找
    const cmd = `find ${targetDir}/node_modules -path "*/sequelize/lib/sequelize.js" -o -path "*/sequelize/dist/sequelize.js" | head -1`;
    const result = execSync(cmd, { encoding: 'utf8' }).trim();
    
    if (result) {
      console.log(`[修复工具] 找到sequelize.js文件: ${result}`);
      return result;
    }
    
    // 在pnpm目录中查找
    const pnpmCmd = `find ${targetDir}/node_modules/.pnpm -name "sequelize.js" | grep -v "node_modules/sequelize/node_modules" | head -1`;
    try {
      const pnpmResult = execSync(pnpmCmd, { encoding: 'utf8' }).trim();
      if (pnpmResult) {
        console.log(`[修复工具] 找到sequelize.js文件: ${pnpmResult}`);
        return pnpmResult;
      }
    } catch (err) {
      console.log(`[修复工具] pnpm搜索无结果`);
    }
    
    console.error(`[修复工具] 未找到sequelize.js文件`);
    return null;
  } catch (err) {
    console.error(`[修复工具] 查找文件时出错:`, err);
    return null;
  }
}

// 修复文件中的safeExport声明
function fixSafeExportDeclaration(filePath) {
  try {
    // 读取文件内容
    const content = fs.readFileSync(filePath, 'utf8');
    
    // 检查是否包含问题代码
    if (!content.includes('const safeExport = module.exports;')) {
      console.log(`[修复工具] 文件不包含需要修复的代码: ${filePath}`);
      return true;
    }
    
    // 检查是否已经修复过
    if (content.includes('// FIXED: safeExport declaration removed')) {
      console.log(`[修复工具] 文件已经被修复过: ${filePath}`);
      return true;
    }
    
    // 创建备份
    const backupPath = `${filePath}.original`;
    if (!fs.existsSync(backupPath)) {
      fs.writeFileSync(backupPath, content, 'utf8');
      console.log(`[修复工具] 已创建文件备份: ${backupPath}`);
    }
    
    // 修复代码
    const fixed = content.replace(
      'const safeExport = module.exports;', 
      '// FIXED: safeExport declaration removed\n// const safeExport = module.exports;'
    );
    
    // 保存修复后的文件
    fs.writeFileSync(filePath, fixed, 'utf8');
    console.log(`[修复工具] 已修复文件: ${filePath}`);
    
    return true;
  } catch (err) {
    console.error(`[修复工具] 修复文件时出错:`, err);
    return false;
  }
}

// 主函数
async function main() {
  // 查找sequelize.js文件
  const sequelizeJsPath = await findSequelizeJs();
  
  if (!sequelizeJsPath) {
    console.error(`[修复工具] 未找到sequelize.js文件，无法继续`);
    return;
  }
  
  // 修复safeExport声明问题
  const fixed = fixSafeExportDeclaration(sequelizeJsPath);
  
  if (fixed) {
    console.log(`[修复工具] 修复成功！现在可以重新启动应用`);
  } else {
    console.error(`[修复工具] 修复失败`);
  }
}

// 执行主函数
main().catch(err => {
  console.error(`[修复工具] 执行出错:`, err);
}); 