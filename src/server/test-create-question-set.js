// 测试添加题库的脚本
const mysql = require('mysql2/promise');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config();

async function createTestQuestionSet() {
  // 创建数据库连接
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'quizdb'
  });

  try {
    console.log('连接数据库成功');
    
    // 生成测试题库ID
    const questionSetId = uuidv4();
    
    // 添加测试题库
    console.log('正在添加测试题库...');
    await connection.execute(
      `INSERT INTO question_sets 
       (id, title, description, category, icon, isPaid, price, trialQuestions, createdAt, updatedAt) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      [
        questionSetId,
        '测试题库',
        '这是一个用于测试的题库，包含多个测试题目',
        '测试分类',
        '📚',
        0,  // 不付费
        0,  // 价格为0
        0,  // 试用题目为0
      ]
    );
    
    console.log(`题库添加成功，ID: ${questionSetId}`);
    
    // 添加测试题目
    for (let i = 1; i <= 5; i++) {
      const questionId = `${questionSetId}-q${i}`;
      
      console.log(`添加题目 ${i}...`);
      await connection.execute(
        `INSERT INTO questions
         (id, questionSetId, text, explanation, questionType, orderIndex, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())`,
        [
          questionId,
          questionSetId,
          `测试题目 ${i}，这是题干内容`,
          `这是题目 ${i} 的解析说明`,
          'single',  // 单选题
          i - 1
        ]
      );
      
      // 添加选项
      const options = [
        { text: '选项A', isCorrect: i % 4 === 1, optionIndex: 'A' },
        { text: '选项B', isCorrect: i % 4 === 2, optionIndex: 'B' },
        { text: '选项C', isCorrect: i % 4 === 3, optionIndex: 'C' },
        { text: '选项D', isCorrect: i % 4 === 0, optionIndex: 'D' }
      ];
      
      for (let j = 0; j < options.length; j++) {
        const option = options[j];
        const optionId = `${questionId}-o${j+1}`;
        
        await connection.execute(
          `INSERT INTO options
           (id, questionId, text, isCorrect, optionIndex, createdAt, updatedAt)
           VALUES (?, ?, ?, ?, ?, NOW(), NOW())`,
          [
            optionId,
            questionId,
            option.text,
            option.isCorrect ? 1 : 0,
            option.optionIndex
          ]
        );
      }
      
      console.log(`题目 ${i} 及选项添加完成`);
    }
    
    console.log('测试题库创建成功！');
    
  } catch (error) {
    console.error('创建测试题库失败:', error);
  } finally {
    await connection.end();
    console.log('数据库连接关闭');
  }
}

// 执行创建函数
createTestQuestionSet().catch(console.error); 