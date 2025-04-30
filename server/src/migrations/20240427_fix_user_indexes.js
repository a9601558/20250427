'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // 1. 删除所有现有的索引
    await queryInterface.removeIndex('users', 'PRIMARY');
    await queryInterface.removeIndex('users', 'users_username_unique');
    await queryInterface.removeIndex('users', 'users_email_unique');
    
    // 2. 重新创建必要的索引
    await queryInterface.addIndex('users', ['id'], {
      unique: true,
      name: 'PRIMARY'
    });
    
    await queryInterface.addIndex('users', ['username'], {
      unique: true,
      name: 'users_username_unique'
    });
    
    await queryInterface.addIndex('users', ['email'], {
      unique: true,
      name: 'users_email_unique'
    });
  },

  down: async (queryInterface, Sequelize) => {
    // 回滚操作
    await queryInterface.removeIndex('users', 'users_username_unique');
    await queryInterface.removeIndex('users', 'users_email_unique');
  }
}; 