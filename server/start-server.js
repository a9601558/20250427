#!/usr/bin/env node

/**
 * 启动脚本 - 使用PM2守护Node.js应用
 */

const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');

// 设置默认环境变量
process.env.PORT = process.env.PORT || '5000';
process.env.NODE_ENV = process.env.NODE_ENV || 'production';

// 确保dist目录存在
const distDir = path.join(__dirname, 'dist');
if (!fs.existsSync(distDir)) {
  console.error('错误: dist目录不存在，请先构建项目');
  process.exit(1);
}

// 检查PM2是否已安装
exec('pm2 --version', (error) => {
  if (error) {
    console.error('错误: PM2未安装，正在尝试全局安装...');
    exec('npm install -g pm2', (installError) => {
      if (installError) {
        console.error('无法安装PM2:', installError);
        process.exit(1);
      } else {
        startApp();
      }
    });
  } else {
    startApp();
  }
});

// 使用PM2启动应用
function startApp() {
  const appName = 'exam7-server';
  const scriptPath = path.join(distDir, 'server.js');

  // 停止已存在的实例
  exec(`pm2 delete ${appName}`, () => {
    // 启动新实例
    const command = `pm2 start ${scriptPath} --name "${appName}" --watch --max-memory-restart 500M`;
    
    exec(command, (error, stdout) => {
      if (error) {
        console.error('启动应用时出错:', error);
        process.exit(1);
      }
      
      console.log(stdout);
      console.log(`\n服务器已启动: http://0.0.0.0:${process.env.PORT}`);
      console.log('使用以下命令查看日志:');
      console.log(`pm2 logs ${appName}`);
      console.log('\n使用以下命令重启服务:');
      console.log(`pm2 restart ${appName}`);
    });
  });
} 