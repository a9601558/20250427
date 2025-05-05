'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    try {
      console.log('Removing deprecated progress fields...');
      
      // Check if the table exists
      const tables = await queryInterface.showAllTables();
      if (!tables.includes('user_progress')) {
        console.log('user_progress table does not exist, skipping migration');
        return;
      }
      
      // Get the table columns
      const tableInfo = await queryInterface.describeTable('user_progress');
      
      // Remove deprecated fields if they exist
      const columnsToRemove = [
        'progress_percent', 
        'score', 
        'status',
        'wrong_answers_count',
        'skipped_questions_count'
      ];
      
      for (const column of columnsToRemove) {
        if (tableInfo[column]) {
          console.log(`Removing column: ${column}`);
          await queryInterface.removeColumn('user_progress', column);
        } else {
          console.log(`Column ${column} does not exist, skipping`);
        }
      }
      
      console.log('Deprecated progress fields removed successfully');
    } catch (error) {
      console.error('Error removing deprecated progress fields:', error);
      throw error;
    }
  },

  async down(queryInterface, Sequelize) {
    try {
      console.log('Adding back removed progress fields...');
      
      // Check if the table exists
      const tables = await queryInterface.showAllTables();
      if (!tables.includes('user_progress')) {
        console.log('user_progress table does not exist, skipping migration');
        return;
      }
      
      // Add back removed columns
      const columnsToAdd = [
        {
          name: 'progress_percent',
          type: Sequelize.FLOAT,
          allowNull: true,
          defaultValue: 0
        },
        {
          name: 'score',
          type: Sequelize.INTEGER,
          allowNull: true,
          defaultValue: 0
        },
        {
          name: 'status',
          type: Sequelize.STRING(20),
          allowNull: true,
          defaultValue: 'in_progress'
        },
        {
          name: 'wrong_answers_count',
          type: Sequelize.INTEGER,
          allowNull: true,
          defaultValue: 0
        },
        {
          name: 'skipped_questions_count',
          type: Sequelize.INTEGER,
          allowNull: true,
          defaultValue: 0
        }
      ];
      
      for (const column of columnsToAdd) {
        console.log(`Adding column: ${column.name}`);
        await queryInterface.addColumn('user_progress', column.name, {
          type: column.type,
          allowNull: column.allowNull,
          defaultValue: column.defaultValue
        });
      }
      
      console.log('Progress fields added back successfully');
    } catch (error) {
      console.error('Error adding back progress fields:', error);
      throw error;
    }
  }
}; 