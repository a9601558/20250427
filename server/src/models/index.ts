import sequelize from '../config/database';
import { appState } from '../utils/appstate';

// 导入模型
import User from './User';
import Question from './Question';
import QuestionSet from './QuestionSet';
import Purchase from './Purchase';
import RedeemCode from './RedeemCode';
import Option from './Option';
import HomepageSettings from './HomepageSettings';
import UserProgress from './UserProgress';

// 定义模型之间的关联关系
// User <-> QuestionSet (通过 Purchase)
Purchase.belongsTo(User, { foreignKey: 'userId', as: 'user' });
User.hasMany(Purchase, { foreignKey: 'userId', as: 'purchases' });

// Purchase <-> QuestionSet
Purchase.belongsTo(QuestionSet, { foreignKey: 'questionSetId', as: 'purchaseQuestionSet' });
QuestionSet.hasMany(Purchase, { foreignKey: 'questionSetId', as: 'purchases' });

// QuestionSet <-> Question
QuestionSet.hasMany(Question, { foreignKey: 'questionSetId', as: 'questions' });
Question.belongsTo(QuestionSet, { foreignKey: 'questionSetId', as: 'questionSet' });

// Question <-> Option
Question.hasMany(Option, { foreignKey: 'questionId', as: 'options' });
Option.belongsTo(Question, { foreignKey: 'questionId', as: 'question' });

// User <-> RedeemCode
RedeemCode.belongsTo(User, { foreignKey: 'createdBy', as: 'creator' });
RedeemCode.belongsTo(User, { foreignKey: 'usedBy', as: 'consumer' });
User.hasMany(RedeemCode, { foreignKey: 'createdBy', as: 'createdCodes' });
User.hasMany(RedeemCode, { foreignKey: 'usedBy', as: 'redeemedCodes' });

// RedeemCode <-> QuestionSet
RedeemCode.belongsTo(QuestionSet, { foreignKey: 'questionSetId', as: 'questionSet' });
QuestionSet.hasMany(RedeemCode, { foreignKey: 'questionSetId', as: 'redeemCodes' });

// User <-> UserProgress
UserProgress.belongsTo(User, { foreignKey: 'userId', as: 'user' });
User.hasMany(UserProgress, { foreignKey: 'userId', as: 'progress' });

// UserProgress <-> QuestionSet
UserProgress.belongsTo(QuestionSet, { foreignKey: 'questionSetId', as: 'progressQuestionSet' });
QuestionSet.hasMany(UserProgress, { foreignKey: 'questionSetId', as: 'userProgress' });

// UserProgress <-> Question
UserProgress.belongsTo(Question, { foreignKey: 'questionId', as: 'question' });
Question.hasMany(UserProgress, { foreignKey: 'questionId', as: 'progress' });

// Export models
export {
  User,
  QuestionSet,
  Question,
  Option,
  HomepageSettings,
  Purchase,
  RedeemCode,
  UserProgress,
  sequelize
}; 