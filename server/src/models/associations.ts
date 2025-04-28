import Question from './Question';
import Option from './Option';
import QuestionSet from './QuestionSet';
import User from './User';
import UserProgress from './UserProgress';
import Purchase from './Purchase';

export const setupAssociations = () => {
  // QuestionSet 和 Question 的关联
  QuestionSet.hasMany(Question, {
    foreignKey: 'questionSetId',
    as: 'questions',
    onDelete: 'CASCADE'
  });

  Question.belongsTo(QuestionSet, {
    foreignKey: 'questionSetId',
    as: 'questionSet'
  });

  // Question 和 Option 的关联
  Question.hasMany(Option, {
    foreignKey: 'questionId',
    as: 'options',
    onDelete: 'CASCADE'
  });

  Option.belongsTo(Question, {
    foreignKey: 'questionId',
    as: 'question'
  });

  // User 和 UserProgress 的关联
  User.hasMany(UserProgress, {
    foreignKey: 'userId',
    as: 'userProgresses',
    onDelete: 'CASCADE'
  });

  UserProgress.belongsTo(User, {
    foreignKey: 'userId',
    as: 'user'
  });

  // QuestionSet 和 UserProgress 的关联
  QuestionSet.hasMany(UserProgress, {
    foreignKey: 'questionSetId',
    as: 'userProgresses',
    onDelete: 'CASCADE'
  });

  UserProgress.belongsTo(QuestionSet, {
    foreignKey: 'questionSetId',
    as: 'questionSet'
  });

  // Question 和 UserProgress 的关联
  Question.hasMany(UserProgress, {
    foreignKey: 'questionId',
    as: 'userProgresses',
    onDelete: 'CASCADE'
  });

  UserProgress.belongsTo(Question, {
    foreignKey: 'questionId',
    as: 'question'
  });

  // User 和 Purchase 的关联
  User.hasMany(Purchase, {
    foreignKey: 'userId',
    as: 'purchases',
    onDelete: 'CASCADE'
  });

  Purchase.belongsTo(User, {
    foreignKey: 'userId',
    as: 'user'
  });

  // QuestionSet 和 Purchase 的关联
  QuestionSet.hasMany(Purchase, {
    foreignKey: 'questionSetId',
    as: 'purchases',
    onDelete: 'CASCADE'
  });

  Purchase.belongsTo(QuestionSet, {
    foreignKey: 'questionSetId',
    as: 'questionSet'
  });
}; 