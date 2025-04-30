'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    try { userId
      // Add isPaid column to question_sets table
      await queryInterface.addColumn('question_sets', 'is_paid', {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false
      });

      // Add userId column to purchases table
      await queryInterface.addColumn('purchases', 'user_id', {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'users',
          key: 'id'
        }
      });

      console.log('Successfully added missing columns');
    } catch (error) {
      console.error('Error adding columns:', error);
      throw error;
    }
  },

  down: async (queryInterface, Sequelize) => {
    try {
      // Remove isPaid column from question_sets table
      await queryInterface.removeColumn('question_sets', 'is_paid');

      // Remove userId column from purchases table
      await queryInterface.removeColumn('purchases', 'user_id');

      console.log('Successfully removed columns');
    } catch (error) {
      console.error('Error removing columns:', error);
      throw error;
    }
  }
}; 