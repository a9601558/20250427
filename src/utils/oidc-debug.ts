// OIDC Token调试工具
// 在浏览器控制台中运行此代码来检查token内容

window.debugOIDCToken = function() {
  console.log('=== OIDC Token 调试信息 ===');
  
  // 1. 检查localStorage中的token
  const storedToken = localStorage.getItem('token');
  const activeUserId = localStorage.getItem('activeUserId');
  
  console.log('1. 存储的Token信息:');
  console.log('- Token:', storedToken ? storedToken.substring(0, 50) + '...' : '无');
  console.log('- 活跃用户ID:', activeUserId || '无');
  
  // 2. 解码JWT token
  if (storedToken) {
    try {
      const tokenParts = storedToken.split('.');
      if (tokenParts.length === 3) {
        const header = JSON.parse(atob(tokenParts[0]));
        const payload = JSON.parse(atob(tokenParts[1]));
        
        console.log('2. JWT Token解码:');
        console.log('- Header:', header);
        console.log('- Payload:', payload);
        console.log('- Sub:', payload.sub);
        console.log('- Token Use:', payload.token_use);
        console.log('- Issuer:', payload.iss);
        console.log('- Expiry:', new Date(payload.exp * 1000));
        console.log('- Current Time:', new Date());
        console.log('- Is Expired:', payload.exp * 1000 < Date.now());
      }
    } catch (e) {
      console.error('JWT解码失败:', e);
    }
  }
  
  // 3. 检查OIDC状态
  console.log('3. OIDC Context状态:');
  // 这需要在React组件中才能访问
  console.log('请在React组件中使用useAuth()和useOIDCUser()来检查状态');
  
  // 4. 检查API请求头
  console.log('4. 检查axios默认headers:');
  if (window.axios) {
    console.log('Authorization Header:', window.axios.defaults.headers.common['Authorization'] || '无');
  }
  
  // 5. 测试API调用
  console.log('5. 测试API调用:');
  fetch('/api/users/me', {
    headers: {
      'Authorization': `Bearer ${storedToken}`,
      'Content-Type': 'application/json'
    }
  })
  .then(response => response.json())
  .then(data => {
    console.log('API响应:', data);
  })
  .catch(error => {
    console.error('API调用失败:', error);
  });
};

// 自动运行一次
console.log('OIDC调试工具已加载，使用 debugOIDCToken() 来检查token状态');

export {};