const { Model, DataTypes } = require('sequelize');
const sequelize = require('../config/database');

class QuestionSet extends Model {}

QuestionSet.init({
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  title: {
    type: DataTypes.STRING,
    allowNull: false
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  category: {
    type: DataTypes.STRING,
    allowNull: false
  },
  icon: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: '📚'
  },
  isPaid: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false
  },
  price: {
    type: DataTypes.FLOAT,
    allowNull: true
  },
  trialQuestions: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  isFeatured: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false
  },
  featuredCategory: {
    type: DataTypes.STRING,
    allowNull: true
  },
  cardImage: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: 'URL for the question set card image'
  }
}, {
  sequelize,
  modelName: 'questionSet',
  timestamps: true,
  underscored: true
});

module.exports = QuestionSet; 