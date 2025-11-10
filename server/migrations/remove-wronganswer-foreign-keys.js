/**
 * 移除 WrongAnswers 表的外键约束
 * 
 * 问题：questionId 外键约束导致无法保存已删除问题的错题记录
 * 解决：移除外键约束，保留 questionId 字段用于记录和查询
 * 
 * 运行方式：
 * node server/migrations/remove-wronganswer-foreign-keys.js
 */

const mysql = require('mysql2/promise');

async function removeWrongAnswerForeignKeys() {
  let connection;
  
  try {
    // 从环境变量或配置文件获取数据库连接信息
    const dbConfig = {
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '3306'),
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || 'zqw20011216',
      database: process.env.DB_NAME || 'quizdb'
    };
    
    console.log('连接数据库:', dbConfig.database);
    connection = await mysql.createConnection(dbConfig);
    
    console.log('开始移除 WrongAnswers 表的外键约束...\n');
    
    // 1. 查询所有外键约束
    const [foreignKeys] = await connection.query(`
      SELECT 
        CONSTRAINT_NAME,
        COLUMN_NAME,
        REFERENCED_TABLE_NAME,
        REFERENCED_COLUMN_NAME
      FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
      WHERE TABLE_SCHEMA = ? 
        AND TABLE_NAME = 'WrongAnswers'
        AND REFERENCED_TABLE_NAME IS NOT NULL
    `, [dbConfig.database]);
    
    if (foreignKeys.length === 0) {
      console.log('✅ 未找到外键约束，无需操作');
      return;
    }
    
    console.log(`找到 ${foreignKeys.length} 个外键约束:`);
    foreignKeys.forEach((fk, i) => {
      console.log(`${i + 1}. ${fk.CONSTRAINT_NAME}: ${fk.COLUMN_NAME} -> ${fk.REFERENCED_TABLE_NAME}.${fk.REFERENCED_COLUMN_NAME}`);
    });
    console.log();
    
    // 2. 删除所有外键约束
    for (const fk of foreignKeys) {
      try {
        console.log(`删除外键约束: ${fk.CONSTRAINT_NAME}...`);
        await connection.query(`
          ALTER TABLE WrongAnswers 
          DROP FOREIGN KEY ${fk.CONSTRAINT_NAME}
        `);
        console.log(`✅ 成功删除: ${fk.CONSTRAINT_NAME}`);
      } catch (error) {
        console.error(`❌ 删除失败: ${fk.CONSTRAINT_NAME}`, error.message);
      }
    }
    
    console.log('\n🎉 外键约束移除完成！');
    console.log('\n📝 说明:');
    console.log('- questionId 字段仍然保留，用于记录和查询');
    console.log('- 现在可以保存已删除问题的错题记录');
    console.log('- 不影响现有数据和功能');
    
  } catch (error) {
    console.error('❌ 执行失败:', error);
    throw error;
  } finally {
    if (connection) {
      await connection.end();
      console.log('\n数据库连接已关闭');
    }
  }
}

// 执行迁移
if (require.main === module) {
  removeWrongAnswerForeignKeys()
    .then(() => {
      console.log('\n✅ 迁移成功完成');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ 迁移失败:', error);
      process.exit(1);
    });
}

module.exports = removeWrongAnswerForeignKeys;
