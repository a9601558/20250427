'use strict';

/**
 * 生成测试JWT令牌
 * 此脚本创建一个与服务器兼容的测试JWT令牌，可用于调试认证问题
 */

const jwt = require('jsonwebtoken');
const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');

// 加载环境变量
const envPath = path.join(process.cwd(), '.env');
if (fs.existsSync(envPath)) {
  console.log(`加载环境变量文件: ${envPath}`);
  dotenv.config({ path: envPath });
} else {
  console.warn(`警告: 环境变量文件不存在: ${envPath}`);
}

// 获取JWT密钥
const jwtSecret = process.env.JWT_SECRET || 'your-secret-key';
console.log(`JWT密钥存在: ${!!jwtSecret}, 长度: ${jwtSecret.length}字符`);

// 允许从命令行参数获取用户ID
const userId = process.argv[2] || 'test-user-id';

// 创建测试负载
const payload = {
  id: userId,
  username: 'test-user',
  iat: Math.floor(Date.now() / 1000),
  exp: Math.floor(Date.now() / 1000) + 3600 * 24 * 7 // 7天过期
};

// 不同时限的令牌
const tokens = {
  '1小时': Math.floor(Date.now() / 1000) + 3600,
  '1天': Math.floor(Date.now() / 1000) + 3600 * 24,
  '7天': Math.floor(Date.now() / 1000) + 3600 * 24 * 7,
  '30天': Math.floor(Date.now() / 1000) + 3600 * 24 * 30,
  '永不过期': undefined
};

console.log('生成不同时效的令牌:');
for (const [name, expiry] of Object.entries(tokens)) {
  const tokenPayload = { ...payload };
  if (expiry) {
    tokenPayload.exp = expiry;
  } else {
    delete tokenPayload.exp; // 移除过期时间，永不过期
  }
  
  const token = jwt.sign(tokenPayload, jwtSecret);
  console.log(`\n${name} 令牌:`);
  console.log(token);
  
  // 解码显示内容
  const decoded = jwt.decode(token);
  console.log('内容:', decoded);
  
  // 计算过期时间
  if (decoded.exp) {
    const expiryDate = new Date(decoded.exp * 1000);
    console.log(`过期时间: ${expiryDate.toISOString()}`);
  } else {
    console.log('无过期时间 (永久有效)');
  }
}

console.log('\n测试认证 (7天有效):');
console.log('前端代码使用方法:');
console.log('1. 打开浏览器控制台');
console.log('2. 输入: localStorage.setItem("token", "<上面7天令牌值>");');
console.log('3. 刷新页面测试');

console.log('\nSocket.io 连接测试:');
console.log(`const socket = io('${process.env.CLIENT_URL || 'http://localhost:5000'}', {`);
console.log('  auth: {');
console.log(`    token: "<上面7天令牌值>",`);
console.log(`    userId: "${userId}"`);
console.log('  }');
console.log('});'); 