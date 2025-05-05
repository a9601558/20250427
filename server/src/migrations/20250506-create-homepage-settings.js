'use strict';

/**
 * Migration script to create homepage_settings table
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    try {
      // Check if table exists
      const tableExists = await queryInterface.showAllTables()
        .then(tables => tables.includes('homepage_settings'));
      
      if (!tableExists) {
        console.log('Creating homepage_settings table...');
        
        await queryInterface.createTable('homepage_settings', {
          id: {
            type: Sequelize.INTEGER,
            primaryKey: true,
            autoIncrement: true,
            allowNull: false
          },
          welcome_title: {
            type: Sequelize.STRING(255),
            allowNull: false,
            defaultValue: 'ExamTopics Practice'
          },
          welcome_description: {
            type: Sequelize.TEXT,
            allowNull: false,
            defaultValue: 'Choose any of the following question sets to practice and test your knowledge'
          },
          featured_categories: {
            type: Sequelize.TEXT,
            allowNull: true,
            defaultValue: JSON.stringify(['Network Protocols', 'Programming Languages', 'Computer Basics'])
          },
          announcements: {
            type: Sequelize.TEXT,
            allowNull: true,
            defaultValue: 'Welcome to the online quiz system. New question sets will be updated regularly!'
          },
          footer_text: {
            type: Sequelize.STRING(255),
            allowNull: true,
            defaultValue: '© 2023 ExamTopics Online Quiz System. All rights reserved.'
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
            allowNull: false,
            defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
          },
          updated_at: {
            type: Sequelize.DATE,
            allowNull: false,
            defaultValue: Sequelize.literal('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP')
          }
        });
        
        // Insert initial record
        await queryInterface.bulkInsert('homepage_settings', [{
          id: 1,
          welcome_title: "ExamTopics 模拟练习",
          welcome_description: "选择以下任一题库开始练习，测试您的知识水平",
          featured_categories: JSON.stringify(["网络协议", "编程语言", "计算机基础"]),
          announcements: "欢迎使用在线题库系统，新增题库将定期更新，请持续关注！",
          footer_text: "© 2023 ExamTopics 在线题库系统 保留所有权利",
          banner_image: "/images/banner.jpg",
          theme: 'light',
          created_at: new Date(),
          updated_at: new Date()
        }]);
        
        console.log('homepage_settings table created and initialized successfully');
      } else {
        console.log('homepage_settings table already exists, skipping creation');
      }
    } catch (error) {
      console.error('Error creating homepage_settings table:', error);
      throw error;
    }
  },

  async down(queryInterface, Sequelize) {
    try {
      // Drop the table if it exists
      await queryInterface.dropTable('homepage_settings');
      console.log('homepage_settings table dropped successfully');
    } catch (error) {
      console.error('Error dropping homepage_settings table:', error);
      throw error;
    }
  }
}; 