const mysql = require('mysql2/promise');
const fs = require('fs').promises;
const path = require('path');
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);
require('dotenv').config();

// 数据库连接配置
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
};

// 数据库名称
const DB_NAME = process.env.DB_NAME || 'exam_practice';

// 设置数据库
async function setupDatabase() {
  try {
    console.log('开始设置数据库...');
    
    // 创建连接池（不包含数据库名）
    const pool = mysql.createPool({
      ...dbConfig,
      database: undefined
    });
    
    // 检查数据库是否存在，不存在则创建
    console.log(`检查数据库 ${DB_NAME} 是否存在...`);
    const [rows] = await pool.execute(`SHOW DATABASES LIKE '${DB_NAME}'`);
    
    if (rows.length === 0) {
      console.log(`创建数据库 ${DB_NAME}...`);
      await pool.execute(`CREATE DATABASE IF NOT EXISTS ${DB_NAME} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
    } else {
      console.log(`数据库 ${DB_NAME} 已存在`);
    }
    
    // 关闭初始连接池
    await pool.end();
    
    // 创建新的连接池（包含数据库名）
    const dbPool = mysql.createPool({
      ...dbConfig,
      database: DB_NAME
    });
    
    // 读取建表SQL文件
    console.log('读取建表SQL文件...');
    const createTablesSql = await fs.readFile(path.join(__dirname, 'create-tables.sql'), 'utf8');
    
    // 执行SQL语句（按分号分割为多个语句）
    const statements = createTablesSql.split(';').filter(stmt => stmt.trim());
    
    for (const statement of statements) {
      if (statement.trim()) {
        console.log('执行SQL：', statement.trim().substring(0, 60) + '...');
        await dbPool.execute(statement);
      }
    }
    
    console.log('表结构创建完成');
    
    // 关闭连接池
    await dbPool.end();
    
    // 运行导入数据脚本
    console.log('开始导入题库数据...');
    await execPromise('node ' + path.join(__dirname, 'import-question-data.js'));
    
    console.log('数据库设置完成！');
    
  } catch (error) {
    console.error('设置数据库出错:', error);
    process.exit(1);
  }
}

// 执行设置
setupDatabase(); 