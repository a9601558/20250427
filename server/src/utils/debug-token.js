'use strict';

/**
 * 调试JWT令牌的工具脚本
 * 用法: node debug-token.js <token>
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

// 获取命令行参数中的token
const token = process.argv[2];

if (!token) {
  console.error('请提供JWT令牌作为命令行参数');
  console.log('用法: node debug-token.js <token>');
  process.exit(1);
}

console.log('尝试验证令牌...');

try {
  // 解码但不验证
  const decodedWithoutVerification = jwt.decode(token);
  console.log('令牌原始内容 (未验证):', decodedWithoutVerification);
  
  if (decodedWithoutVerification) {
    const exp = decodedWithoutVerification.exp;
    if (exp) {
      const expiryDate = new Date(exp * 1000);
      const now = new Date();
      console.log(`令牌过期时间: ${expiryDate.toISOString()}`);
      console.log(`当前时间: ${now.toISOString()}`);
      console.log(`令牌状态: ${expiryDate > now ? '有效' : '已过期'}`);
    } else {
      console.log('令牌没有过期时间信息');
    }
  }
  
  // 验证令牌
  const decoded = jwt.verify(token, jwtSecret);
  console.log('令牌验证成功!');
  console.log('令牌内容:', decoded);
  
  // 检查是否包含必要的用户信息
  if (decoded.id) {
    console.log(`用户ID: ${decoded.id}`);
  } else {
    console.warn('警告: 令牌中没有用户ID');
  }
} catch (error) {
  console.error('令牌验证失败:', error.message);
  console.error('错误类型:', error.name);
  
  if (error.name === 'TokenExpiredError' && error.expiredAt) {
    console.log(`令牌过期时间: ${error.expiredAt}`);
  }
}

// 尝试用不同密钥验证（针对多环境问题）
console.log('\n尝试使用其他常见密钥验证...');
const commonSecrets = [
  'your-secret-key',
  'YOUR_SECRET_KEY',
  'secret',
  'SECRET',
  'jwt-secret',
  'JWT_SECRET',
  'app-secret',
  'APP_SECRET',
  'token-secret',
  'TOKEN_SECRET',
];

for (const secret of commonSecrets) {
  if (secret === jwtSecret) continue; // 跳过已测试的密钥
  
  try {
    jwt.verify(token, secret);
    console.log(`使用密钥 "${secret}" 验证成功!`);
  } catch (error) {
    // 忽略错误，继续测试下一个
  }
}

console.log('\n调试完成'); 
