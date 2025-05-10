'use strict';

// Standardized default values to match defaultHomepageSettings
const DEFAULT_WELCOME_TITLE = 'Exam7 模拟练习';
const DEFAULT_WELCOME_DESCRIPTION = '选择以下任一题库开始练习，测试您的知识水平';
const DEFAULT_FEATURED_CATEGORIES = ['网络协议', '编程语言', '计算机基础'];
const DEFAULT_ANNOUNCEMENTS = '欢迎使用在线题库系统，新增题库将定期更新，请持续关注！';
const DEFAULT_FOOTER_TEXT = '© 2023 Exam7 在线题库系统 保留所有权利';
const DEFAULT_BANNER_IMAGE = '/images/banner.jpg';
const DEFAULT_THEME = 'light';

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
        defaultValue: DEFAULT_WELCOME_TITLE
      },
      welcome_description: {
        type: Sequelize.TEXT,
        allowNull: false,
        defaultValue: DEFAULT_WELCOME_DESCRIPTION
      },
      featured_categories: {
        type: Sequelize.TEXT,
        allowNull: true,
        defaultValue: JSON.stringify(DEFAULT_FEATURED_CATEGORIES)
      },
      announcements: {
        type: Sequelize.TEXT,
        allowNull: true,
        defaultValue: DEFAULT_ANNOUNCEMENTS
      },
      footer_text: {
        type: Sequelize.TEXT,
        allowNull: true,
        defaultValue: DEFAULT_FOOTER_TEXT
      },
      banner_image: {
        type: Sequelize.STRING(255),
        allowNull: true,
        defaultValue: DEFAULT_BANNER_IMAGE
      },
      theme: {
        type: Sequelize.STRING(50),
        allowNull: true,
        defaultValue: DEFAULT_THEME
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
      welcome_title: DEFAULT_WELCOME_TITLE,
      welcome_description: DEFAULT_WELCOME_DESCRIPTION,
      featured_categories: JSON.stringify(DEFAULT_FEATURED_CATEGORIES),
      announcements: DEFAULT_ANNOUNCEMENTS,
      footer_text: DEFAULT_FOOTER_TEXT,
      banner_image: DEFAULT_BANNER_IMAGE,
      theme: DEFAULT_THEME
    }]);
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('homepage_settings');
  }
}; 