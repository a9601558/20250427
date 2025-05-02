'use strict';

/**
 * 检查服务器JWT配置
 * 此脚本验证环境变量和JWT配置是否正确
 */

const dotenv = require('dotenv');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

console.log('检查服务器JWT配置...');

// 查找.env文件
const possibleEnvPaths = [
  path.join(process.cwd(), '.env'),
  path.join(process.cwd(), '../.env'),
  path.join(process.cwd(), '../../.env'),
  path.join(process.cwd(), 'server/.env'),
  path.join(process.cwd(), 'dist/server/.env'),
];

let envFound = false;
let envPath = '';

for (const p of possibleEnvPaths) {
  if (fs.existsSync(p)) {
    envPath = p;
    envFound = true;
    console.log(`找到环境变量文件: ${p}`);
    break;
  }
}

if (!envFound) {
  console.warn('警告: 未找到.env文件');
} else {
  // 加载环境变量
  dotenv.config({ path: envPath });
  
  // 读取.env文件内容
  const envContent = fs.readFileSync(envPath, 'utf8');
  const lines = envContent.split('\n');
  
  // 检查JWT相关配置
  const jwtLines = lines.filter((line) => 
    line.includes('JWT') || 
    line.includes('SECRET') || 
    line.includes('TOKEN')
  );
  
  if (jwtLines.length === 0) {
    console.warn('警告: .env文件中没有找到JWT相关配置');
  } else {
    console.log('发现以下JWT相关配置:');
    jwtLines.forEach((line) => {
      // 不显示实际密钥值，只显示长度和前几个字符
      const parts = line.split('=');
      if (parts.length === 2) {
        const key = parts[0].trim();
        let value = parts[1].trim();
        
        // 如果是密钥，隐藏部分内容
        if (key.includes('SECRET') || key.includes('KEY')) {
          if (value.length > 8) {
            value = `${value.substring(0, 3)}...${value.substring(value.length - 3)} (${value.length}字符)`;
          } else if (value.length > 0) {
            value = `****** (${value.length}字符)`;
          }
        }
        
        console.log(`  ${key}=${value}`);
      } else {
        console.log(`  ${line}`);
      }
    });
  }
}

// 检查JWT_SECRET环境变量
const jwtSecret = process.env.JWT_SECRET;
if (!jwtSecret) {
  console.error('错误: JWT_SECRET环境变量未定义');
  console.log('建议添加一个强密钥，例如:');
  const suggestedSecret = crypto.randomBytes(32).toString('hex');
  console.log(`JWT_SECRET=${suggestedSecret}`);
} else {
  console.log(`JWT_SECRET环境变量已设置，长度: ${jwtSecret.length}字符`);
  
  // 检查密钥强度
  if (jwtSecret.length < 16) {
    console.warn('警告: JWT密钥太短，建议使用至少32字符长度的强密钥');
  } else if (jwtSecret === 'your-secret-key' || jwtSecret === 'secret' || jwtSecret === 'jwt_secret') {
    console.error('错误: 正在使用默认示例密钥，请更改为强密钥');
  } else {
    console.log('JWT密钥长度合适');
  }
}

// 生成测试令牌
try {
  const jwt = require('jsonwebtoken');
  
  const testPayload = {
    id: 'test-user-id',
    username: 'test-user',
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 3600, // 1小时后过期
  };
  
  const testToken = jwt.sign(testPayload, jwtSecret || 'test-secret');
  console.log('\n使用当前配置生成的测试令牌:');
  console.log(testToken);
  
  // 验证测试令牌
  try {
    const decoded = jwt.verify(testToken, jwtSecret || 'test-secret');
    console.log('令牌验证成功，内容:', decoded);
  } catch (error) {
    console.error('令牌验证失败:', error.message);
  }
} catch (error) {
  console.error('生成测试令牌失败:', error.message);
}

console.log('\n检查完成!'); 
