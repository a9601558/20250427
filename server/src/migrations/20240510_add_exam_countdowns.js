'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('users', 'examCountdowns', {
      type: Sequelize.JSON,
      allowNull: true,
      defaultValue: '[]',
      comment: '用户保存的考试倒计时数据'
    });
    console.log('Added examCountdowns column to users table');
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('users', 'examCountdowns');
    console.log('Removed examCountdowns column from users table');
  }
}; 