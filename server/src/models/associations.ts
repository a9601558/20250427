import Question from './Question';
import Option from './Option';
import QuestionSet from './QuestionSet';
import User from './User';
import UserProgress from './UserProgress';
import Purchase from './Purchase';
import RedeemCode from './RedeemCode';

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
    as: 'questionSetUserProgresses',  // ✅ 改了
    onDelete: 'CASCADE'
  });

  UserProgress.belongsTo(QuestionSet, {
    foreignKey: 'questionSetId',
    as: 'progressQuestionSet'   // ✅ 已改好
  });

  // Question 和 UserProgress 的关联
  Question.hasMany(UserProgress, {
    foreignKey: 'questionId',
    as: 'questionUserProgresses',   // ✅ 改了
    onDelete: 'CASCADE'
  });

  UserProgress.belongsTo(Question, {
    foreignKey: 'questionId',
    as: 'progressQuestion'   // ✅ 稍微改名，防止和 Question 里的 as 冲突
  });

  // User 和 Purchase 的关联
  User.hasMany(Purchase, {
    foreignKey: 'userId',
    as: 'userPurchases',
    onDelete: 'CASCADE'
  });

  Purchase.belongsTo(User, {
    foreignKey: 'userId',
    as: 'purchaseUser'
  });

  // QuestionSet 和 Purchase 的关联
  QuestionSet.hasMany(Purchase, {
    foreignKey: 'questionSetId',
    as: 'questionSetPurchases',
    onDelete: 'CASCADE'
  });

  Purchase.belongsTo(QuestionSet, {
    foreignKey: 'questionSetId',
    as: 'purchaseQuestionSet'
  });

  // QuestionSet-RedeemCode关联
  QuestionSet.hasMany(RedeemCode, {
    foreignKey: 'questionSetId',
    as: 'questionSetRedeemCodes',
    onDelete: 'CASCADE'
  });

  RedeemCode.belongsTo(QuestionSet, {
    foreignKey: 'questionSetId',
    as: 'redeemQuestionSet'
  });

  // User-RedeemCode关联（已使用）
  User.hasMany(RedeemCode, {
    foreignKey: 'usedBy',
    as: 'userRedeemedCodes',
    onDelete: 'SET NULL'
  });

  RedeemCode.belongsTo(User, {
    foreignKey: 'usedBy',
    as: 'redeemUser'
  });

  // User-RedeemCode关联（创建者）
  User.hasMany(RedeemCode, {
    foreignKey: 'createdBy',
    as: 'userCreatedCodes',
    onDelete: 'CASCADE'
  });

  RedeemCode.belongsTo(User, {
    foreignKey: 'createdBy',
    as: 'redeemCreator'
  });
};
