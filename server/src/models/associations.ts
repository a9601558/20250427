import User from './User';
import Question from './Question';
import QuestionSet from './QuestionSet';
import Option from './Option';
import Purchase from './Purchase';
import RedeemCode from './RedeemCode';
import UserProgress from './UserProgress';
import HomepageSettings from './HomepageSettings';

export const setupAssociations = () => {
  // QuestionSet → Question
  QuestionSet.hasMany(Question, {
    foreignKey: 'questionSetId',
    as: 'questions',
    onDelete: 'CASCADE'
  });
  Question.belongsTo(QuestionSet, {
    foreignKey: 'questionSetId',
    as: 'questionSet'
  });

  // Question → Option
  Question.hasMany(Option, {
    foreignKey: 'questionId',
    as: 'options',
    onDelete: 'CASCADE'
  });
  Option.belongsTo(Question, {
    foreignKey: 'questionId',
    as: 'optionQuestion'
  });

  // User → UserProgress
  User.hasMany(UserProgress, {
    foreignKey: 'userId',
    as: 'userProgresses',
    onDelete: 'CASCADE'
  });
  UserProgress.belongsTo(User, {
    foreignKey: 'userId',
    as: 'progressUser'
  });

  // QuestionSet → UserProgress
  QuestionSet.hasMany(UserProgress, {
    foreignKey: 'questionSetId',
    as: 'questionSetProgresses',
    onDelete: 'CASCADE'
  });
  UserProgress.belongsTo(QuestionSet, {
    foreignKey: 'questionSetId',
    as: 'progressQuestionSet'
  });

  // Question → UserProgress
  Question.hasMany(UserProgress, {
    foreignKey: 'questionId',
    as: 'questionProgresses',
    onDelete: 'CASCADE'
  });
  UserProgress.belongsTo(Question, {
    foreignKey: 'questionId',
    as: 'progressQuestion'
  });

  // User → Purchase
  User.hasMany(Purchase, {
    foreignKey: 'userId',
    as: 'userPurchases',
    onDelete: 'CASCADE'
  });
  Purchase.belongsTo(User, {
    foreignKey: 'userId',
    as: 'purchaseUser'
  });

  // QuestionSet → Purchase
  QuestionSet.hasMany(Purchase, {
    foreignKey: 'questionSetId',
    as: 'questionSetPurchases',
    onDelete: 'CASCADE'
  });
  Purchase.belongsTo(QuestionSet, {
    foreignKey: 'questionSetId',
    as: 'purchaseQuestionSet'
  });

  // QuestionSet → RedeemCode
  QuestionSet.hasMany(RedeemCode, {
    foreignKey: 'questionSetId',
    as: 'questionSetRedeemCodes',
    onDelete: 'CASCADE'
  });
  RedeemCode.belongsTo(QuestionSet, {
    foreignKey: 'questionSetId',
    as: 'redeemQuestionSet'
  });

  // User (使用者) → RedeemCode
  User.hasMany(RedeemCode, {
    foreignKey: 'usedBy',
    as: 'userRedeemedCodes',
    onDelete: 'SET NULL'
  });
  RedeemCode.belongsTo(User, {
    foreignKey: 'usedBy',
    as: 'redeemUser'
  });

  // User (创建者) → RedeemCode
  User.hasMany(RedeemCode, {
    foreignKey: 'createdBy',
    as: 'userCreatedCodes',
    onDelete: 'CASCADE'
  });
  RedeemCode.belongsTo(User, {
    foreignKey: 'createdBy',
    as: 'redeemCreator'
  });

  // 其他模型（HomepageSettings）不需要关联，已自动注册
};
