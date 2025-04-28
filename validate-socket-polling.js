#!/usr/bin/env node

/**
 * Socket.IO轮询传输测试脚本
 * 
 * 该脚本专门用于测试Socket.IO的轮询(polling)传输方式
 * 运行方式: node validate-socket-polling.js
 */

const { io } = require('socket.io-client');
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m'
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

console.log(`${colors.magenta}Socket.IO轮询传输测试${colors.reset}`);
console.log(`正在连接到: ${host}\n`);

// 创建Socket.IO连接，强制使用轮询传输
const socket = io(host, {
  transports: ['polling'], // 只使用轮询传输
  timeout: 10000,
  reconnectionAttempts: 3,
  reconnectionDelay: 1000
});

// 监听传输信息
socket.io.engine.on("transport", (transport) => {
  console.log(`${colors.blue}使用传输方式: ${transport.name}${colors.reset}`);
  
  // 每个数据包的发送和接收
  transport.on("packet", (packet) => {
    const type = packet.type === 'ping' ? 'ping' : packet.type;
    console.log(`${colors.yellow}传输数据包 - 类型: ${type}${colors.reset}`);
  });
  
  // 轮询请求
  if (transport.name === 'polling') {
    transport.on("pollComplete", () => {
      console.log(`${colors.blue}完成一次轮询周期${colors.reset}`);
    });
  }
});

// 设置超时
const connectionTimeout = setTimeout(() => {
  console.log(`${colors.red}连接超时! 无法在10秒内建立连接。${colors.reset}`);
  console.log('\n可能的问题:');
  console.log('1. 服务器未运行或不可访问');
  console.log('2. 防火墙阻止了HTTP请求');
  console.log('3. 服务端没有正确处理轮询请求');
  
  process.exit(1);
}, 10000);

// 连接成功
socket.on('connect', () => {
  clearTimeout(connectionTimeout);
  console.log(`${colors.green}连接成功!${colors.reset}`);
  console.log(`Socket ID: ${socket.id}`);
  console.log(`传输方式: ${socket.io.engine.transport.name}`);
  
  // 输出URL信息
  console.log(`\n${colors.blue}服务器URL信息:${colors.reset}`);
  console.log(`命名空间: ${socket.nsp}`);
  console.log(`Socket.IO路径: ${socket.io.opts.path || '/socket.io'}`);
  
  // 发送测试消息
  console.log(`\n${colors.blue}发送测试消息...${colors.reset}`);
  socket.emit('message', '轮询传输测试消息');
  
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
    console.log(`\n${colors.green}轮询传输测试成功!${colors.reset}`);
    
    console.log('\n轮询传输工作正常，这意味着:');
    console.log('1. HTTP连接正常工作');
    console.log('2. Socket.IO路径配置正确');
    console.log('3. CORS配置正确');
    
    // 断开连接
    console.log('\n正在断开连接...');
    socket.disconnect();
    process.exit(0);
  });
});

// 连接错误
socket.on('connect_error', (error) => {
  clearTimeout(connectionTimeout);
  console.log(`${colors.red}连接错误: ${error.message}${colors.reset}`);
  
  console.log('\n轮询传输错误可能原因:');
  console.log('1. HTTP请求被阻止');
  console.log('2. Socket.IO路径配置不正确 (/socket.io)');
  console.log('3. CORS配置不允许跨域请求');
  console.log('4. 服务器未启动或端口不正确');
  
  console.log('\n解决方案:');
  console.log('1. 检查Nginx配置中的/socket.io/路径设置');
  console.log('2. 确认服务器正在监听正确的端口(5000)');
  console.log('3. 检查服务器CORS设置，确保允许请求');
  
  process.exit(1);
});

// 断开连接
socket.on('disconnect', (reason) => {
  console.log(`\n${colors.yellow}连接断开: ${reason}${colors.reset}`);
});

console.log(`${colors.blue}正在等待连接...${colors.reset}`); 