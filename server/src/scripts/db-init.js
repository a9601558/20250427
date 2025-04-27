/**
 * 数据库初始化工具
 * 使用方法: node src/scripts/db-init.js
 */

require('dotenv').config();
const { sequelize } = require('../config/db');
const User = require('../models/User');
const chalk = require('chalk') || { green: (t) => t, red: (t) => t, blue: (t) => t };

// 日志辅助函数
const log = {
  success: (msg) => console.log(chalk.green(`✓ ${msg}`)),
  error: (msg) => console.log(chalk.red(`✗ ${msg}`)),
  info: (msg) => console.log(chalk.blue(`ℹ ${msg}`))
};

async function initDatabase() {
  log.info('开始数据库初始化...');
  
  try {
    // 测试数据库连接
    log.info('测试数据库连接...');
    await sequelize.authenticate();
    log.success('数据库连接成功！');
    
    // 同步模型
    log.info('同步数据库模型...');
    await sequelize.sync({ alter: true });
    log.success('数据库模型同步成功！');
    
    // 尝试注册测试用户
    log.info('尝试创建测试用户...');
    try {
      const testUser = await User.findOne({ where: { username: 'testuser' } });
      
      if (!testUser) {
        await User.create({
          username: 'testuser',
          email: 'test@example.com',
          password: '$2a$10$TmvyH1AoyDqRmQ4uOtJnJODQe.7VrIk3JO8q2RLmEgpLKd/6NcYyO', // 明文是: Password123
          isAdmin: false,
          progress: {},
          purchases: [],
          redeemCodes: []
        });
        log.success('测试用户创建成功！用户名: testuser, 密码: Password123');
      } else {
        log.info('测试用户已存在，跳过创建');
      }
    } catch (userError) {
      log.error(`创建测试用户失败: ${userError.message}`);
    }
    
    log.info('数据库初始化完成');
    
  } catch (error) {
    log.error(`数据库初始化失败: ${error.message}`);
    if (error.original) {
      log.error(`原始错误: ${error.original.message}`);
    }
    process.exit(1);
  }
}

// 执行初始化
initDatabase(); 