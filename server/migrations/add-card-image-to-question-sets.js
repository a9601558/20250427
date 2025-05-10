'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('question_sets', 'card_image', {
      type: Sequelize.STRING,
      allowNull: true,
      comment: 'URL for the question set card image'
    });
    console.log('Added card_image column to question_sets table');
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('question_sets', 'card_image');
    console.log('Removed card_image column from question_sets table');
  }
}; 