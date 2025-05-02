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

// 不要在这里初始化模型关联，避免重复
// 关联初始化已经在 index.ts 中进行
console.log('模型已导入，关联将在应用启动时初始化');

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
  sequelize,
}; 
