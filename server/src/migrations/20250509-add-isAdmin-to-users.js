'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    try {
      console.log('Adding isAdmin column to users table...');
      
      // Check if the table exists
      const tables = await queryInterface.showAllTables();
      if (!tables.includes('users')) {
        console.log('users table does not exist, skipping migration');
        return;
      }
      
      // Get the table columns
      const tableInfo = await queryInterface.describeTable('users');
      
      // Add isAdmin column if it doesn't exist
      if (!tableInfo.isAdmin) {
        console.log('Adding isAdmin column to users table');
        await queryInterface.addColumn('users', 'isAdmin', {
          type: Sequelize.BOOLEAN,
          allowNull: false,
          defaultValue: false
        });
        
        // Update isAdmin values based on role column
        console.log('Updating isAdmin values based on role column');
        if (tableInfo.role) {
          await queryInterface.sequelize.query(`
            UPDATE users 
            SET isAdmin = (role = 'admin')
            WHERE true;
          `);
        }
        
        console.log('isAdmin column added successfully');
      } else {
        console.log('isAdmin column already exists, skipping');
      }
      
    } catch (error) {
      console.error('Error adding isAdmin column:', error);
      throw error;
    }
  },

  async down(queryInterface, Sequelize) {
    try {
      console.log('Removing isAdmin column from users table...');
      
      // Check if the table exists
      const tables = await queryInterface.showAllTables();
      if (!tables.includes('users')) {
        console.log('users table does not exist, skipping migration');
        return;
      }
      
      // Get the table columns
      const tableInfo = await queryInterface.describeTable('users');
      
      // Remove isAdmin column if it exists
      if (tableInfo.isAdmin) {
        console.log('Removing isAdmin column from users table');
        await queryInterface.removeColumn('users', 'isAdmin');
        console.log('isAdmin column removed successfully');
      } else {
        console.log('isAdmin column does not exist, skipping');
      }
      
    } catch (error) {
      console.error('Error removing isAdmin column:', error);
      throw error;
    }
  }
}; 