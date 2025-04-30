'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const transaction = await queryInterface.sequelize.transaction();
    
    try {
      // 检查索引是否存在
      const indexes = await queryInterface.showIndex('users');
      
      // 删除重复的索引
      for (const index of indexes) {
        if (index.name !== 'PRIMARY' && 
            (index.name.includes('username') || index.name.includes('email'))) {
          await queryInterface.removeIndex('users', index.name, { transaction });
        }
      }
      
      // 重新创建必要的索引
      await queryInterface.addIndex('users', ['username'], {
        unique: true,
        name: 'users_username_unique',
        transaction
      });
      
      await queryInterface.addIndex('users', ['email'], {
        unique: true,
        name: 'users_email_unique',
        transaction
      });
      
      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      console.error('Migration failed:', error);
      throw error;
    }
  },

  down: async (queryInterface, Sequelize) => {
    const transaction = await queryInterface.sequelize.transaction();
    
    try {
      // 删除索引
      await queryInterface.removeIndex('users', 'users_username_unique', { transaction });
      await queryInterface.removeIndex('users', 'users_email_unique', { transaction });
      
      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      console.error('Migration rollback failed:', error);
      throw error;
    }
  }
}; 