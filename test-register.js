/**
 * 注册接口测试工具
 * 使用方法: node test-register.js
 */

const http = require('http');

// 测试数据
const testData = {
  username: 'testuser_' + Math.floor(Math.random() * 1000),
  password: 'Password123',
  email: `test${Math.floor(Math.random() * 1000)}@example.com`
};

console.log('=== 注册接口测试 ===');
console.log('测试数据:', testData);

// 测试不同路径
const endpoints = [
  { path: '/api/users/register', description: '完整路径 (推荐)' },
  { path: '/users/register', description: '不含api前缀' },
  { path: '/register', description: '仅端点名称' }
];

// 逐一测试每个端点
function testEndpoint(index) {
  if (index >= endpoints.length) {
    console.log('\n测试完成。');
    console.log('如需要，请参考backend-route-diagnosis.js获取更详细的诊断。');
    return;
  }

  const endpoint = endpoints[index];
  console.log(`\n测试端点: ${endpoint.path} (${endpoint.description})`);

  const options = {
    hostname: 'localhost',
    port: 5000,
    path: endpoint.path,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    }
  };

  const req = http.request(options, (res) => {
    console.log(`状态码: ${res.statusCode}`);
    
    let data = '';
    res.on('data', (chunk) => {
      data += chunk;
    });
    
    res.on('end', () => {
      try {
        const jsonResponse = JSON.parse(data);
        console.log('响应数据:', jsonResponse);
      } catch (e) {
        console.log('响应数据 (非JSON):', data);
      }
      
      // 测试下一个端点
      testEndpoint(index + 1);
    });
  });
  
  req.on('error', (error) => {
    console.error('请求错误:', error.message);
    // 测试下一个端点
    testEndpoint(index + 1);
  });
  
  // 发送请求体
  req.write(JSON.stringify(testData));
  req.end();
}

// 开始测试
testEndpoint(0); 