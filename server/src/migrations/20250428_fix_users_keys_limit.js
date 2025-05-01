'use strict';

/**
 * 解决部署时的"ER_TOO_MANY_KEYS"错误
 * 此迁移文件会移除多余的索引，然后以安全的方式重建必要的索引
 */
module.exports = {
  up: async (queryInterface, Sequelize) => {
    const transaction = await queryInterface.sequelize.transaction();
    
    try {
      console.log('执行 users 表索引修复迁移');
      
      // 1. 先检查表是否存在
      const tables = await queryInterface.showAllTables();
      if (!tables.includes('users')) {
        console.log('users 表不存在，跳过此迁移');
        await transaction.commit();
        return;
      }
      
      // 2. 获取表结构
      const tableDescription = await queryInterface.describeTable('users');
      console.log('表结构:', Object.keys(tableDescription));
      
      // 3. 获取所有索引
      const indexesResult = await queryInterface.sequelize.query(
        'SHOW INDEX FROM `users`',
        { transaction }
      );
      const indexes = indexesResult[0];
      console.log(`找到 ${indexes.length} 个索引`);
      
      // 记录所有需要移除的索引名称（除了PRIMARY主键）
      const indexesToRemove = new Set();
      indexes.forEach(index => {
        if (index.Key_name !== 'PRIMARY') {
          indexesToRemove.add(index.Key_name);
        }
      });
      
      console.log('将要移除的索引:', [...indexesToRemove]);
      
      // 4. 移除所有非主键索引
      for (const indexName of indexesToRemove) {
        try {
          console.log(`移除索引: ${indexName}`);
          await queryInterface.sequelize.query(
            `ALTER TABLE \`users\` DROP INDEX \`${indexName}\``,
            { transaction }
          );
        } catch (error) {
          console.log(`移除索引 ${indexName} 失败:`, error.message);
          // 继续执行，不要中断
        }
      }
      
      // 5. 确保username和email列没有UNIQUE约束但仍然是正确的类型
      await queryInterface.sequelize.query(
        'ALTER TABLE `users` MODIFY `username` VARCHAR(50) NOT NULL',
        { transaction }
      );
      
      await queryInterface.sequelize.query(
        'ALTER TABLE `users` MODIFY `email` VARCHAR(100) NOT NULL',
        { transaction }
      );
      
      // 6. 添加必要的索引（只添加最重要的，避免超过限制）
      console.log('添加必要的索引');
      await queryInterface.addIndex('users', ['username'], {
        unique: true,
        name: 'users_username_idx',
        transaction
      });
      
      await queryInterface.addIndex('users', ['email'], {
        unique: true,
        name: 'users_email_idx',
        transaction
      });
      
      console.log('users 表索引修复完成');
      await transaction.commit();
    } catch (error) {
      console.error('迁移失败:', error);
      await transaction.rollback();
      throw error;
    }
  },

  down: async (queryInterface, Sequelize) => {
    // 不提供回滚操作，因为这是修复操作
    console.log('此迁移不提供回滚操作');
  }
}; 