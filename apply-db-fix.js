const mysql = require('mysql2/promise');
require('dotenv').config();

// 连接配置 - 如果环境变量不存在则使用默认值
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'exam_app',
  multipleStatements: true // 允许多条SQL语句
};

async function runFix() {
  console.log('开始应用数据库修复...');
  console.log('数据库配置:', {
    host: dbConfig.host,
    port: dbConfig.port,
    user: dbConfig.user,
    database: dbConfig.database
  });

  let connection;
  try {
    // 建立连接
    connection = await mysql.createConnection(dbConfig);
    console.log('数据库连接成功');

    // 检查数据库结构
    console.log('检查表结构...');
    const [columns] = await connection.query(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = ? 
      AND TABLE_NAME = 'purchases'
      AND (COLUMN_NAME = 'quizId' OR COLUMN_NAME = 'questionSetId')
    `, [dbConfig.database]);

    const columnNames = columns.map(col => col.COLUMN_NAME);
    console.log('发现列:', columnNames.join(', '));

    // 根据检查结果执行不同的修复
    if (columnNames.includes('quizId') && !columnNames.includes('questionSetId')) {
      // 只有quizId：重命名为questionSetId
      console.log('执行修复：将quizId重命名为questionSetId');
      await connection.query(`
        ALTER TABLE purchases DROP FOREIGN KEY IF EXISTS purchases_ibfk_2;
        ALTER TABLE purchases CHANGE COLUMN quizId questionSetId char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL;
        ALTER TABLE purchases ADD INDEX purchases_question_set_id (questionSetId);
        ALTER TABLE purchases ADD CONSTRAINT purchases_ibfk_2 
          FOREIGN KEY (questionSetId) 
          REFERENCES question_sets (id) 
          ON DELETE CASCADE ON UPDATE CASCADE;
      `);
      console.log('重命名完成！');
    } else if (columnNames.includes('quizId') && columnNames.includes('questionSetId')) {
      // 两列都存在：删除quizId并保留questionSetId
      console.log('执行修复：删除quizId列，保留questionSetId列');
      await connection.query(`
        ALTER TABLE purchases DROP FOREIGN KEY IF EXISTS purchases_ibfk_2;
        ALTER TABLE purchases DROP COLUMN quizId;
        ALTER TABLE purchases ADD CONSTRAINT purchases_ibfk_2 
          FOREIGN KEY (questionSetId) 
          REFERENCES question_sets (id) 
          ON DELETE CASCADE ON UPDATE CASCADE;
      `);
      console.log('删除冗余列完成！');
    } else if (!columnNames.includes('quizId') && columnNames.includes('questionSetId')) {
      // 只有questionSetId：不需要操作
      console.log('无需修复：数据库已经使用正确的questionSetId列');
    } else {
      // 两列都不存在：异常情况
      console.error('错误：两个列都不存在，请检查表结构');
      process.exit(1);
    }

    console.log('数据库修复成功完成！');
  } catch (error) {
    console.error('执行数据库修复时出错:', error);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
      console.log('数据库连接已关闭');
    }
  }
}

// 执行修复
runFix()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('未处理的错误:', err);
    process.exit(1);
  }); 