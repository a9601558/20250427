// 简单的脚本，通过mysql2模块直接创建数据库
require('dotenv').config();
const mysql = require('mysql2/promise');

async function createDatabase() {
  console.log('尝试创建数据库...');
  
  const {
    DB_HOST, 
    DB_PORT, 
    DB_NAME, 
    DB_USER, 
    DB_PASSWORD
  } = process.env;
  
  console.log(`数据库配置: HOST=${DB_HOST}, PORT=${DB_PORT}, DB=${DB_NAME}, USER=${DB_USER}`);
  console.log(`密码是否设置: ${DB_PASSWORD ? '是' : '否'}`);
  
  try {
    console.log('正在尝试连接MySQL...');
    // 创建不带数据库名称的连接
    const connection = await mysql.createConnection({
      host: DB_HOST,
      port: DB_PORT,
      user: DB_USER,
      password: DB_PASSWORD
    });
    
    console.log('已成功连接到MySQL服务器');
    
    // 创建数据库
    console.log(`正在尝试创建数据库 ${DB_NAME}...`);
    const [result] = await connection.query(
      `CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\` 
       CHARACTER SET utf8mb4 
       COLLATE utf8mb4_unicode_ci`
    );
    
    console.log(`数据库 ${DB_NAME} 创建成功！`, result);
    
    // 关闭连接
    await connection.end();
    console.log('MySQL连接已关闭');
    
  } catch (error) {
    console.error('创建数据库时出错:');
    console.error(error.message);
    console.error('错误堆栈:', error.stack);
    process.exit(1);
  }
}

// 执行函数并处理最外层的错误
createDatabase()
  .then(() => {
    console.log('脚本执行完成');
    process.exit(0);
  })
  .catch(err => {
    console.error('运行脚本时出现未处理的错误:', err);
    process.exit(1);
  }); 