'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    try {
      console.log('Removing role column from users table...');
      
      // Check if the table exists
      const tables = await queryInterface.showAllTables();
      if (!tables.includes('users')) {
        console.log('users table does not exist, skipping migration');
        return;
      }
      
      // Get the table columns
      const tableInfo = await queryInterface.describeTable('users');
      
      // Ensure isAdmin column exists before removing role
      if (!tableInfo.isAdmin) {
        console.log('isAdmin column does not exist, creating it first');
        
        await queryInterface.addColumn('users', 'isAdmin', {
          type: Sequelize.BOOLEAN,
          allowNull: false,
          defaultValue: false
        });
        
        // If role column exists, update isAdmin based on role values
        if (tableInfo.role) {
          console.log('Migrating role values to isAdmin column');
          await queryInterface.sequelize.query(`
            UPDATE users 
            SET isAdmin = (role = 'admin')
            WHERE true;
          `);
        }
      }
      
      // Remove role column if it exists
      if (tableInfo.role) {
        console.log('Removing role column from users table');
        await queryInterface.removeColumn('users', 'role');
        console.log('role column removed successfully');
      } else {
        console.log('role column does not exist, skipping');
      }
      
    } catch (error) {
      console.error('Error removing role column:', error);
      throw error;
    }
  },

  async down(queryInterface, Sequelize) {
    try {
      console.log('Re-adding role column to users table...');
      
      // Check if the table exists
      const tables = await queryInterface.showAllTables();
      if (!tables.includes('users')) {
        console.log('users table does not exist, skipping migration');
        return;
      }
      
      // Get the table columns
      const tableInfo = await queryInterface.describeTable('users');
      
      // Add role column back if it doesn't exist
      if (!tableInfo.role) {
        console.log('Adding role column back to users table');
        
        await queryInterface.addColumn('users', 'role', {
          type: Sequelize.ENUM('user', 'admin'),
          defaultValue: 'user',
          allowNull: false
        });
        
        // If isAdmin column exists, update role based on isAdmin values
        if (tableInfo.isAdmin) {
          console.log('Setting role values based on isAdmin column');
          await queryInterface.sequelize.query(`
            UPDATE users 
            SET role = CASE WHEN isAdmin = true THEN 'admin' ELSE 'user' END
            WHERE true;
          `);
        }
        
        console.log('role column added back successfully');
      } else {
        console.log('role column already exists, skipping');
      }
      
    } catch (error) {
      console.error('Error re-adding role column:', error);
      throw error;
    }
  }
}; 