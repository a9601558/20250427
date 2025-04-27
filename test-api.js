// 简单的测试脚本，用于验证API POST请求是否正常工作
const fetch = require('node-fetch');

async function testApi() {
  console.log('开始测试API...');
  
  try {
    // 1. 测试测试路由
    console.log('\n测试 /api/question-sets/test 路由...');
    const testResponse = await fetch('http://localhost:3001/api/question-sets/test', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ test: 'data' })
    });
    
    console.log('状态码:', testResponse.status);
    const testData = await testResponse.json();
    console.log('响应数据:', testData);
    
    // 2. 测试实际的创建题库路由
    console.log('\n测试创建题库路由...');
    
    // 获取token (如需授权)
    const loginResponse = await fetch('http://localhost:3001/api/users/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        username: 'admin', // 替换为实际管理员用户名
        password: 'password' // 替换为实际密码
      })
    });
    
    const loginData = await loginResponse.json();
    console.log('登录状态:', loginResponse.status, loginData.success);
    
    if (!loginData.token) {
      console.log('登录失败，无法获取token');
      return;
    }
    
    const token = loginData.token;
    console.log('获取到的token:', token);
    
    // 使用token创建题库
    const createResponse = await fetch('http://localhost:3001/api/question-sets', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        id: `test-${Date.now()}`,
        title: '测试题库',
        description: '这是一个测试题库',
        category: '测试',
        icon: '📝',
        isPaid: false,
        questions: [
          {
            text: '测试问题1',
            explanation: '这是解释',
            options: [
              { text: '选项A', isCorrect: true },
              { text: '选项B', isCorrect: false }
            ]
          }
        ]
      })
    });
    
    console.log('题库创建状态码:', createResponse.status);
    try {
      const createData = await createResponse.json();
      console.log('题库创建响应:', createData);
    } catch (e) {
      console.log('解析响应失败:', e.message);
      console.log('原始响应:', await createResponse.text());
    }
    
  } catch (error) {
    console.error('测试过程中出错:', error);
  }
}

testApi(); 