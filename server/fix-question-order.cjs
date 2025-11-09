#!/usr/bin/env node

const { Sequelize } = require('sequelize');

// 创建数据库连接
// ⚠️ 使用前に環境変数またはコマンドライン引数でパスワードを設定してください
const sequelize = new Sequelize({
  dialect: 'mysql',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '3306'),
  database: process.env.DB_NAME || 'exam_system',
  username: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || 'your_password_here',  // 環境変数から読み込み
  logging: false
});

async function checkAndFixQuestionOrder() {
  try {
    console.log('正在连接数据库...\n');
    
    // 1. 获取最新的题库
    const [questionSets] = await sequelize.query(`
      SELECT id, title, createdAt 
      FROM question_sets 
      ORDER BY createdAt DESC 
      LIMIT 5
    `);
    
    if (questionSets.length === 0) {
      console.log('没有找到任何题库');
      await sequelize.close();
      return;
    }
    
    console.log('最近创建的5个题库:');
    questionSets.forEach((qs, i) => {
      console.log(`${i+1}. ${qs.title} (ID: ${qs.id.substring(0, 8)}..., 创建于: ${new Date(qs.createdAt).toLocaleString()})`);
    });
    
    const latestQuestionSet = questionSets[0];
    console.log(`\n正在检查题库: ${latestQuestionSet.title}`);
    console.log(`题库ID: ${latestQuestionSet.id}\n`);
    
    // 2. 获取该题库的题目列表
    const [questions] = await sequelize.query(`
      SELECT id, text, orderIndex, createdAt 
      FROM questions 
      WHERE questionSetId = ? 
      ORDER BY createdAt ASC
    `, {
      replacements: [latestQuestionSet.id]
    });
    
    if (questions.length === 0) {
      console.log('该题库中没有题目');
      await sequelize.close();
      return;
    }
    
    console.log(`找到 ${questions.length} 道题目\n`);
    
    // 3. 检查orderIndex是否正确
    let needsFix = false;
    const issues = [];
    
    questions.forEach((q, i) => {
      const expectedOrder = i;
      const actualOrder = q.orderIndex;
      
      if (expectedOrder !== actualOrder) {
        needsFix = true;
        issues.push({
          index: i,
          id: q.id,
          expected: expectedOrder,
          actual: actualOrder,
          text: q.text.substring(0, 50)
        });
      }
    });
    
    if (needsFix) {
      console.log('❌ 发现排序问题！以下题目的orderIndex不正确:\n');
      issues.forEach(issue => {
        console.log(`序号${issue.index + 1}: orderIndex=${issue.actual} (期望${issue.expected})`);
        console.log(`   ID: ${issue.id.substring(0, 8)}...`);
        console.log(`   题干: ${issue.text}...\n`);
      });
      
      // 询问是否修复
      console.log('是否要修复这些问题？将按创建时间顺序重新设置orderIndex。');
      console.log('执行命令: node fix-question-order.js --fix\n');
      
      // 如果传入了 --fix 参数，则执行修复
      if (process.argv.includes('--fix')) {
        console.log('开始修复orderIndex...\n');
        
        for (let i = 0; i < questions.length; i++) {
          const q = questions[i];
          await sequelize.query(`
            UPDATE questions 
            SET orderIndex = ? 
            WHERE id = ?
          `, {
            replacements: [i, q.id]
          });
          console.log(`✓ 更新题目 ${i + 1}/${questions.length}: orderIndex=${i}`);
        }
        
        console.log('\n✅ 修复完成！');
        
        // 验证修复结果
        const [verifyQuestions] = await sequelize.query(`
          SELECT id, text, orderIndex 
          FROM questions 
          WHERE questionSetId = ? 
          ORDER BY orderIndex ASC
          LIMIT 10
        `, {
          replacements: [latestQuestionSet.id]
        });
        
        console.log('\n修复后的前10道题目:');
        verifyQuestions.forEach((q, i) => {
          console.log(`${i+1}. orderIndex=${q.orderIndex}, 题干: ${q.text.substring(0, 50)}...`);
        });
      }
    } else {
      console.log('✅ orderIndex排序正常！');
      
      // 显示前10道题目
      const displayQuestions = questions.slice(0, 10);
      console.log('\n前10道题目:');
      displayQuestions.forEach((q, i) => {
        console.log(`${i+1}. orderIndex=${q.orderIndex}, 题干: ${q.text.substring(0, 50)}...`);
      });
    }
    
    // 4. 检查是否有重复的orderIndex
    const [duplicates] = await sequelize.query(`
      SELECT orderIndex, COUNT(*) as count
      FROM questions 
      WHERE questionSetId = ? 
      GROUP BY orderIndex
      HAVING COUNT(*) > 1
    `, {
      replacements: [latestQuestionSet.id]
    });
    
    if (duplicates.length > 0) {
      console.log('\n⚠️  发现重复的orderIndex:');
      duplicates.forEach(d => {
        console.log(`  orderIndex=${d.orderIndex} 出现了 ${d.count} 次`);
      });
      console.log('\n建议执行: node fix-question-order.js --fix');
    }
    
    // 5. 检查NULL值
    const [nullOrders] = await sequelize.query(`
      SELECT COUNT(*) as count
      FROM questions 
      WHERE questionSetId = ? AND orderIndex IS NULL
    `, {
      replacements: [latestQuestionSet.id]
    });
    
    if (nullOrders[0].count > 0) {
      console.log(`\n⚠️  发现 ${nullOrders[0].count} 道题目的orderIndex为NULL`);
      console.log('建议执行: node fix-question-order.js --fix');
    }
    
  } catch (error) {
    console.error('检查失败:', error.message);
    console.error(error);
  } finally {
    await sequelize.close();
  }
}

checkAndFixQuestionOrder();
