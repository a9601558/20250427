'use strict';
module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('WrongAnswers', {
      id: {
        allowNull: false,
        primaryKey: true,
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4
      },
      userId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'Users',
          key: 'id'
        },
        onDelete: 'CASCADE'
      },
      questionId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'Questions',
          key: 'id'
        },
        onDelete: 'CASCADE'
      },
      questionSetId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'QuestionSets',
          key: 'id'
        },
        onDelete: 'CASCADE'
      },
      question: {
        type: Sequelize.TEXT,
        allowNull: false
      },
      questionType: {
        type: Sequelize.STRING,
        allowNull: false
      },
      options: {
        type: Sequelize.JSON,
        allowNull: false
      },
      selectedOption: {
        type: Sequelize.STRING,
        allowNull: true
      },
      selectedOptions: {
        type: Sequelize.JSON,
        allowNull: true
      },
      correctOption: {
        type: Sequelize.STRING,
        allowNull: true
      },
      correctOptions: {
        type: Sequelize.JSON,
        allowNull: true
      },
      explanation: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      memo: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE
      }
    });

    // 添加联合索引，加速查询
    await queryInterface.addIndex('WrongAnswers', ['userId', 'questionSetId']);
    await queryInterface.addIndex('WrongAnswers', ['userId', 'questionId']);
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('WrongAnswers');
  }
}; 