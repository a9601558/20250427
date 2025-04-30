'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const transaction = await queryInterface.sequelize.transaction();
    
    try {
      // 检查列是否存在
      const [columns] = await queryInterface.sequelize.query(
        "SHOW COLUMNS FROM user_progress",
        { transaction }
      );
      
      const columnNames = columns.map(col => col.Field);
      
      // 只删除存在的列
      if (columnNames.includes('completedQuestions')) {
        await queryInterface.sequelize.query(
          'ALTER TABLE user_progress DROP COLUMN completedQuestions',
          { transaction }
        );
      }
      
      if (columnNames.includes('totalQuestions')) {
        await queryInterface.sequelize.query(
          'ALTER TABLE user_progress DROP COLUMN totalQuestions',
          { transaction }
        );
      }
      
      if (columnNames.includes('correctAnswers')) {
        await queryInterface.sequelize.query(
          'ALTER TABLE user_progress DROP COLUMN correctAnswers',
          { transaction }
        );
      }
      
      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      console.error('Migration failed:', error);
      throw error;
    }
  },

  down: async (queryInterface, Sequelize) => {
    const transaction = await queryInterface.sequelize.transaction();
    
    try {
      // 检查列是否存在
      const [columns] = await queryInterface.sequelize.query(
        "SHOW COLUMNS FROM user_progress",
        { transaction }
      );
      
      const columnNames = columns.map(col => col.Field);
      
      // 只添加不存在的列
      if (!columnNames.includes('completedQuestions')) {
        await queryInterface.sequelize.query(
          'ALTER TABLE user_progress ADD COLUMN completedQuestions INT NULL',
          { transaction }
        );
      }
      
      if (!columnNames.includes('totalQuestions')) {
        await queryInterface.sequelize.query(
          'ALTER TABLE user_progress ADD COLUMN totalQuestions INT NULL',
          { transaction }
        );
      }
      
      if (!columnNames.includes('correctAnswers')) {
        await queryInterface.sequelize.query(
          'ALTER TABLE user_progress ADD COLUMN correctAnswers INT NULL',
          { transaction }
        );
      }
      
      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      console.error('Migration rollback failed:', error);
      throw error;
    }
  }
}; 