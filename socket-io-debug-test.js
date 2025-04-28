#!/usr/bin/env node

/**
 * Socket.IO 轮询传输调试测试脚本
 * 
 * 这个脚本用于诊断Socket.IO连接问题，特别是轮询模式下的连接
 * 使用方法: node socket-io-debug-test.js
 */

const { io } = require('socket.io-client');
const http = require('http');

// ANSI颜色代码
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  bold: '\x1b[1m'
};

// 配置
const config = {
  host: 'http://exam7.jp',      // Socket.IO服务器地址
  localTest: 'http://localhost:5000', // 本地测试地址
  timeout: 15000,               // 连接超时(毫秒)
  verbose: true                 // 详细日志输出
};

console.log(`${colors.magenta}${colors.bold}Socket.IO 连接诊断工具${colors.reset}`);
console.log(`服务器: ${config.host}`);
console.log(`本地服务器: ${config.localTest}\n`);

// 诊断函数
async function runDiagnostics() {
  console.log(`${colors.blue}========== 第1步: 检查HTTP连接 ==========${colors.reset}`);
  await testHttpEndpoint(`${config.host}/socket.io/`);
  await testHttpEndpoint(`${config.localTest}/socket.io/`);
  
  console.log(`\n${colors.blue}========== 第2步: 测试轮询传输 ==========${colors.reset}`);
  await testSocketIO(config.host, 'polling');
  
  console.log(`\n${colors.blue}========== 第3步: 测试WebSocket传输 ==========${colors.reset}`);
  await testSocketIO(config.host, 'websocket');

  console.log(`\n${colors.blue}========== 第4步: 测试本地服务器 ==========${colors.reset}`);
  await testSocketIO(config.localTest, 'polling');
  
  console.log(`\n${colors.blue}========== 诊断完成 ==========${colors.reset}`);
}

// 测试HTTP端点
function testHttpEndpoint(url) {
  return new Promise((resolve) => {
    console.log(`测试HTTP端点: ${url}`);
    
    const options = new URL(url);
    
    const req = http.get(options, (res) => {
      console.log(`状态码: ${colors.yellow}${res.statusCode}${colors.reset}`);
      console.log(`响应头: ${JSON.stringify(res.headers, null, 2)}`);
      
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        if (data) {
          console.log(`响应数据: ${data.substring(0, 150)}${data.length > 150 ? '...' : ''}`);
        }
        resolve();
      });
    });
    
    req.on('error', (error) => {
      console.log(`${colors.red}HTTP请求错误: ${error.message}${colors.reset}`);
      resolve();
    });
    
    req.setTimeout(5000, () => {
      console.log(`${colors.yellow}HTTP请求超时${colors.reset}`);
      req.destroy();
      resolve();
    });
  });
}

// 测试Socket.IO连接
function testSocketIO(host, transport) {
  return new Promise((resolve) => {
    console.log(`尝试使用 ${colors.yellow}${transport}${colors.reset} 传输方式连接到 ${host}`);
    
    const socket = io(host, {
      transports: [transport],
      timeout: config.timeout,
      reconnectionAttempts: 1,
      reconnectionDelay: 1000,
      forceNew: true
    });
    
    // 输出Socket.IO配置
    if (config.verbose) {
      console.log('Socket.IO配置:');
      console.log(`- 路径: ${socket.io.opts.path}`);
      console.log(`- 超时: ${socket.io.opts.timeout}ms`);
      console.log(`- 传输方式: ${socket.io.opts.transports}`);
      console.log(`- 请求URL: ${host}${socket.io.opts.path}`);
    }
    
    // 记录Socket.IO内部事件
    if (config.verbose) {
      socket.io.on('packet', ({ type, data }) => {
        if (type !== 2) { // 不记录心跳包
          console.log(`传输包: 类型=${type}${data ? `, 数据=${JSON.stringify(data)}` : ''}`);
        }
      });
      
      socket.io.engine.on('packet', ({ type, data }) => {
        if (type !== 'ping' && type !== 'pong') {
          console.log(`引擎包: 类型=${type}${data ? `, 数据=${data.substring(0, 50)}...` : ''}`);
        }
      });
    }
    
    // 监听连接建立
    socket.on('connect', () => {
      console.log(`${colors.green}连接成功! Socket ID: ${socket.id}${colors.reset}`);
      console.log(`传输方式: ${socket.io.engine.transport.name}`);
      
      // 发送测试消息
      console.log('发送测试消息...');
      socket.emit('message', 'Hello from diagnostic tool');
      
      // 5秒后断开连接
      setTimeout(() => {
        socket.disconnect();
        console.log('测试完成，手动断开连接');
        resolve();
      }, 5000);
    });
    
    // 监听消息
    socket.on('message', (data) => {
      console.log(`${colors.green}收到服务器消息: ${data}${colors.reset}`);
    });
    
    // 监听错误
    socket.on('connect_error', (error) => {
      console.log(`${colors.red}连接错误: ${error.message}${colors.reset}`);
      
      // 分析错误原因
      if (error.message.includes('xhr poll error')) {
        console.log('可能的原因: 轮询XHR请求失败，可能是CORS或服务器未运行');
      } else if (error.message.includes('timeout')) {
        console.log('可能的原因: 连接超时，服务器无响应');
      } else if (error.message.includes('not found')) {
        console.log('可能的原因: Socket.IO路径不正确或服务器未正确配置Socket.IO');
      }
      
      setTimeout(() => {
        resolve();
      }, 1000);
    });
    
    // 监听断开连接
    socket.on('disconnect', (reason) => {
      console.log(`断开连接: ${reason}`);
    });
    
    // 设置总体超时
    setTimeout(() => {
      if (socket.connected) {
        socket.disconnect();
      }
      resolve();
    }, config.timeout);
  });
}

// 运行诊断
runDiagnostics().catch(console.error); 