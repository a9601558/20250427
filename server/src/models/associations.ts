import Question from './Question';
import Option from './Option';
import QuestionSet from './QuestionSet';
import User from './User';
import UserProgress from './UserProgress';
import Purchase from './Purchase';
import RedeemCode from './RedeemCode';
import WrongAnswer from './WrongAnswer';

export const setupAssociations = () => {
  // QuestionSet 和 Question 的关联
  QuestionSet.hasMany(Question, {
    foreignKey: 'questionSetId',
    as: 'questionSetQuestions',
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

  // User 和 UserProgress 的关联 - 修改关联名称以避免冲突
  User.hasMany(UserProgress, {
    foreignKey: 'userId',
    as: 'userProgress', // 从'progress'改为'userProgress'以避免与User模型中的progress属性冲突
    onDelete: 'CASCADE'
  });

  UserProgress.belongsTo(User, {
    foreignKey: 'userId',
    as: 'user'
  });

  // UserProgress 和 Question 的关联
  UserProgress.belongsTo(Question, {
    foreignKey: 'questionId',
    as: 'question'
  });

  // UserProgress 和 QuestionSet 的关联
  UserProgress.belongsTo(QuestionSet, {
    foreignKey: 'questionSetId',
    as: 'questionSet'
  });

  // User 和 Purchase 的关联
  User.hasMany(Purchase, {
    foreignKey: 'userId',
    as: 'userPurchaseRecords',
    onDelete: 'CASCADE'
  });

  Purchase.belongsTo(User, {
    foreignKey: 'userId',
    as: 'user'
  });

  // Purchase 和 QuestionSet 的关联
  Purchase.belongsTo(QuestionSet, {
    foreignKey: 'questionSetId',
    as: 'questionSet'
  });

  // 兑换码关联
  RedeemCode.belongsTo(QuestionSet, {
    foreignKey: 'questionSetId',
    as: 'questionSet'
  });

  QuestionSet.hasMany(RedeemCode, {
    foreignKey: 'questionSetId',
    as: 'redeemCodes',
    onDelete: 'CASCADE'
  });

  User.hasMany(RedeemCode, {
    foreignKey: 'redeemedBy',
    as: 'redeemedCodes'
  });

  // WrongAnswer 关联
  User.hasMany(WrongAnswer, {
    foreignKey: 'userId',
    as: 'wrongAnswers',
    onDelete: 'CASCADE'
  });

  WrongAnswer.belongsTo(User, {
    foreignKey: 'userId',
    as: 'user'
  });

  Question.hasMany(WrongAnswer, {
    foreignKey: 'questionId',
    as: 'wrongAnswers',
    onDelete: 'CASCADE'
  });

  WrongAnswer.belongsTo(Question, {
    foreignKey: 'questionId',
    as: 'questionDetails'
  });

  QuestionSet.hasMany(WrongAnswer, {
    foreignKey: 'questionSetId',
    as: 'wrongAnswers',
    onDelete: 'CASCADE'
  });

  WrongAnswer.belongsTo(QuestionSet, {
    foreignKey: 'questionSetId',
    as: 'questionSet'
  });
};
