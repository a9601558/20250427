'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    try {
      // 打印数据库表结构信息以供诊断
      console.log('检查数据库表结构...');
      
      // 获取question_sets表的结构信息
      const questionSetsColumns = await queryInterface.sequelize.query(
        'SHOW COLUMNS FROM question_sets',
        { type: queryInterface.sequelize.QueryTypes.SELECT }
      );
      console.log('question_sets表结构:', questionSetsColumns.map((col) => col.Field));
      
      // 检查特定列
      const isPaidCol = questionSetsColumns.find((col) => col.Field === 'is_paid');
      const isFeaturedCol = questionSetsColumns.find((col) => col.Field === 'is_featured');
      
      if (isPaidCol) {
        console.log('is_paid列已存在，默认值:', isPaidCol.Default);
      } else {
        console.log('警告: is_paid列不存在!');
      }
      
      if (isFeaturedCol) {
        console.log('is_featured列已存在，默认值:', isFeaturedCol.Default);
      } else {
        console.log('警告: is_featured列不存在!');
      }
      
      // 获取数据库版本信息
      const dbVersionInfo = await queryInterface.sequelize.query(
        'SELECT version()',
        { type: queryInterface.sequelize.QueryTypes.SELECT }
      );
      console.log('数据库版本信息:', dbVersionInfo);
      
      // 对于缺失的列，尝试使用SQL而不是Sequelize API添加它们
      if (!isPaidCol) {
        try {
          await queryInterface.sequelize.query(
            'ALTER TABLE question_sets ADD COLUMN is_paid BOOLEAN NOT NULL DEFAULT FALSE'
          );
          console.log('已添加is_paid列');
        } catch (err) {
          console.error('添加is_paid列时出错:', err.message);
        }
      }
      
      if (!isFeaturedCol) {
        try {
          await queryInterface.sequelize.query(
            'ALTER TABLE question_sets ADD COLUMN is_featured BOOLEAN NOT NULL DEFAULT FALSE'
          );
          console.log('已添加is_featured列');
        } catch (err) {
          console.error('添加is_featured列时出错:', err.message);
        }
      }
      
      console.log('字段映射检查完成');
      return true;
    } catch (error) {
      console.error('字段映射检查过程中出错:', error);
      throw error;
    }
  },

  down: async (queryInterface, Sequelize) => {
    // 这个迁移主要是诊断性的，不需要回滚操作
    return true;
  },
}; 
