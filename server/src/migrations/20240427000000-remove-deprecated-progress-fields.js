'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    try {
      // 检查列是否存在
      const [columns] = await queryInterface.query(
        "SHOW COLUMNS FROM user_progress"
      );
      
      const columnNames = columns.map(col => col.Field);
      
      // 只删除存在的列
      if (columnNames.includes('completedQuestions')) {
        await queryInterface.query(
          'ALTER TABLE user_progress DROP COLUMN completedQuestions'
        );
      }
      
      if (columnNames.includes('totalQuestions')) {
        await queryInterface.query(
          'ALTER TABLE user_progress DROP COLUMN totalQuestions'
        );
      }
      
      if (columnNames.includes('correctAnswers')) {
        await queryInterface.query(
          'ALTER TABLE user_progress DROP COLUMN correctAnswers'
        );
      }
    } catch (error) {
      console.error('Migration failed:', error);
      throw error;
    }
  },

  down: async (queryInterface, Sequelize) => {
    try {
      // 检查列是否存在
      const [columns] = await queryInterface.query(
        "SHOW COLUMNS FROM user_progress"
      );
      
      const columnNames = columns.map(col => col.Field);
      
      // 只添加不存在的列
      if (!columnNames.includes('completedQuestions')) {
        await queryInterface.query(
          'ALTER TABLE user_progress ADD COLUMN completedQuestions INT NULL'
        );
      }
      
      if (!columnNames.includes('totalQuestions')) {
        await queryInterface.query(
          'ALTER TABLE user_progress ADD COLUMN totalQuestions INT NULL'
        );
      }
      
      if (!columnNames.includes('correctAnswers')) {
        await queryInterface.query(
          'ALTER TABLE user_progress ADD COLUMN correctAnswers INT NULL'
        );
      }
    } catch (error) {
      console.error('Migration rollback failed:', error);
      throw error;
    }
  }
}; 