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
import { setupAssociations } from './associations';

// 初始化模型关联
console.log('正在初始化模型关联...');
setupAssociations();
console.log('模型关联初始化完成');

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