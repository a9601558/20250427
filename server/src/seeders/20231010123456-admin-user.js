'use strict';
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    // 检查是否已有用户
    const users = await queryInterface.sequelize.query(
      `SELECT id FROM users WHERE username = 'admin'`,
      { type: Sequelize.QueryTypes.SELECT }
    );
    
    if (users.length > 0) {
      console.log('管理员用户已存在，跳过创建');
      return;
    }
    
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash('admin123', salt);
    
    await queryInterface.bulkInsert('users', [{
      id: uuidv4(),
      username: 'admin',
      email: 'admin@example.com',
      password: hashedPassword,
      isAdmin: true,
      progress: JSON.stringify({}),
      purchases: JSON.stringify([]),
      redeemCodes: JSON.stringify([]),
      createdAt: new Date(),
      updatedAt: new Date()
    }]);
    
    console.log('管理员用户创建成功！');
    console.log('用户名: admin');
    console.log('密码: admin123');
  },

  async down (queryInterface, Sequelize) {
    await queryInterface.bulkDelete('users', { username: 'admin' }, {});
  }
}; 