'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    try {
      console.log('开始清理冗余索引...');
      
      // 删除users表中的冗余索引
      await queryInterface.sequelize.query(`
        SELECT COUNT(*) 
        FROM INFORMATION_SCHEMA.STATISTICS 
        WHERE table_schema = DATABASE() 
        AND table_name = 'users' 
        AND index_name = 'username_2'
      `).then(async ([results]) => {
        if (results[0]['COUNT(*)'] > 0) {
          await queryInterface.sequelize.query('ALTER TABLE users DROP INDEX username_2');
          console.log('删除索引: users.username_2');
        }
      });
      
      // 对其他重复索引执行同样的操作
      const userIndexesToDrop = [
        'email_2', 'username_3', 'email_3', 'username_4', 'email_4',
        'username_5', 'email_5', 'username_6', 'email_6', 'username_7',
        'email_7', 'username_8', 'email_8'
      ];
      
      for (const indexName of userIndexesToDrop) {
        await queryInterface.sequelize.query(`
          SELECT COUNT(*) 
          FROM INFORMATION_SCHEMA.STATISTICS 
          WHERE table_schema = DATABASE() 
          AND table_name = 'users' 
          AND index_name = '${indexName}'
        `).then(async ([results]) => {
          if (results[0]['COUNT(*)'] > 0) {
            await queryInterface.sequelize.query(`ALTER TABLE users DROP INDEX ${indexName}`);
            console.log(`删除索引: users.${indexName}`);
          }
        });
      }
      
      // 删除redeem_codes表中的冗余索引
      const redeemCodeIndexesToDrop = [
        'code_2', 'code_3', 'code_4', 'code_5', 'code_6', 'code_7', 'code_8'
      ];
      
      for (const indexName of redeemCodeIndexesToDrop) {
        await queryInterface.sequelize.query(`
          SELECT COUNT(*) 
          FROM INFORMATION_SCHEMA.STATISTICS 
          WHERE table_schema = DATABASE() 
          AND table_name = 'redeem_codes' 
          AND index_name = '${indexName}'
        `).then(async ([results]) => {
          if (results[0]['COUNT(*)'] > 0) {
            await queryInterface.sequelize.query(`ALTER TABLE redeem_codes DROP INDEX ${indexName}`);
            console.log(`删除索引: redeem_codes.${indexName}`);
          }
        });
      }
      
      console.log('冗余索引清理完成');
      return Promise.resolve();
      
    } catch (error) {
      console.error('清理索引时出错:', error);
      return Promise.reject(error);
    }
  },

  // 如果需要回滚，这个操作很难精确恢复，因为我们不确定之前是哪些索引
  // 所以这里只提供创建标准索引的操作
  down: async (queryInterface, Sequelize) => {
    try {
      // 仅创建基本索引，不恢复冗余索引
      console.log('回滚操作: 确保基本索引存在');
      
      // 检查并添加users表的基本索引
      await queryInterface.sequelize.query(`
        SELECT COUNT(*) 
        FROM INFORMATION_SCHEMA.STATISTICS 
        WHERE table_schema = DATABASE() 
        AND table_name = 'users' 
        AND index_name = 'username'
      `).then(async ([results]) => {
        if (results[0]['COUNT(*)'] === 0) {
          await queryInterface.sequelize.query('ALTER TABLE users ADD UNIQUE INDEX username (username)');
          console.log('创建索引: users.username');
        }
      });
      
      await queryInterface.sequelize.query(`
        SELECT COUNT(*) 
        FROM INFORMATION_SCHEMA.STATISTICS 
        WHERE table_schema = DATABASE() 
        AND table_name = 'users' 
        AND index_name = 'email'
      `).then(async ([results]) => {
        if (results[0]['COUNT(*)'] === 0) {
          await queryInterface.sequelize.query('ALTER TABLE users ADD UNIQUE INDEX email (email)');
          console.log('创建索引: users.email');
        }
      });
      
      // 检查并添加redeem_codes表的基本索引
      await queryInterface.sequelize.query(`
        SELECT COUNT(*) 
        FROM INFORMATION_SCHEMA.STATISTICS 
        WHERE table_schema = DATABASE() 
        AND table_name = 'redeem_codes' 
        AND index_name = 'code'
      `).then(async ([results]) => {
        if (results[0]['COUNT(*)'] === 0) {
          await queryInterface.sequelize.query('ALTER TABLE redeem_codes ADD UNIQUE INDEX code (code)');
          console.log('创建索引: redeem_codes.code');
        }
      });
      
      console.log('基本索引恢复完成');
      return Promise.resolve();
      
    } catch (error) {
      console.error('恢复索引时出错:', error);
      return Promise.reject(error);
    }
  }
}; 