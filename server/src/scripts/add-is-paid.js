const mysql = require('mysql2/promise');
const dotenv = require('dotenv');

dotenv.config();

async function addIsPaidColumn() {
  let connection;
  try {
    // 创建连接
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'exam_app',
    });

    console.log('连接数据库成功');

    // 检查question_sets表是否有is_paid列
    const [columns] = await connection.execute(`
      SHOW COLUMNS FROM question_sets LIKE 'is_paid'
    `);

    if (columns.length === 0) {
      // 添加is_paid列
      await connection.execute(`
        ALTER TABLE question_sets
        ADD COLUMN is_paid BOOLEAN DEFAULT FALSE NOT NULL
      `);
      console.log('成功添加is_paid列到question_sets表');
    } else {
      console.log('is_paid列已存在，无需添加');
    }

    // 完成
    console.log('数据库修复完成');
  } catch (error) {
    console.error('发生错误:', error);
  } finally {
    if (connection) {
      await connection.end();
      console.log('数据库连接已关闭');
    }
  }
}

// 执行函数
addIsPaidColumn(); 
