'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    try {
      console.log('Adding missing columns to tables...');
      
      // Check if tables exist
      const tables = await queryInterface.showAllTables();
      
      // 1. Add icon column to question_sets table
      if (tables.includes('question_sets')) {
        const questionSetInfo = await queryInterface.describeTable('question_sets');
        
        // Add icon column if it doesn't exist
        if (!questionSetInfo.icon) {
          console.log('Adding icon column to question_sets table');
          await queryInterface.addColumn('question_sets', 'icon', {
            type: Sequelize.STRING(255),
            allowNull: true,
            comment: 'Icon URL or identifier for the question set'
          });
          console.log('icon column added successfully to question_sets');
        } else {
          console.log('icon column already exists in question_sets table');
        }
        
        // Add is_paid and trial_questions columns if they don't exist
        if (!questionSetInfo.is_paid) {
          console.log('Adding is_paid column to question_sets table');
          await queryInterface.addColumn('question_sets', 'is_paid', {
            type: Sequelize.BOOLEAN,
            allowNull: false,
            defaultValue: false
          });
          console.log('is_paid column added successfully to question_sets');
        }
        
        if (!questionSetInfo.trial_questions) {
          console.log('Adding trial_questions column to question_sets table');
          await queryInterface.addColumn('question_sets', 'trial_questions', {
            type: Sequelize.INTEGER,
            allowNull: true,
            defaultValue: 0
          });
          console.log('trial_questions column added successfully to question_sets');
        }
        
        // Add is_featured and featured_category columns if they don't exist
        if (!questionSetInfo.is_featured) {
          console.log('Adding is_featured column to question_sets table');
          await queryInterface.addColumn('question_sets', 'is_featured', {
            type: Sequelize.BOOLEAN,
            allowNull: false,
            defaultValue: false
          });
          console.log('is_featured column added successfully to question_sets');
        }
        
        if (!questionSetInfo.featured_category) {
          console.log('Adding featured_category column to question_sets table');
          await queryInterface.addColumn('question_sets', 'featured_category', {
            type: Sequelize.STRING(100),
            allowNull: true
          });
          console.log('featured_category column added successfully to question_sets');
        }
      }
      
      // 2. Add socket_id column to users table
      if (tables.includes('users')) {
        const userInfo = await queryInterface.describeTable('users');
        
        // Add socket_id column if it doesn't exist
        if (!userInfo.socket_id) {
          console.log('Adding socket_id column to users table');
          await queryInterface.addColumn('users', 'socket_id', {
            type: Sequelize.STRING(255),
            allowNull: true,
            comment: 'Socket.io connection ID'
          });
          console.log('socket_id column added successfully to users');
        } else {
          console.log('socket_id column already exists in users table');
        }
        
        // Add purchases, redeemCodes, progress columns if they don't exist
        if (!userInfo.purchases) {
          console.log('Adding purchases column to users table');
          await queryInterface.addColumn('users', 'purchases', {
            type: Sequelize.TEXT,
            allowNull: true,
            defaultValue: '[]'
          });
          console.log('purchases column added successfully to users');
        }
        
        if (!userInfo.redeemCodes) {
          console.log('Adding redeemCodes column to users table');
          await queryInterface.addColumn('users', 'redeemCodes', {
            type: Sequelize.TEXT,
            allowNull: true,
            defaultValue: '[]'
          });
          console.log('redeemCodes column added successfully to users');
        }
        
        if (!userInfo.progress) {
          console.log('Adding progress column to users table');
          await queryInterface.addColumn('users', 'progress', {
            type: Sequelize.TEXT,
            allowNull: true,
            defaultValue: '{}'
          });
          console.log('progress column added successfully to users');
        }
        
        // Add other missing columns that appear in the error logs
        if (!userInfo.examCountdowns) {
          console.log('Adding examCountdowns column to users table');
          await queryInterface.addColumn('users', 'examCountdowns', {
            type: Sequelize.TEXT,
            allowNull: true,
            defaultValue: '[]'
          });
          console.log('examCountdowns column added successfully to users');
        }
        
        if (!userInfo.verified) {
          console.log('Adding verified column to users table');
          await queryInterface.addColumn('users', 'verified', {
            type: Sequelize.BOOLEAN,
            allowNull: false,
            defaultValue: false
          });
          console.log('verified column added successfully to users');
        }
        
        if (!userInfo.failedLoginAttempts) {
          console.log('Adding failedLoginAttempts column to users table');
          await queryInterface.addColumn('users', 'failedLoginAttempts', {
            type: Sequelize.INTEGER,
            allowNull: false,
            defaultValue: 0
          });
          console.log('failedLoginAttempts column added successfully to users');
        }
        
        if (!userInfo.accountLocked) {
          console.log('Adding accountLocked column to users table');
          await queryInterface.addColumn('users', 'accountLocked', {
            type: Sequelize.BOOLEAN,
            allowNull: false,
            defaultValue: false
          });
          console.log('accountLocked column added successfully to users');
        }
        
        if (!userInfo.lockUntil) {
          console.log('Adding lockUntil column to users table');
          await queryInterface.addColumn('users', 'lockUntil', {
            type: Sequelize.DATE,
            allowNull: true
          });
          console.log('lockUntil column added successfully to users');
        }
        
        if (!userInfo.preferredLanguage) {
          console.log('Adding preferredLanguage column to users table');
          await queryInterface.addColumn('users', 'preferredLanguage', {
            type: Sequelize.STRING(10),
            allowNull: true,
            defaultValue: 'zh-CN'
          });
          console.log('preferredLanguage column added successfully to users');
        }
        
        if (!userInfo.profilePicture) {
          console.log('Adding profilePicture column to users table');
          await queryInterface.addColumn('users', 'profilePicture', {
            type: Sequelize.STRING(255),
            allowNull: true
          });
          console.log('profilePicture column added successfully to users');
        }
        
        if (!userInfo.lastLoginAt) {
          console.log('Adding lastLoginAt column to users table');
          await queryInterface.addColumn('users', 'lastLoginAt', {
            type: Sequelize.DATE,
            allowNull: true
          });
          console.log('lastLoginAt column added successfully to users');
        }
      }
      
      console.log('All missing columns added successfully');
      
    } catch (error) {
      console.error('Error adding missing columns:', error);
      throw error;
    }
  },

  async down(queryInterface, Sequelize) {
    try {
      console.log('Removing added columns from tables...');
      
      // Check if tables exist
      const tables = await queryInterface.showAllTables();
      
      // 1. Remove columns from question_sets table
      if (tables.includes('question_sets')) {
        const questionSetInfo = await queryInterface.describeTable('question_sets');
        
        // Remove columns if they exist
        if (questionSetInfo.icon) {
          await queryInterface.removeColumn('question_sets', 'icon');
        }
        
        if (questionSetInfo.is_paid) {
          await queryInterface.removeColumn('question_sets', 'is_paid');
        }
        
        if (questionSetInfo.trial_questions) {
          await queryInterface.removeColumn('question_sets', 'trial_questions');
        }
        
        if (questionSetInfo.is_featured) {
          await queryInterface.removeColumn('question_sets', 'is_featured');
        }
        
        if (questionSetInfo.featured_category) {
          await queryInterface.removeColumn('question_sets', 'featured_category');
        }
      }
      
      // 2. Remove columns from users table
      if (tables.includes('users')) {
        const userInfo = await queryInterface.describeTable('users');
        
        // Remove columns if they exist
        if (userInfo.socket_id) {
          await queryInterface.removeColumn('users', 'socket_id');
        }
        
        if (userInfo.purchases) {
          await queryInterface.removeColumn('users', 'purchases');
        }
        
        if (userInfo.redeemCodes) {
          await queryInterface.removeColumn('users', 'redeemCodes');
        }
        
        if (userInfo.progress) {
          await queryInterface.removeColumn('users', 'progress');
        }
        
        if (userInfo.examCountdowns) {
          await queryInterface.removeColumn('users', 'examCountdowns');
        }
        
        if (userInfo.verified) {
          await queryInterface.removeColumn('users', 'verified');
        }
        
        if (userInfo.failedLoginAttempts) {
          await queryInterface.removeColumn('users', 'failedLoginAttempts');
        }
        
        if (userInfo.accountLocked) {
          await queryInterface.removeColumn('users', 'accountLocked');
        }
        
        if (userInfo.lockUntil) {
          await queryInterface.removeColumn('users', 'lockUntil');
        }
        
        if (userInfo.preferredLanguage) {
          await queryInterface.removeColumn('users', 'preferredLanguage');
        }
        
        if (userInfo.profilePicture) {
          await queryInterface.removeColumn('users', 'profilePicture');
        }
        
        if (userInfo.lastLoginAt) {
          await queryInterface.removeColumn('users', 'lastLoginAt');
        }
      }
      
      console.log('All added columns removed successfully');
      
    } catch (error) {
      console.error('Error removing columns:', error);
      throw error;
    }
  }
}; 