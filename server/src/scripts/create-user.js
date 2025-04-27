// 创建测试用户的简单脚本
require('dotenv').config();
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const { sequelize } = require('../config/db');
const User = require('../models/User');

async function createTestUser() {
  try {
    console.log('连接数据库...');
    await sequelize.authenticate();
    console.log('成功连接到数据库');

    // 检查用户是否已存在
    const existingUser = await User.findOne({
      where: {
        username: 'testuser'
      }
    });

    if (existingUser) {
      console.log('测试用户已存在，跳过创建');
      process.exit(0);
    }

    // 创建密码哈希
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash('password123', salt);

    // 创建用户
    const user = await User.create({
      id: uuidv4(),
      username: 'testuser',
      email: 'test@example.com',
      password: hashedPassword,
      isAdmin: true,
      progress: {},
      purchases: [],
      redeemCodes: []
    });

    console.log('测试用户创建成功!');
    console.log('-------登录凭据-------');
    console.log('用户名: testuser');
    console.log('邮箱: test@example.com');
    console.log('密码: password123');
    console.log('管理员: 是');
    console.log('--------------------');

    process.exit(0);
  } catch (error) {
    console.error('创建测试用户时出错:', error);
    process.exit(1);
  }
}

createTestUser(); 