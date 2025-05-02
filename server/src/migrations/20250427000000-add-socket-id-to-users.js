'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('users', 'socket_id', {
      type: Sequelize.STRING(255),
      allowNull: true,
      defaultValue: null,
      comment: '用户Socket连接ID',
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('users', 'socket_id');
  },
}; 
