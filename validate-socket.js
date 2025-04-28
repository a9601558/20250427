#!/usr/bin/env node

/**
 * WebSocket连接验证脚本
 * 
 * 该脚本用于验证WebSocket连接是否正常工作
 * 运行方式: node validate-socket.js [--host example.com]
 */

const { io } = require('socket.io-client');
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m'
};

// 解析命令行参数
const args = process.argv.slice(2);
let host = 'http://exam7.jp';

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--host' && args[i + 1]) {
    host = args[i + 1].startsWith('http') ? args[i + 1] : `http://${args[i + 1]}`;
    i++;
  }
}

console.log(`${colors.blue}WebSocket连接测试${colors.reset}`);
console.log(`正在连接到: ${host}\n`);

// 创建Socket.IO连接
const socket = io(host, { 
  transports: ['websocket'],
  timeout: 10000
});

// 设置超时
const connectionTimeout = setTimeout(() => {
  console.log(`${colors.red}连接超时! 无法在10秒内建立连接。${colors.reset}`);
  console.log('\n可能的问题:');
  console.log('1. 服务器未运行或不可访问');
  console.log('2. 防火墙阻止了WebSocket连接');
  console.log('3. Nginx配置不正确');
  console.log('\n检查步骤:');
  console.log('- 确认服务器运行在0.0.0.0:5000');
  console.log('- 验证Nginx /socket.io/ 的配置正确');
  console.log('- 检查AWS安全组和防火墙配置');
  process.exit(1);
}, 10000);

// 连接成功
socket.on('connect', () => {
  clearTimeout(connectionTimeout);
  console.log(`${colors.green}连接成功!${colors.reset}`);
  console.log(`Socket ID: ${socket.id}`);
  console.log(`传输方式: ${socket.io.engine.transport.name}`);

  // 发送测试消息
  console.log(`\n${colors.blue}发送测试消息...${colors.reset}`);
  socket.emit('message', '测试消息');

  // 设置接收消息的超时
  const messageTimeout = setTimeout(() => {
    console.log(`${colors.yellow}警告: 未收到服务器响应，但连接已建立。${colors.reset}`);
    console.log('服务器可能没有正确处理消息事件。');
    socket.disconnect();
    process.exit(0);
  }, 5000);

  // 接收消息
  socket.on('message', (data) => {
    clearTimeout(messageTimeout);
    console.log(`${colors.green}收到消息:${colors.reset} ${data}`);
    console.log(`\n${colors.green}WebSocket连接测试成功!${colors.reset}`);
    
    // 断开连接
    socket.disconnect();
    process.exit(0);
  });
});

// 连接错误
socket.on('connect_error', (error) => {
  clearTimeout(connectionTimeout);
  console.log(`${colors.red}连接错误: ${error.message}${colors.reset}`);
  
  console.log('\n可能的问题:');
  console.log('1. CORS配置不正确');
  console.log('2. 服务器未正确监听或不可访问');
  console.log('3. Nginx配置问题');
  
  console.log('\n解决方案:');
  console.log('1. 检查服务器CORS设置，确保允许所有来源');
  console.log('2. 验证服务器正在监听0.0.0.0:5000');
  console.log('3. 检查Nginx配置，特别是WebSocket相关的设置');
  console.log('4. 确保端口5000已在防火墙和安全组中开放');
  
  process.exit(1);
});

// 断开连接
socket.on('disconnect', (reason) => {
  console.log(`\n${colors.yellow}连接断开: ${reason}${colors.reset}`);
});

console.log(`${colors.blue}正在等待连接...${colors.reset}`); 