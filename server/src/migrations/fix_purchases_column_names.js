'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    try {
      // 检查表结构
      const tableInfo = await queryInterface.describeTable('purchases');
      
      // 检查是否存在quiz_id字段
      if (tableInfo.quiz_id && !tableInfo.question_set_id) {
        console.log('找到quiz_id字段，准备更新为question_set_id');
        
        // 先删除原有的外键约束
        await queryInterface.sequelize.query(
          `ALTER TABLE purchases DROP FOREIGN KEY purchases_ibfk_1`
        ).catch(err => {
          console.log('删除外键约束失败，可能不存在:', err.message);
        });
        
        // 修改字段名称
        await queryInterface.renameColumn('purchases', 'quiz_id', 'question_set_id');
        
        // 重新添加外键约束
        await queryInterface.addConstraint('purchases', {
          fields: ['question_set_id'],
          type: 'foreign key',
          name: 'purchases_question_set_id_fkey',
          references: {
            table: 'question_sets',
            field: 'id'
          },
          onDelete: 'CASCADE',
          onUpdate: 'CASCADE'
        });
        
        console.log('成功将purchases表中的quiz_id字段更新为question_set_id');
      } else if (tableInfo.question_set_id) {
        console.log('question_set_id字段已存在，无需更新');
      } else {
        console.error('既没有找到quiz_id也没有找到question_set_id字段');
        throw new Error('无法找到需要更新的字段');
      }
    } catch (error) {
      console.error('更新字段名称失败:', error);
      throw error;
    }
  },

  down: async (queryInterface, Sequelize) => {
    try {
      // 检查表结构
      const tableInfo = await queryInterface.describeTable('purchases');
      
      // 只有在存在question_set_id而不存在quiz_id时才回滚
      if (tableInfo.question_set_id && !tableInfo.quiz_id) {
        // 先删除新的外键约束
        await queryInterface.sequelize.query(
          `ALTER TABLE purchases DROP FOREIGN KEY purchases_question_set_id_fkey`
        ).catch(err => {
          console.log('删除外键约束失败，可能不存在:', err.message);
        });
        
        // 修改回原来的字段名
        await queryInterface.renameColumn('purchases', 'question_set_id', 'quiz_id');
        
        // 重新添加原有的外键约束
        await queryInterface.addConstraint('purchases', {
          fields: ['quiz_id'],
          type: 'foreign key',
          name: 'purchases_ibfk_1',
          references: {
            table: 'question_sets',
            field: 'id'
          },
          onDelete: 'CASCADE',
          onUpdate: 'CASCADE'
        });
        
        console.log('成功将purchases表中的question_set_id字段回滚为quiz_id');
      } else {
        console.log('无需回滚字段名更改');
      }
    } catch (error) {
      console.error('回滚字段名更改失败:', error);
      throw error;
    }
  }
}; 