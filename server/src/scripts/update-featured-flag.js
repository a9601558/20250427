const { Sequelize } = require('sequelize');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

// 加载环境变量
dotenv.config({ path: path.join(__dirname, '../../.env') });

// 从环境变量中读取数据库配置
const dbName = process.env.DB_NAME || 'exam_practice_app';
const dbUser = process.env.DB_USER || 'root';
const dbPassword = process.env.DB_PASSWORD || '';
const dbHost = process.env.DB_HOST || 'localhost';
const dbPort = process.env.DB_PORT || '3306';

// 创建Sequelize实例
const sequelize = new Sequelize(dbName, dbUser, dbPassword, {
  host: dbHost,
  port: dbPort,
  dialect: 'mysql',
  logging: console.log
});

// 更新现有题库的isFeatured标志
async function updateFeaturedFlag() {
  try {
    // 连接数据库
    await sequelize.authenticate();
    console.log('数据库连接成功...');

    // 首先检查表是否存在
    const [tables] = await sequelize.query(
      `SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE = 'BASE TABLE' AND TABLE_NAME = 'question_sets' AND TABLE_SCHEMA = '${dbName}'`
    );

    if (tables.length === 0) {
      console.log('题库表不存在，请先创建表');
      return;
    }

    // 检查列是否存在
    const [columns] = await sequelize.query(
      `SHOW COLUMNS FROM question_sets LIKE 'is_featured'`
    );

    if (columns.length === 0) {
      console.log('is_featured列不存在，正在添加...');
      await sequelize.query(
        `ALTER TABLE question_sets ADD COLUMN is_featured BOOLEAN NOT NULL DEFAULT false`
      );
      console.log('is_featured列添加成功');
    } else {
      console.log('is_featured列已存在');
    }

    // 查询所有题库
    const [questionSets] = await sequelize.query(
      `SELECT id, title FROM question_sets`
    );

    console.log(`找到 ${questionSets.length} 个题库`);

    // 设置前3个题库为精选
    const featuredIds = questionSets.slice(0, 3).map(qs => qs.id);
    
    if (featuredIds.length > 0) {
      console.log(`正在将以下题库设为精选: ${featuredIds.join(', ')}`);
      
      await sequelize.query(
        `UPDATE question_sets SET is_featured = true WHERE id IN (${featuredIds.map(() => '?').join(',')})`,
        {
          replacements: featuredIds
        }
      );
      
      console.log('精选题库更新成功');
    } else {
      console.log('没有题库可设为精选');
    }

    await sequelize.close();
    console.log('数据库连接已关闭');
  } catch (error) {
    console.error('更新精选标志时出错:', error);
  }
}

// 运行函数
updateFeaturedFlag(); 