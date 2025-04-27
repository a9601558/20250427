/**
 * 数据迁移脚本：将购买记录中的quizId迁移到questionSetId
 * 
 * 此脚本会:
 * 1. 备份购买表数据
 * 2. 将quizId字段值复制到questionSetId字段
 * 3. 更新关联的外键
 * 
 * 使用方法：
 * 1. 确保已安装mysql模块: npm install mysql2
 * 2. 运行：node migrate-data.js
 */

const mysql = require('mysql2/promise');

// 数据库配置
const dbConfig = {
  host: 'localhost',
  user: 'root',
  password: 'yourpassword',  // 替换为你的数据库密码
  database: 'quizdb'
};

async function migrateData() {
  console.log('开始迁移数据...');
  
  let connection;
  try {
    // 连接数据库
    connection = await mysql.createConnection(dbConfig);
    
    // 1. 备份表
    console.log('备份购买表...');
    await connection.execute(`CREATE TABLE purchases_backup LIKE purchases`);
    await connection.execute(`INSERT INTO purchases_backup SELECT * FROM purchases`);
    console.log('备份完成。');
    
    // 2. 获取并打印当前的购买记录数量
    const [rows] = await connection.execute(`SELECT COUNT(*) as count FROM purchases`);
    console.log(`当前有 ${rows[0].count} 条购买记录需要迁移。`);
    
    // 3. 对 MySQL 版本，如果表已修改结构，则复制数据
    console.log('复制 quizId 值到 questionSetId...');
    
    try {
      // 首先检查 questionSetId 字段是否存在，如果不存在则SQL会抛出错误
      await connection.execute(`SELECT questionSetId FROM purchases LIMIT 1`);
      
      // 如果上面没抛错，则字段已存在，我们来更新数据
      await connection.execute(`
        UPDATE purchases 
        SET questionSetId = quizId 
        WHERE questionSetId IS NULL
      `);
      console.log('数据复制完成。');
    } catch (e) {
      // 如果字段不存在，说明还没有进行表结构修改，提示先修改表结构
      console.error('错误：字段questionSetId不存在。请先执行表结构变更SQL，然后再运行此脚本。');
      throw e;
    }
    
    // 4. 验证迁移结果
    const [verification] = await connection.execute(`
      SELECT COUNT(*) as count 
      FROM purchases 
      WHERE questionSetId IS NULL OR questionSetId = ''
    `);
    
    if (verification[0].count > 0) {
      console.log(`警告：${verification[0].count} 条记录的 questionSetId 为空，请检查。`);
    } else {
      console.log('所有记录已成功迁移。');
    }
    
    console.log('数据迁移完成！');
  } catch (error) {
    console.error('迁移过程中发生错误:', error);
    
    // 如果出错，提供回滚指南
    console.log('\n如需回滚，请执行以下SQL:');
    console.log(`DROP TABLE IF EXISTS purchases;`);
    console.log(`RENAME TABLE purchases_backup TO purchases;`);
    
    throw error;
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

// 执行迁移
migrateData()
  .then(() => {
    console.log('迁移脚本执行完毕。');
    process.exit(0);
  })
  .catch(err => {
    console.error('迁移失败，请查看错误信息并修复:', err);
    process.exit(1);
  }); 