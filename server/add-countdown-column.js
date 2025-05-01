const mysql = require('mysql2/promise');
require('dotenv').config();

// 数据库配置
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'exam_platform',
  port: parseInt(process.env.DB_PORT || '3306', 10)
};

async function addExamCountdownsColumn() {
  let connection;
  
  try {
    console.log('开始连接数据库...');
    connection = await mysql.createConnection(dbConfig);
    console.log('数据库连接成功!');
    
    // 检查列是否已存在
    const [checkResult] = await connection.execute(`
      SELECT COLUMN_NAME
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'users' AND COLUMN_NAME = 'examCountdowns'
    `, [dbConfig.database]);
    
    if (checkResult && checkResult.length > 0) {
      console.log('examCountdowns列已存在，无需添加');
    } else {
      console.log('添加examCountdowns列到users表...');
      
      // 添加列
      await connection.execute(`
        ALTER TABLE users
        ADD COLUMN examCountdowns JSON NULL DEFAULT '[]'
        COMMENT '用户保存的考试倒计时数据'
      `);
      
      console.log('examCountdowns列添加成功!');
    }
    
    console.log('迁移完成!');
  } catch (error) {
    console.error('迁移过程中出错:', error);
  } finally {
    if (connection) {
      await connection.end();
      console.log('数据库连接已关闭');
    }
  }
}

// 执行迁移
addExamCountdownsColumn(); 