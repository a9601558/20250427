// 导入SQL数据的脚本
const fs = require('fs');
const mysql = require('mysql2/promise');
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

// 从SQL文件中读取数据
const importData = async () => {
  try {
    console.log('使用以下配置连接数据库:');
    console.log('- 主机:', dbConfig.host);
    console.log('- 用户:', dbConfig.user);
    console.log('- 数据库:', dbConfig.database);
    
    // 先创建不带数据库名的连接
    const initialConnection = await mysql.createConnection({
      host: dbConfig.host,
      user: dbConfig.user,
      password: dbConfig.password,
      multipleStatements: true
    });
    
    console.log('初始数据库连接成功');
    
    // 创建数据库（如果不存在）
    await initialConnection.query(`CREATE DATABASE IF NOT EXISTS ${dbConfig.database}`);
    console.log(`确保数据库 ${dbConfig.database} 存在`);
    
    // 关闭初始连接
    await initialConnection.end();
    
    // 创建带有数据库名的连接
    const connection = await mysql.createConnection({
      host: dbConfig.host,
      user: dbConfig.user,
      password: dbConfig.password,
      database: dbConfig.database,
      multipleStatements: true // 允许执行多条SQL语句
    });

    console.log(`已连接到数据库 ${dbConfig.database}`);

    // 如果quizdb.sql文件存在，则导入
    const sqlFile = './quizdb.sql';
    if (fs.existsSync(sqlFile)) {
      console.log(`发现SQL文件 ${sqlFile}，准备导入...`);
      
      try {
        // 读取SQL文件内容
        const sqlContent = fs.readFileSync(sqlFile, 'utf8');
        console.log(`成功读取SQL文件，大小: ${sqlContent.length} 字节`);
        
        // 执行SQL
        await connection.query(sqlContent);
        
        console.log('SQL文件导入成功');
      } catch (sqlError) {
        console.error('SQL文件导入失败:', sqlError.message);
      }
    } else {
      console.log(`未找到SQL文件 ${sqlFile}，跳过导入`);
      
      // 列出当前目录的文件
      console.log('当前目录文件列表:');
      const files = fs.readdirSync('.');
      files.forEach(file => {
        const stats = fs.statSync(file);
        console.log(`- ${file} (${stats.size} 字节)`);
      });
    }

    // 检查数据库内容
    try {
      // 1. 检查题库是否存在
      const [questionSets] = await connection.execute('SELECT id, title FROM question_sets');
      console.log(`当前数据库中有 ${questionSets.length} 个题库`);

      // 从题库表读取数据，确保关系正确
      const [sets] = await connection.execute(`
        SELECT 
          qs.id, 
          qs.title, 
          COUNT(q.id) AS questionCount
        FROM 
          question_sets qs
        LEFT JOIN 
          questions q ON qs.id = q.questionSetId
        GROUP BY 
          qs.id
      `);

      console.log('题库统计信息:');
      sets.forEach(set => {
        console.log(`- ${set.title} (ID: ${set.id}): ${set.questionCount} 个题目`);
      });

      // 2. 检查题目是否存在及其关系
      const [questions] = await connection.execute('SELECT id, questionSetId, text FROM questions');
      console.log(`当前数据库中有 ${questions.length} 个题目`);

      // 3. 检查选项是否存在及其关系
      const [options] = await connection.execute('SELECT id, questionId, text, isCorrect FROM options');
      console.log(`当前数据库中有 ${options.length} 个选项`);
    } catch (err) {
      console.log('数据库内容检查出错，可能是表结构不一致:', err.message);
    }

    await connection.end();
    console.log('数据库连接已关闭');
  } catch (error) {
    console.error('导入数据失败:', error);
  }
};

// 运行导入
importData(); 