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
    as: 'questionSetInfo'
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
    as: 'userProgress',
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
    as: 'progressQuestionSet'
  });

  // User 和 Purchase 的关联 - 明确设置onDelete为CASCADE
  User.hasMany(Purchase, {
    foreignKey: 'user_id',  // 确保使用正确的列名
    sourceKey: 'id',
    as: 'userPurchases',    // 使用一致的关联名
    onDelete: 'CASCADE',    // 明确指定CASCADE删除
    hooks: true             // 启用钩子以确保CASCADE正常工作
  });

  Purchase.belongsTo(User, {
    foreignKey: 'user_id',  // 确保使用正确的列名
    targetKey: 'id',
    as: 'user',
    onDelete: 'CASCADE'     // 确保双向关联都是CASCADE
  });

  // Purchase 和 QuestionSet 的关联
  Purchase.belongsTo(QuestionSet, {
    foreignKey: 'questionSetId',
    as: 'purchaseQuestionSet'
  });

  // 添加反向关联
  QuestionSet.hasMany(Purchase, {
    foreignKey: 'questionSetId',
    as: 'purchaseQuestionSet',
    onDelete: 'CASCADE'
  });

  // 兑换码关联
  RedeemCode.belongsTo(QuestionSet, {
    foreignKey: 'questionSetId',
    as: 'redeemQuestionSet'
  });

  QuestionSet.hasMany(RedeemCode, {
    foreignKey: 'questionSetId',
    as: 'redeemCodes',
    onDelete: 'CASCADE'
  });

  User.hasMany(RedeemCode, {
    foreignKey: 'usedBy',
    as: 'userRedeemCodes',
    onDelete: 'SET NULL'
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
    as: 'wrongAnswerQuestion'
  });

  QuestionSet.hasMany(WrongAnswer, {
    foreignKey: 'questionSetId',
    as: 'wrongAnswers',
    onDelete: 'CASCADE'
  });

  WrongAnswer.belongsTo(QuestionSet, {
    foreignKey: 'questionSetId',
    as: 'wrongAnswerQuestionSet'
  });
};
