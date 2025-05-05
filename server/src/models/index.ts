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
import WrongAnswer from './WrongAnswer';

// 不要在这里初始化模型关联，避免重复
// 关联初始化已经在 associations.ts 中进行
console.log('模型已导入，关联将在应用启动时初始化');

// Define associations
export const initializeAssociations = () => {
  console.log('正在初始化模型关联...');
  
  // Question <-> QuestionSet
  Question.belongsTo(QuestionSet, { 
    foreignKey: 'questionSetId',
    onDelete: 'CASCADE'
  });
  
  QuestionSet.hasMany(Question, { 
    foreignKey: 'questionSetId',
    as: 'questions'
  });
  
  // Question <-> Option
  Question.hasMany(Option, {
    foreignKey: 'questionId',
    as: 'options',
    onDelete: 'CASCADE'
  });
  
  Option.belongsTo(Question, {
    foreignKey: 'questionId'
  });
  
  // UserProgress associations
  UserProgress.belongsTo(User, {
    foreignKey: 'userId'
  });
  
  UserProgress.belongsTo(QuestionSet, {
    foreignKey: 'questionSetId',
    as: 'progressQuestionSet'
  });
  
  UserProgress.belongsTo(Question, {
    foreignKey: 'questionId',
    as: 'question'
  });
  
  User.hasMany(UserProgress, {
    foreignKey: 'userId',
    as: 'progress'
  });
  
  QuestionSet.hasMany(UserProgress, {
    foreignKey: 'questionSetId',
    as: 'userProgress'
  });
  
  Question.hasMany(UserProgress, {
    foreignKey: 'questionId',
    as: 'userAnswers'
  });
  
  // Purchase associations
  Purchase.belongsTo(User, {
    foreignKey: 'userId'
  });
  
  Purchase.belongsTo(QuestionSet, {
    foreignKey: 'questionSetId',
    as: 'purchaseQuestionSet'
  });
  
  User.hasMany(Purchase, {
    foreignKey: 'userId',
    as: 'purchases'
  });
  
  QuestionSet.hasMany(Purchase, {
    foreignKey: 'questionSetId',
    as: 'purchases'
  });

  // Redeemed Code associations
  RedeemCode.belongsTo(User, {
    foreignKey: 'userId'
  });

  RedeemCode.belongsTo(QuestionSet, {
    foreignKey: 'questionSetId',
    as: 'codeQuestionSet'
  });

  User.hasMany(RedeemCode, {
    foreignKey: 'userId',
    as: 'redeemedCodes'
  });

  QuestionSet.hasMany(RedeemCode, {
    foreignKey: 'questionSetId',
    as: 'redeemedCodes'
  });
  
  console.log('模型关联初始化完成');
};

// Export models and sequelize
export {
  User,
  Question,
  QuestionSet,
  Option,
  UserProgress,
  Purchase,
  RedeemCode,
  WrongAnswer,
  sequelize
};

export default {
  User,
  Question,
  QuestionSet,
  Option,
  UserProgress,
  Purchase,
  RedeemCode,
  WrongAnswer,
  sequelize,
  initializeAssociations
}; 