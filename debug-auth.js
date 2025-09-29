// 调试认证问题的脚本
const axios = require('axios');

// 测试API调用
async function testAPI() {
  console.log('=== 调试认证问题 ===\n');

  // 1. 测试没有token的请求
  console.log('1. 测试无token请求 /users/me');
  try {
    const response = await axios.get('http://localhost:3000/api/users/me');
    console.log('无token请求成功（这不应该发生）:', response.data);
  } catch (error) {
    console.log('无token请求失败（正常）:', error.response?.status, error.response?.data);
  }

  // 2. 测试模拟的Cognito token
  console.log('\n2. 测试模拟Cognito token');
  
  // 创建一个模拟的Cognito token payload
  const mockPayload = {
    sub: '27b4fa28-d0b1-7008-865a-738a9ce6772c',
    username: 'testuser',
    email: 'zhangqiwei0509@gmail.com',
    iss: 'https://cognito-idp.ap-southeast-2.amazonaws.com/ap-southeast-2_El0UTGvLD',
    token_use: 'access',
    client_id: 'test_client',
    exp: Math.floor(Date.now() / 1000) + 3600 // 1小时后过期
  };

  // 创建一个简单的JWT token（用于测试）
  const jwt = require('jsonwebtoken');
  const mockToken = jwt.sign(mockPayload, 'test_secret');

  console.log('模拟Token:', mockToken.substring(0, 50) + '...');
  console.log('模拟Payload:', mockPayload);

  try {
    const response = await axios.get('http://localhost:3000/api/users/me', {
      headers: {
        'Authorization': `Bearer ${mockToken}`
      }
    });
    console.log('模拟token请求成功:', response.data);
  } catch (error) {
    console.log('模拟token请求失败:', error.response?.status, error.response?.data);
  }

  // 3. 检查数据库中是否有该用户
  console.log('\n3. 检查数据库中的用户');
  try {
    const response = await axios.get('http://localhost:3000/api/admin/users', {
      headers: {
        'Authorization': `Bearer ${mockToken}`
      }
    });
    console.log('数据库中的用户:', response.data);
  } catch (error) {
    console.log('获取用户列表失败:', error.response?.status, error.response?.data);
  }
}

// 运行测试
testAPI().catch(console.error);