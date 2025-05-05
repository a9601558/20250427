'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    try {
      // Check if the column already exists to avoid errors
      const tableInfo = await queryInterface.describeTable('questions');
      if (!tableInfo.metadata) {
        console.log('Adding metadata column to questions table...');
        await queryInterface.addColumn('questions', 'metadata', {
          type: Sequelize.TEXT,
          allowNull: true,
          comment: 'JSON metadata for storing additional question information'
        });
        console.log('Successfully added metadata column to questions table');
      } else {
        console.log('metadata column already exists in questions table');
      }
      return Promise.resolve();
    } catch (error) {
      console.error('Error adding metadata column:', error);
      return Promise.reject(error);
    }
  },

  down: async (queryInterface, Sequelize) => {
    try {
      // Check if the column exists before removing
      const tableInfo = await queryInterface.describeTable('questions');
      if (tableInfo.metadata) {
        console.log('Removing metadata column from questions table...');
        await queryInterface.removeColumn('questions', 'metadata');
        console.log('Successfully removed metadata column from questions table');
      } else {
        console.log('metadata column does not exist in questions table');
      }
      return Promise.resolve();
    } catch (error) {
      console.error('Error removing metadata column:', error);
      return Promise.reject(error);
    }
  }
}; 