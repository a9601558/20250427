// 导入SQL数据的脚本
const fs = require('fs');
const mysql = require('mysql2/promise');
const dotenv = require('dotenv');

dotenv.config();

// 数据库连接配置
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'exam_practice',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
};

// 从SQL文件中读取数据
const importData = async () => {
  try {
    // 创建数据库连接
    const connection = await mysql.createConnection({
      host: dbConfig.host,
      user: dbConfig.user,
      password: dbConfig.password,
      database: dbConfig.database,
      multipleStatements: true // 允许执行多条SQL语句
    });

    console.log('数据库连接成功');

    // 1. 检查题库是否存在
    const [questionSets] = await connection.execute('SELECT id, title FROM question_sets');
    console.log(`当前数据库中有 ${questionSets.length} 个题库`);

    // 从题库表读取数据，确保关系正确
    const [sets] = await connection.execute(`
      SELECT 
        qs.id, 
        qs.title, 
        qs.description, 
        qs.category, 
        qs.icon, 
        qs.isPaid, 
        qs.price, 
        qs.trialQuestions,
        qs.isFeatured,
        qs.featuredCategory,
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

    // 检查关系是否正确
    const questionsMap = {};
    questions.forEach(q => {
      if (!questionsMap[q.questionSetId]) {
        questionsMap[q.questionSetId] = [];
      }
      questionsMap[q.questionSetId].push(q);
    });

    console.log('各题库题目数量详情:');
    for (const setId in questionsMap) {
      const setInfo = sets.find(s => s.id === setId);
      const setTitle = setInfo ? setInfo.title : '未知题库';
      console.log(`- ${setTitle} (ID: ${setId}): ${questionsMap[setId].length} 个题目`);
    }

    // 如果quizdb.sql文件存在，则导入
    if (fs.existsSync('./quizdb.sql')) {
      console.log('发现SQL文件，准备导入...');
      
      // 读取SQL文件内容
      const sqlContent = fs.readFileSync('./quizdb.sql', 'utf8');
      
      // 执行SQL
      await connection.query(sqlContent);
      
      console.log('SQL文件导入成功');
    } else {
      console.log('未找到SQL文件，跳过导入');
    }

    // 最后统计导入后的数据
    const [updatedSets] = await connection.execute(`
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

    console.log('导入后题库统计:');
    updatedSets.forEach(set => {
      console.log(`- ${set.title} (ID: ${set.id}): ${set.questionCount} 个题目`);
    });

    await connection.end();
    console.log('数据库连接已关闭');
  } catch (error) {
    console.error('导入数据失败:', error);
  }
};

// 运行导入
importData(); 