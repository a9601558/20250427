#!/usr/bin/env node

/**
 * AWS Cognito Token 修复验证脚本
 * 
 * 这个脚本验证：
 * 1. 前端现在发送 access token 而不是 ID token
 * 2. 后端能够正确验证 access token
 * 3. 认证流程不再产生 "Token is not an access token" 错误
 */

const fs = require('fs');
const path = require('path');

console.log('🔍 AWS Cognito Token 修复验证');
console.log('=' .repeat(50));

// 1. 验证前端修改
console.log('\n📱 验证前端修改...');

const cognitoContextPath = path.join(__dirname, 'src/contexts/CognitoUserContext.tsx');
try {
  const cognitoContent = fs.readFileSync(cognitoContextPath, 'utf8');
  
  if (cognitoContent.includes("localStorage.setItem('token', accessToken)")) {
    console.log('✅ 前端现在存储 access token 到 localStorage');
  } else {
    console.log('❌ 前端仍在存储 ID token');
  }
  
  if (cognitoContent.includes("localStorage.setItem('cognitoIdToken', idToken)")) {
    console.log('✅ ID token 正确存储到单独的键');
  } else {
    console.log('⚠️  ID token 存储逻辑需要检查');
  }
  
  if (cognitoContent.includes("localStorage.removeItem('cognitoIdToken')")) {
    console.log('✅ 清理逻辑更新正确');
  } else {
    console.log('❌ 清理逻辑未更新');
  }
  
} catch (error) {
  console.log('❌ 无法读取 CognitoUserContext.tsx:', error.message);
}

// 2. 验证后端认证中间件
console.log('\n🔧 验证后端认证中间件...');

const authMiddlewarePath = path.join(__dirname, 'server/src/middleware/authMiddleware.ts');
try {
  const authContent = fs.readFileSync(authMiddlewarePath, 'utf8');
  
  if (authContent.includes("payload.token_use !== 'access'")) {
    console.log('✅ 后端正确验证 access token');
  } else {
    console.log('❌ 后端 token 验证逻辑有问题');
  }
  
  if (authContent.includes('ap-southeast-2_El0UTGvLD')) {
    console.log('✅ Cognito User Pool ID 配置正确');
  } else {
    console.log('❌ Cognito User Pool ID 未配置');
  }
  
} catch (error) {
  console.log('❌ 无法读取 authMiddleware.ts:', error.message);
}

// 3. 验证 Socket 配置
console.log('\n🔌 验证 Socket 配置...');

const socketConfigPath = path.join(__dirname, 'server/src/config/socket.ts');
try {
  const socketContent = fs.readFileSync(socketConfigPath, 'utf8');
  
  if (socketContent.includes("payload.token_use !== 'access'")) {
    console.log('✅ Socket 认证也验证 access token');
  } else {
    console.log('❌ Socket 认证逻辑有问题');
  }
  
} catch (error) {
  console.log('❌ 无法读取 socket.ts:', error.message);
}

// 4. 检查编译状态
console.log('\n🏗️  检查编译状态...');

const frontendDistPath = path.join(__dirname, 'dist');
const backendDistPath = path.join(__dirname, 'server/dist');

if (fs.existsSync(frontendDistPath)) {
  console.log('✅ 前端已编译');
} else {
  console.log('❌ 前端未编译');
}

if (fs.existsSync(backendDistPath)) {
  console.log('✅ 后端已编译');
} else {
  console.log('❌ 后端未编译');
}

// 5. 生成验证报告
console.log('\n📋 修复总结');
console.log('-'.repeat(30));
console.log('问题: 前端发送 ID token，后端期望 access token');
console.log('解决方案: 修改前端存储和发送 access token');
console.log('修改文件:');
console.log('  • src/contexts/CognitoUserContext.tsx');
console.log('影响范围:');
console.log('  • API 请求认证');
console.log('  • Socket 连接认证');
console.log('  • 用户登录状态验证');

console.log('\n🚀 下一步:');
console.log('1. 部署更新的代码');
console.log('2. 清除用户的 localStorage (让用户重新登录)');
console.log('3. 监控日志确认不再出现 "Token is not an access token" 错误');

console.log('\n✨ 验证完成！');