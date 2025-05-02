'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    try {
      // 检查表结构
      const tableInfo = await queryInterface.describeTable('question_sets');
      
      // 检查并添加is_paid字段
      if (!tableInfo.is_paid) {
        console.log('添加is_paid字段到question_sets表');
        await queryInterface.addColumn('question_sets', 'is_paid', {
          type: Sequelize.BOOLEAN,
          allowNull: false,
          defaultValue: false,
        });
      } else {
        console.log('is_paid字段已存在');
      }
      
      // 检查并添加price字段
      if (!tableInfo.price) {
        console.log('添加price字段到question_sets表');
        await queryInterface.addColumn('question_sets', 'price', {
          type: Sequelize.DECIMAL(10, 2),
          allowNull: true,
          defaultValue: null,
        });
      } else {
        console.log('price字段已存在');
      }
      
      // 检查并添加trial_questions字段
      if (!tableInfo.trial_questions) {
        console.log('添加trial_questions字段到question_sets表');
        await queryInterface.addColumn('question_sets', 'trial_questions', {
          type: Sequelize.INTEGER,
          allowNull: true,
          defaultValue: null,
        });
      } else {
        console.log('trial_questions字段已存在');
      }
      
      // 检查并添加is_featured字段
      if (!tableInfo.is_featured) {
        console.log('添加is_featured字段到question_sets表');
        await queryInterface.addColumn('question_sets', 'is_featured', {
          type: Sequelize.BOOLEAN,
          allowNull: false,
          defaultValue: false,
        });
      } else {
        console.log('is_featured字段已存在');
      }
      
      // 检查并添加featured_category字段
      if (!tableInfo.featured_category) {
        console.log('添加featured_category字段到question_sets表');
        await queryInterface.addColumn('question_sets', 'featured_category', {
          type: Sequelize.STRING,
          allowNull: true,
          defaultValue: null,
        });
      } else {
        console.log('featured_category字段已存在');
      }
      
      console.log('所有缺失字段添加完成');
    } catch (error) {
      console.error('添加缺失字段失败:', error);
      throw error;
    }
  },

  down: async (queryInterface, Sequelize) => {
    try {
      // 恢复：逆序删除添加的字段
      const tableInfo = await queryInterface.describeTable('question_sets');
      
      if (tableInfo.featured_category) {
        await queryInterface.removeColumn('question_sets', 'featured_category');
      }
      
      if (tableInfo.is_featured) {
        await queryInterface.removeColumn('question_sets', 'is_featured');
      }
      
      if (tableInfo.trial_questions) {
        await queryInterface.removeColumn('question_sets', 'trial_questions');
      }
      
      if (tableInfo.price) {
        await queryInterface.removeColumn('question_sets', 'price');
      }
      
      if (tableInfo.is_paid) {
        await queryInterface.removeColumn('question_sets', 'is_paid');
      }
      
      console.log('所有添加的字段已移除');
    } catch (error) {
      console.error('移除字段失败:', error);
      throw error;
    }
  },
}; 
