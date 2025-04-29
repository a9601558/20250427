'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // 添加 isAdmin 字段
    await queryInterface.addColumn('users', 'isAdmin', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false
    });

    // 将现有的 admin role 转换为 isAdmin = true
    await queryInterface.sequelize.query(
      `UPDATE users SET "isAdmin" = true WHERE role = 'admin'`
    );

    // 删除 role 字段
    await queryInterface.removeColumn('users', 'role');
  },

  down: async (queryInterface, Sequelize) => {
    // 添加 role 字段
    await queryInterface.addColumn('users', 'role', {
      type: Sequelize.ENUM('user', 'admin'),
      allowNull: false,
      defaultValue: 'user'
    });

    // 将 isAdmin = true 转换为 role = 'admin'
    await queryInterface.sequelize.query(
      `UPDATE users SET role = 'admin' WHERE "isAdmin" = true`
    );

    // 删除 isAdmin 字段
    await queryInterface.removeColumn('users', 'isAdmin');
  }
}; 