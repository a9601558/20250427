'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('user_progress', 'completedQuestions');
    await queryInterface.removeColumn('user_progress', 'totalQuestions');
    await queryInterface.removeColumn('user_progress', 'correctAnswers');
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('user_progress', 'completedQuestions', {
      type: Sequelize.INTEGER,
      allowNull: true
    });
    await queryInterface.addColumn('user_progress', 'totalQuestions', {
      type: Sequelize.INTEGER,
      allowNull: true
    });
    await queryInterface.addColumn('user_progress', 'correctAnswers', {
      type: Sequelize.INTEGER,
      allowNull: true
    });
  }
}; 