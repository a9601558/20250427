// 导入SQL数据的专用脚本
const fs = require('fs');
const mysql = require('mysql2/promise');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config();

// 数据库连接配置
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '9601566aaA.', 
  database: process.env.DB_NAME || 'quizdb',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
};

// 主函数
async function importSql() {
  console.log('=== SQL导入工具 ===');
  console.log('使用以下配置连接数据库:');
  console.log('- 主机:', dbConfig.host);
  console.log('- 用户:', dbConfig.user);
  console.log('- 密码长度:', dbConfig.password ? dbConfig.password.length : 0);
  console.log('- 数据库:', dbConfig.database);
  
  // 显示当前目录
  console.log('\n当前工作目录:', process.cwd());
  
  // 列出目录中的SQL文件
  const files = fs.readdirSync('.');
  const sqlFiles = files.filter(file => file.endsWith('.sql'));
  
  console.log('\n发现以下SQL文件:');
  sqlFiles.forEach(file => {
    const stats = fs.statSync(file);
    console.log(`- ${file} (${stats.size} 字节)`);
  });
  
  if (sqlFiles.length === 0) {
    console.log('未找到任何SQL文件，导入终止');
    return;
  }
  
  // 选择要导入的SQL文件
  const sqlFile = './quizdb.sql';
  if (!fs.existsSync(sqlFile)) {
    console.error(`指定的SQL文件 ${sqlFile} 不存在`);
    return;
  }
  
  console.log(`\n将导入SQL文件: ${sqlFile}`);
  
  try {
    // 先创建不带数据库名的连接
    console.log('\n1. 连接MySQL服务器...');
    const initialConnection = await mysql.createConnection({
      host: dbConfig.host,
      user: dbConfig.user,
      password: dbConfig.password,
      multipleStatements: true
    });
    
    console.log('连接成功!');
    
    // 创建数据库（如果不存在）
    console.log(`\n2. 确保数据库 ${dbConfig.database} 存在...`);
    await initialConnection.query(`CREATE DATABASE IF NOT EXISTS ${dbConfig.database}`);
    console.log('数据库已创建或已存在');
    
    // 使用指定的数据库
    console.log(`\n3. 切换到数据库 ${dbConfig.database}...`);
    await initialConnection.query(`USE ${dbConfig.database}`);
    console.log('切换成功');
    
    // 读取SQL文件内容
    console.log(`\n4. 读取SQL文件 ${sqlFile}...`);
    const sqlContent = fs.readFileSync(sqlFile, 'utf8');
    console.log(`读取成功，文件大小: ${sqlContent.length} 字节`);
    
    // 分析SQL内容，检查是否有创建数据库语句
    if (sqlContent.includes('CREATE DATABASE') || sqlContent.includes('create database')) {
      console.log('\n警告: SQL文件包含创建数据库的语句，这可能导致问题');
    }
    
    // 执行SQL语句
    console.log('\n5. 执行SQL语句...');
    await initialConnection.query(sqlContent);
    console.log('SQL语句执行成功!');
    
    // 检查导入结果
    console.log('\n6. 验证导入结果...');
    
    try {
      // 检查表是否存在
      const [tables] = await initialConnection.query('SHOW TABLES');
      console.log(`数据库中有 ${tables.length} 个表:`);
      tables.forEach(table => {
        console.log(`- ${Object.values(table)[0]}`);
      });
      
      // 检查特定表中的数据
      if (tables.some(t => Object.values(t)[0] === 'question_sets')) {
        const [questionSets] = await initialConnection.query('SELECT id, title FROM question_sets');
        console.log(`\n题库表中有 ${questionSets.length} 条记录`);
      }
      
      if (tables.some(t => Object.values(t)[0] === 'questions')) {
        const [questions] = await initialConnection.query('SELECT COUNT(*) AS count FROM questions');
        console.log(`题目表中有 ${questions[0].count} 条记录`);
      }
    } catch (checkError) {
      console.error('验证导入结果时出错:', checkError.message);
    }
    
    // 关闭连接
    await initialConnection.end();
    console.log('\n数据库连接已关闭');
    console.log('\n=== SQL导入完成 ===');
  } catch (error) {
    console.error('\n导入失败:', error);
  }
}

// 执行导入
importSql()
  .then(() => console.log('脚本执行完毕'))
  .catch(err => console.error('未处理的错误:', err)); 