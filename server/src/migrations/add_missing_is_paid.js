'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // 检查列是否已存在
    try {
      const tableInfo = await queryInterface.describeTable('question_sets');
      if (!tableInfo.is_paid) {
        // 添加is_paid列
        await queryInterface.addColumn('question_sets', 'is_paid', {
          type: Sequelize.BOOLEAN,
          defaultValue: false,
          allowNull: false
        });
        console.log('成功添加is_paid列到question_sets表');
      } else {
        console.log('is_paid列已存在，无需添加');
      }
    } catch (error) {
      console.error('添加is_paid列失败:', error);
      throw error;
    }
  },

  down: async (queryInterface, Sequelize) => {
    // 回滚：移除is_paid列
    try {
      await queryInterface.removeColumn('question_sets', 'is_paid');
      console.log('成功移除is_paid列');
    } catch (error) {
      console.error('移除is_paid列失败:', error);
      throw error;
    }
  }
}; 