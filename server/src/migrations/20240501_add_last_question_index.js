'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('user_progress', 'lastQuestionIndex', {
      type: Sequelize.INTEGER,
      allowNull: true,
      after: 'correctAnswers',
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('user_progress', 'lastQuestionIndex');
  },
}; 
