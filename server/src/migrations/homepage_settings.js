'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('homepage_settings', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        defaultValue: 1
      },
      welcome_title: {
        type: Sequelize.STRING(255),
        allowNull: false,
        defaultValue: 'ExamTopics 模拟练习'
      },
      welcome_description: {
        type: Sequelize.TEXT,
        allowNull: false,
        defaultValue: '选择以下任一题库开始练习，测试您的知识水平'
      },
      featured_categories: {
        type: Sequelize.TEXT,
        allowNull: true,
        defaultValue: JSON.stringify(['网络协议', '编程语言', '计算机基础'])
      },
      announcements: {
        type: Sequelize.TEXT,
        allowNull: true,
        defaultValue: '欢迎使用在线题库系统，新增题库将定期更新，请持续关注！'
      },
      footer_text: {
        type: Sequelize.TEXT,
        allowNull: true,
        defaultValue: '© 2023 ExamTopics 在线题库系统 保留所有权利'
      },
      banner_image: {
        type: Sequelize.STRING(255),
        allowNull: true,
        defaultValue: '/images/banner.jpg'
      },
      theme: {
        type: Sequelize.STRING(50),
        allowNull: true,
        defaultValue: 'light'
      },
      created_at: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      updated_at: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP')
      }
    });

    // Insert default record
    await queryInterface.bulkInsert('homepage_settings', [{
      id: 1,
      welcome_title: 'ExamTopics 模拟练习',
      welcome_description: '选择以下任一题库开始练习，测试您的知识水平',
      featured_categories: JSON.stringify(['网络协议', '编程语言', '计算机基础']),
      announcements: '欢迎使用在线题库系统，新增题库将定期更新，请持续关注！',
      footer_text: '© 2023 ExamTopics 在线题库系统 保留所有权利',
      banner_image: '/images/banner.jpg',
      theme: 'light'
    }]);
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('homepage_settings');
  }
}; 