#!/usr/bin/env node

/**
 * package.json更新工具
 * 
 * 此脚本用于更新package.json，添加自动修复脚本
 * 使部署时自动应用Sequelize修复
 * 
 * 用法: node update-package-json.js [目标目录]
 */

const fs = require('fs');
const path = require('path');

// 处理命令行参数
const targetDir = process.argv[2] || process.cwd();
console.log(`[更新工具] 目标目录: ${targetDir}`);

// 检查目录是否存在
if (!fs.existsSync(targetDir)) {
  console.error(`[更新工具] 错误: 目标目录不存在: ${targetDir}`);
  process.exit(1);
}

// 找到package.json
const packageJsonPath = path.join(targetDir, 'package.json');
if (!fs.existsSync(packageJsonPath)) {
  console.error(`[更新工具] 错误: package.json不存在: ${packageJsonPath}`);
  process.exit(1);
}

// 读取package.json
try {
  const packageJsonContent = fs.readFileSync(packageJsonPath, 'utf8');
  let packageJson = JSON.parse(packageJsonContent);
  
  // 备份原始package.json
  const backupPath = `${packageJsonPath}.bak`;
  fs.writeFileSync(backupPath, packageJsonContent, 'utf8');
  console.log(`[更新工具] 已创建备份: ${backupPath}`);
  
  // 添加修复脚本
  packageJson.scripts = packageJson.scripts || {};
  
  // 1. 添加postinstall脚本，在安装后自动运行修复
  const originalPostinstall = packageJson.scripts.postinstall || '';
  packageJson.scripts.postinstall = originalPostinstall 
    ? `${originalPostinstall} && node direct-sequelize-patch.js` 
    : 'node direct-sequelize-patch.js';
  
  // 2. 修改start脚本，添加预加载
  const originalStart = packageJson.scripts.start || 'node index.js';
  packageJson.scripts.start = 'NODE_OPTIONS="--require ./sequelize-preload.js" ' + originalStart;
  
  // 3. 添加修复脚本
  packageJson.scripts.fix = 'node direct-sequelize-patch.js && node sequelize-instance-fix.js && node sequelize-constructor-fix.js';
  packageJson.scripts.fixdb = 'node db-init.js';
  packageJson.scripts.fixall = './fix-all.sh';
  
  // 添加sequelizeFixes元数据
  packageJson.sequelizeFixes = {
    "version": "1.0.0",
    "description": "Sequelize修复工具集",
    "applied": new Date().toISOString()
  };
  
  // 写入更新后的package.json
  fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2), 'utf8');
  console.log(`[更新工具] 已更新package.json`);
  
  // 创建自动安装脚本
  const installFixScriptsContent = `#!/bin/bash

# 自动安装Sequelize修复工具
# 自动生成于 ${new Date().toISOString()}

# 目标目录
TARGET_DIR=\${1:-"$(pwd)"}
echo "目标目录: $TARGET_DIR"

# 颜色定义
RED='\x1b[0;31m'
GREEN='\x1b[0;32m'
YELLOW='\x1b[0;33m'
NC='\x1b[0m' # No Color

echo -e "\${GREEN}===== 开始安装Sequelize修复工具 =====\${NC}"

# 下载修复脚本
echo -e "\${YELLOW}下载修复脚本...\${NC}"

# 创建目录
mkdir -p "$TARGET_DIR/scripts"

# 下载脚本
curl -s -o "$TARGET_DIR/direct-sequelize-patch.js" "https://raw.githubusercontent.com/用户名/项目名/main/direct-sequelize-patch.js"
curl -s -o "$TARGET_DIR/sequelize-instance-fix.js" "https://raw.githubusercontent.com/用户名/项目名/main/sequelize-instance-fix.js"
curl -s -o "$TARGET_DIR/sequelize-constructor-fix.js" "https://raw.githubusercontent.com/用户名/项目名/main/sequelize-constructor-fix.js"
curl -s -o "$TARGET_DIR/db-init.js" "https://raw.githubusercontent.com/用户名/项目名/main/db-init.js"
curl -s -o "$TARGET_DIR/fix-all.sh" "https://raw.githubusercontent.com/用户名/项目名/main/fix-all.sh"

# 添加执行权限
chmod +x "$TARGET_DIR/direct-sequelize-patch.js"
chmod +x "$TARGET_DIR/sequelize-instance-fix.js"
chmod +x "$TARGET_DIR/sequelize-constructor-fix.js"
chmod +x "$TARGET_DIR/db-init.js"
chmod +x "$TARGET_DIR/fix-all.sh"

echo -e "\${GREEN}修复脚本已下载并安装\${NC}"

# 更新package.json
node "$TARGET_DIR/direct-sequelize-patch.js" "$TARGET_DIR"

echo -e "\${GREEN}===== 安装完成 =====\${NC}"
echo -e "\${YELLOW}现在您可以使用以下命令:\${NC}"
echo "  npm start     # 启动应用(自动应用修复)"
echo "  npm run fix   # 手动运行Sequelize修复"
echo "  npm run fixdb # 修复数据库表"
echo "  npm run fixall # 运行所有修复"
  `;

  const installScriptPath = path.join(targetDir, 'install-fixes.sh');
  fs.writeFileSync(installScriptPath, installFixScriptsContent, 'utf8');
  fs.chmodSync(installScriptPath, '755'); // 添加执行权限
  console.log(`[更新工具] 已创建安装脚本: ${installScriptPath}`);
  
  console.log(`[更新工具] 更新完成!`);
  console.log(`[更新工具] 您现在可以使用以下命令运行修复:`);
  console.log(`  npm run fix     # 运行Sequelize修复`);
  console.log(`  npm run fixdb   # 修复数据库表`);
  console.log(`  npm run fixall  # 运行所有修复`);
  console.log('');
  console.log(`[更新工具] 或使用修复后的启动命令:`);
  console.log(`  npm start       # 启动应用(自动应用修复)`);
  
} catch (error) {
  console.error(`[更新工具] 更新package.json失败:`, error);
  process.exit(1);
} 