require('dotenv').config();
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const mysql = require('mysql2/promise');

async function createAdminUser() {
  console.log('正在创建管理员用户...');
  
  // 从.env文件获取数据库配置
  const { 
    DB_HOST, 
    DB_PORT, 
    DB_NAME, 
    DB_USER, 
    DB_PASSWORD 
  } = process.env;
  
  let connection;
  
  try {
    // 创建数据库连接
    connection = await mysql.createConnection({
      host: DB_HOST,
      port: DB_PORT,
      database: DB_NAME,
      user: DB_USER,
      password: DB_PASSWORD
    });
    
    console.log('已连接到数据库');
    
    // 检查用户表是否存在
    const [tables] = await connection.query(
      `SHOW TABLES LIKE 'users'`
    );
    
    if (tables.length === 0) {
      console.log('用户表不存在，请先运行迁移');
      return;
    }
    
    // 检查管理员用户是否已存在
    const [admins] = await connection.query(
      `SELECT * FROM users WHERE username = 'admin'`
    );
    
    if (admins.length > 0) {
      console.log('管理员用户已存在，跳过创建');
      return;
    }
    
    // 创建密码哈希
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash('admin123', salt);
    
    // 创建管理员用户
    const userId = uuidv4();
    const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
    
    await connection.query(
      `INSERT INTO users 
        (id, username, email, password, isAdmin, progress, purchases, redeemCodes, createdAt, updatedAt) 
       VALUES 
        (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        userId,
        'admin',
        'admin@example.com',
        hashedPassword,
        1, // isAdmin=true
        '{}', // empty progress
        '[]', // empty purchases
        '[]', // empty redeemCodes
        now,
        now
      ]
    );
    
    console.log('管理员用户创建成功！');
    console.log('-----登录凭据-----');
    console.log('用户名: admin');
    console.log('密码: admin123');
    console.log('------------------');
    
  } catch (error) {
    console.error('创建管理员用户时出错:', error);
  } finally {
    if (connection) {
      await connection.end();
      console.log('数据库连接已关闭');
    }
  }
}

createAdminUser(); 