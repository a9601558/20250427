'use strict';

/**
 * 部署前数据库索引修复脚本
 * 直接执行此脚本以修复数据库索引，解决"Too many keys"错误
 * 
 * 使用方法: node fix-db-indexes.js
 */

const { Sequelize } = require('sequelize');
const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');

// 加载环境变量
const envPath = path.join(process.cwd(), '.env');
if (fs.existsSync(envPath)) {
  console.log(`加载环境变量文件: ${envPath}`);
  dotenv.config({ path: envPath });
}

// 数据库配置
const dbConfig = {
  dialect: 'mysql',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '3306'),
  username: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'quiz_app',
  logging: console.log,
};

const sequelize = new Sequelize(
  dbConfig.database,
  dbConfig.username,
  dbConfig.password,
  {
    host: dbConfig.host,
    port: dbConfig.port,
    dialect: dbConfig.dialect,
    logging: dbConfig.logging,
    dialectOptions: {
      connectTimeout: 20000, // 增加超时时间以处理较慢的连接
    },
  }
);

/**
 * 运行修复脚本
 */
async function fixIndexes() {
  let transaction;
  
  try {
    console.log('开始修复数据库索引');
    console.log('数据库连接信息:', {
      host: dbConfig.host,
      port: dbConfig.port,
      database: dbConfig.database,
      username: dbConfig.username,
    });
    
    // 测试连接
    await sequelize.authenticate();
    console.log('数据库连接成功');
    
    // 开始事务
    transaction = await sequelize.transaction();
    
    // 获取所有表
    const tables = await sequelize.query('SHOW TABLES', { 
      type: sequelize.QueryTypes.SHOWTABLES,
      transaction, 
    });
    console.log('所有表:', tables);
    
    // 检查users表是否存在
    if (!tables.includes('users')) {
      console.log('users表不存在，无需修复');
      await transaction.commit();
      return;
    }
    
    // 获取users表的索引
    const [indexes] = await sequelize.query('SHOW INDEX FROM `users`', { transaction });
    console.log(`users表有 ${indexes.length} 个索引`);
    
    // 收集非主键索引
    const indexesToRemove = new Set();
    indexes.forEach((index) => {
      if (index.Key_name !== 'PRIMARY') {
        indexesToRemove.add(index.Key_name);
      }
    });
    
    console.log('将删除以下索引:', [...indexesToRemove]);
    
    // 删除所有非主键索引
    for (const indexName of indexesToRemove) {
      try {
        console.log(`删除索引: ${indexName}`);
        await sequelize.query(`ALTER TABLE \`users\` DROP INDEX \`${indexName}\``, { transaction });
      } catch (error) {
        console.log(`删除索引 ${indexName} 失败:`, error.message);
      }
    }
    
    // 确保username字段类型正确
    console.log('修改username字段类型');
    await sequelize.query('ALTER TABLE `users` MODIFY `username` VARCHAR(50) NOT NULL', { transaction });
    
    // 确保email字段类型正确
    console.log('修改email字段类型');
    await sequelize.query('ALTER TABLE `users` MODIFY `email` VARCHAR(100) NOT NULL', { transaction });
    
    // 添加必要的索引
    console.log('添加必要的索引');
    await sequelize.query(
      'CREATE UNIQUE INDEX `users_username_unique` ON `users` (`username`)',
      { transaction }
    );
    
    await sequelize.query(
      'CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`)',
      { transaction }
    );
    
    // 提交事务
    await transaction.commit();
    console.log('索引修复完成');
  } catch (error) {
    // 回滚事务
    if (transaction) await transaction.rollback();
    console.error('修复索引失败:', error);
  } finally {
    // 关闭数据库连接
    await sequelize.close();
  }
}

// 执行修复脚本
fixIndexes()
  .then(() => {
    console.log('修复脚本执行完成');
    process.exit(0);
  })
  .catch((error) => {
    console.error('修复脚本执行出错:', error);
    process.exit(1);
  }); 
