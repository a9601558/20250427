'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const transaction = await queryInterface.sequelize.transaction();
    
    try {
      // Get table information
      const [questionSetsColumns] = await queryInterface.sequelize.query(
        "SHOW COLUMNS FROM question_sets",
        { transaction }
      );
      
      const [purchasesColumns] = await queryInterface.sequelize.query(
        "SHOW COLUMNS FROM purchases",
        { transaction }
      );
      
      // Convert column arrays to sets for easier checking
      const questionSetsColumnSet = new Set(questionSetsColumns.map(col => col.Field));
      const purchasesColumnSet = new Set(purchasesColumns.map(col => col.Field));
      
      console.log('Existing question_sets columns:', Array.from(questionSetsColumnSet));
      console.log('Existing purchases columns:', Array.from(purchasesColumnSet));
      
      // Fix question_sets table
      if (!questionSetsColumnSet.has('is_paid')) {
        console.log('Adding is_paid column to question_sets table');
        await queryInterface.addColumn('question_sets', 'is_paid', {
          type: Sequelize.BOOLEAN,
          allowNull: false,
          defaultValue: false
        }, { transaction });
      }
      
      if (!questionSetsColumnSet.has('is_featured')) {
        console.log('Adding is_featured column to question_sets table');
        await queryInterface.addColumn('question_sets', 'is_featured', {
          type: Sequelize.BOOLEAN,
          allowNull: false,
          defaultValue: false
        }, { transaction });
      }
      
      if (!questionSetsColumnSet.has('featured_category')) {
        console.log('Adding featured_category column to question_sets table');
        await queryInterface.addColumn('question_sets', 'featured_category', {
          type: Sequelize.STRING,
          allowNull: true
        }, { transaction });
      }
      
      if (!questionSetsColumnSet.has('trial_questions')) {
        console.log('Adding trial_questions column to question_sets table');
        await queryInterface.addColumn('question_sets', 'trial_questions', {
          type: Sequelize.INTEGER,
          allowNull: true
        }, { transaction });
      }
      
      // Fix purchases table
      if (!purchasesColumnSet.has('user_id')) {
        console.log('Adding user_id column to purchases table');
        await queryInterface.addColumn('purchases', 'user_id', {
          type: Sequelize.UUID,
          allowNull: true, // Set to true initially to allow migration
          references: {
            model: 'users',
            key: 'id'
          }
        }, { transaction });
      }
      
      if (!purchasesColumnSet.has('question_set_id')) {
        console.log('Adding question_set_id column to purchases table');
        await queryInterface.addColumn('purchases', 'question_set_id', {
          type: Sequelize.UUID,
          allowNull: true, // Set to true initially to allow migration
          references: {
            model: 'question_sets',
            key: 'id'
          }
        }, { transaction });
      }
      
      console.log('Successfully completed migration');
      await transaction.commit();
      
    } catch (error) {
      console.error('Error during migration:', error);
      await transaction.rollback();
      throw error;
    }
  },

  down: async (queryInterface, Sequelize) => {
    const transaction = await queryInterface.sequelize.transaction();
    
    try {
      // Remove columns from question_sets table
      await queryInterface.removeColumn('question_sets', 'is_paid', { transaction });
      await queryInterface.removeColumn('question_sets', 'is_featured', { transaction });
      await queryInterface.removeColumn('question_sets', 'featured_category', { transaction });
      await queryInterface.removeColumn('question_sets', 'trial_questions', { transaction });
      
      // Remove columns from purchases table
      await queryInterface.removeColumn('purchases', 'user_id', { transaction });
      await queryInterface.removeColumn('purchases', 'question_set_id', { transaction });
      
      await transaction.commit();
      
    } catch (error) {
      console.error('Error during rollback:', error);
      await transaction.rollback();
      throw error;
    }
  }
}; 