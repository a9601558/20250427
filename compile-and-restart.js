#!/usr/bin/env node

/**
 * 编译TypeScript并重启服务器的脚本
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// 服务器目录
const SERVER_DIR = path.join(__dirname, 'server');

// 确保我们在正确的目录
if (!fs.existsSync(SERVER_DIR)) {
  console.error('错误: 无法找到服务器目录，请确保在正确的工作目录中运行此脚本');
  process.exit(1);
}

try {
  console.log('1. 清理编译目录...');
  execSync('cd server && npm run clean', { stdio: 'inherit' });
  
  console.log('2. 编译TypeScript...');
  execSync('cd server && npm run build', { stdio: 'inherit' });
  
  console.log('3. 复制编译后的文件到服务器...');
  // 请根据实际情况调整服务器路径
  const targetPath = '/www/wwwroot/root/git/dist/server/dist';
  
  // 注意: 此命令需要在服务器上有权限执行
  console.log(`命令: scp -r server/dist/* ${targetPath}`);
  console.log('请手动执行上述命令，或设置正确的服务器路径');
  
  console.log('4. 重启服务器...');
  console.log('请根据您的服务器配置，通过宝塔面板或PM2等方式重启服务');
  
  console.log('\n完成! 请检查服务器日志以确认更改已生效');
} catch (error) {
  console.error('错误:', error.message);
  process.exit(1);
} 