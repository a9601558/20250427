'use strict';

// Standardized default values to match defaultHomepageSettings
const DEFAULT_WELCOME_TITLE = 'MonTopi 模擬練習';
const DEFAULT_WELCOME_DESCRIPTION = '以下のいずれかの問題集を選択して練習を開始し、あなたの知識レベルをテストしてください';
const DEFAULT_FEATURED_CATEGORIES = ['ネットワークプロトコル', 'プログラミング言語', 'コンピュータ基礎'];
const DEFAULT_ANNOUNCEMENTS = 'MonTopiオンライン問題集システムへようこそ！新しい問題集を随時追加していますので、ぜひチェックしてください！';
const DEFAULT_FOOTER_TEXT = '© 2025 MonTopi オンライン問題集システム 全権利保留';
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