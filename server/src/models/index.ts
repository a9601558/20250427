import sequelize from '../config/database';
import { appState } from '../utils/appstate';

// 导入模型
import User from './User';
import Question from './Question';
import QuestionSet from './QuestionSet';
import Purchase from './Purchase';
import RedeemCode, { setupAssociations as setupRedeemCodeAssociations } from './RedeemCode';
import Option from './Option';
import HomepageSettings from './HomepageSettings';
import UserProgress from './UserProgress';
import WrongAnswer from './WrongAnswer';

// 不要在这里初始化模型关联，避免重复
// 关联初始化已经在 index.ts 中进行
console.log('模型已导入，关联将在应用启动时初始化');

// 设置模型关联
// User与Question的关联（用户创建的题目）
User.hasMany(Question, { as: 'createdQuestions', foreignKey: 'createdBy' });
Question.belongsTo(User, { as: 'creator', foreignKey: 'createdBy' });

// User与QuestionSet的关联（用户创建的题库）
User.hasMany(QuestionSet, { as: 'createdQuestionSets', foreignKey: 'createdBy' });
QuestionSet.belongsTo(User, { as: 'creator', foreignKey: 'createdBy' });

// Question与QuestionSet的关联
QuestionSet.hasMany(Question, { as: 'questions', foreignKey: 'questionSetId' });
Question.belongsTo(QuestionSet, { as: 'questionSet', foreignKey: 'questionSetId' });

// Question与Option的关联
Question.hasMany(Option, { as: 'options', foreignKey: 'questionId' });
Option.belongsTo(Question, { as: 'question', foreignKey: 'questionId' });

// User与UserProgress的关联
User.hasMany(UserProgress, { as: 'progressRecords', foreignKey: 'userId' });
UserProgress.belongsTo(User, { as: 'user', foreignKey: 'userId' });

// QuestionSet与UserProgress的关联
QuestionSet.hasMany(UserProgress, { as: 'progressRecords', foreignKey: 'questionSetId' });
UserProgress.belongsTo(QuestionSet, { as: 'questionSet', foreignKey: 'questionSetId' });

// User与Purchase的关联
User.hasMany(Purchase, { as: 'userPurchases', foreignKey: 'userId' });
Purchase.belongsTo(User, { as: 'user', foreignKey: 'userId' });

// QuestionSet与Purchase的关联
QuestionSet.hasMany(Purchase, { as: 'purchases', foreignKey: 'questionSetId' });
Purchase.belongsTo(QuestionSet, { as: 'questionSet', foreignKey: 'questionSetId' });

// User与WrongAnswer的关联
User.hasMany(WrongAnswer, { as: 'wrongAnswers', foreignKey: 'userId' });
WrongAnswer.belongsTo(User, { as: 'user', foreignKey: 'userId' });

// QuestionSet与WrongAnswer的关联
QuestionSet.hasMany(WrongAnswer, { as: 'wrongAnswers', foreignKey: 'questionSetId' });
WrongAnswer.belongsTo(QuestionSet, { as: 'questionSet', foreignKey: 'questionSetId' });

// Question与WrongAnswer的关联
Question.hasMany(WrongAnswer, { as: 'wrongAnswers', foreignKey: 'questionId' });
WrongAnswer.belongsTo(Question, { as: 'wrongAnswerQuestion', foreignKey: 'questionId' });

// 设置RedeemCode的关联
setupRedeemCodeAssociations();

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
  WrongAnswer,
  sequelize
};

export default {
  sequelize,
  User,
  Question,
  QuestionSet,
  Option,
  HomepageSettings,
  Purchase,
  RedeemCode,
  UserProgress,
  WrongAnswer
}; 