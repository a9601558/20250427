/**
 * 用户注册测试工具
 * 使用方法: node src/scripts/test-register.js
 */

const http = require('http');
const chalk = require('chalk') || { green: (t) => t, red: (t) => t, blue: (t) => t, yellow: (t) => t };
const mysql = require('mysql2/promise');
require('dotenv').config();

// 生成随机用户数据
const randomString = () => Math.random().toString(36).substring(2, 10);

const testUser = {
  username: `test_${randomString()}`,
  email: `test_${randomString()}@example.com`,
  password: 'Password123'
};

console.log(chalk.blue('===== 用户注册测试 ====='));
console.log('测试数据:', testUser);

// 发送注册请求
async function testRegister() {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(testUser);
    
    const options = {
      hostname: 'localhost',
      port: process.env.PORT || 5000,
      path: '/users/register',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': data.length
      }
    };
    
    console.log(chalk.blue('\n1. 发送注册请求...'));
    const req = http.request(options, (res) => {
      console.log(`状态码: ${res.statusCode}`);
      
      let responseData = '';
      res.on('data', (chunk) => {
        responseData += chunk;
      });
      
      res.on('end', () => {
        try {
          const parsedData = JSON.parse(responseData);
          if (parsedData.success) {
            console.log(chalk.green('✓ 注册成功!'));
            console.log('用户 ID:', parsedData.data.user.id);
            console.log('用户名:', parsedData.data.user.username);
            console.log('令牌:', parsedData.data.token.substring(0, 15) + '...');
          } else {
            console.log(chalk.red(`✗ 注册失败: ${parsedData.message}`));
          }
          resolve(parsedData);
        } catch (e) {
          console.log(chalk.red(`✗ 解析响应失败: ${e.message}`));
          console.log('原始响应:', responseData);
          reject(e);
        }
      });
    });
    
    req.on('error', (error) => {
      console.log(chalk.red(`✗ 请求错误: ${error.message}`));
      reject(error);
    });
    
    req.write(data);
    req.end();
  });
}

// 检查数据库中的用户
async function checkDatabase(registerResponse) {
  console.log(chalk.blue('\n2. 检查数据库中的用户...'));
  
  // 获取数据库配置
  const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'exam_practice_app'
  };
  
  try {
    // 创建数据库连接
    console.log('连接到MySQL数据库...');
    const connection = await mysql.createConnection(dbConfig);
    
    // 查询用户表
    const [rows] = await connection.execute(
      'SELECT id, username, email, isAdmin, createdAt FROM users WHERE username = ?',
      [testUser.username]
    );
    
    if (rows.length > 0) {
      console.log(chalk.green('✓ 用户记录在数据库中找到!'));
      console.log('数据库记录:', rows[0]);
      
      // 检查API响应和数据库中的ID是否匹配
      if (registerResponse.success && rows[0].id === registerResponse.data.user.id) {
        console.log(chalk.green('✓ API响应和数据库记录一致!'));
      } else {
        console.log(chalk.yellow('! API响应和数据库记录不一致'));
      }
    } else {
      console.log(chalk.red('✗ 在数据库中未找到用户记录!'));
    }
    
    // 关闭连接
    await connection.end();
    
  } catch (error) {
    console.log(chalk.red(`✗ 数据库检查失败: ${error.message}`));
  }
}

// 综合测试
async function runTest() {
  try {
    const registerResponse = await testRegister();
    
    if (registerResponse.success) {
      await checkDatabase(registerResponse);
      console.log(chalk.green('\n✓ 测试完成: 注册功能正常工作!'));
    } else {
      console.log(chalk.yellow('\n! 测试完成: 注册请求没有成功，跳过数据库检查'));
    }
  } catch (error) {
    console.log(chalk.red(`\n✗ 测试失败: ${error.message}`));
  }
}

// 运行测试
runTest(); 