'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // 1. 创建homepage_settings表
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

    // 插入默认记录
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

    // 2. 检查question_sets表中是否有is_featured列，如果没有则添加
    try {
      // 检查列是否存在
      const tableInfo = await queryInterface.describeTable('question_sets');
      
      if (!tableInfo.is_featured) {
        // 如果不存在，添加is_featured列
        await queryInterface.addColumn('question_sets', 'is_featured', {
          type: Sequelize.BOOLEAN,
          defaultValue: false,
          allowNull: false
        });
        
        console.log('Added is_featured column to question_sets table');
      }
    } catch (error) {
      console.error('Error checking or adding is_featured column:', error);
    }
  },

  down: async (queryInterface, Sequelize) => {
    // 删除homepage_settings表
    await queryInterface.dropTable('homepage_settings');
    
    // 删除question_sets表的is_featured列
    try {
      await queryInterface.removeColumn('question_sets', 'is_featured');
    } catch (error) {
      console.error('Error removing is_featured column:', error);
    }
  }
}; 