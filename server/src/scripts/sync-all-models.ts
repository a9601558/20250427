import { sequelize } from '../config/db';
import User from '../models/User';
import Question from '../models/Question';
import QuestionSet from '../models/QuestionSet';
import Purchase from '../models/Purchase';
import RedeemCode from '../models/RedeemCode';
import Option from '../models/Option';
import HomepageSettings from '../models/HomepageSettings';

// 确保所有模型都被导入和注册
const models = [
  User,
  Question,
  QuestionSet,
  Purchase,
  RedeemCode,
  Option,
  HomepageSettings
];

console.log(`将同步以下 ${models.length} 个模型:`);
models.forEach(model => {
  console.log(` - ${model.name}`);
});

// 模型关联 - 确保这与models/index.ts保持一致
// User-Purchase关联
User.hasMany(Purchase, {
  foreignKey: 'userId',
  as: 'userPurchases'
});
Purchase.belongsTo(User, {
  foreignKey: 'userId',
  as: 'user'
});

// QuestionSet-Question关联
QuestionSet.hasMany(Question, {
  foreignKey: 'questionSetId',
  as: 'questions'
});
Question.belongsTo(QuestionSet, {
  foreignKey: 'questionSetId',
  as: 'questionSet'
});

// Question-Option关联
Question.hasMany(Option, {
  foreignKey: 'questionId',
  as: 'options'
});
Option.belongsTo(Question, {
  foreignKey: 'questionId',
  as: 'question'
});

// QuestionSet-Purchase关联
QuestionSet.hasMany(Purchase, {
  foreignKey: 'quizId',
  as: 'purchases'
});
Purchase.belongsTo(QuestionSet, {
  foreignKey: 'quizId',
  as: 'questionSet'
});

// QuestionSet-RedeemCode关联
QuestionSet.hasMany(RedeemCode, {
  foreignKey: 'questionSetId',
  as: 'redeemCodes'
});
RedeemCode.belongsTo(QuestionSet, {
  foreignKey: 'questionSetId',
  as: 'questionSet'
});

// User-RedeemCode关联（已使用）
User.hasMany(RedeemCode, {
  foreignKey: 'usedBy',
  as: 'redeemedCodes'
});
RedeemCode.belongsTo(User, {
  foreignKey: 'usedBy',
  as: 'user'
});

// User-RedeemCode关联（创建者）
User.hasMany(RedeemCode, {
  foreignKey: 'createdBy',
  as: 'createdCodes'
});
RedeemCode.belongsTo(User, {
  foreignKey: 'createdBy',
  as: 'creator'
});

// 执行同步
async function syncAllModels() {
  try {
    console.log('开始同步所有模型到数据库...');
    console.log('同步模式: force=true (将删除并重新创建所有表)');
    
    // 使用force:true重新创建所有表
    await sequelize.sync({ force: true });
    
    console.log('所有数据库表已成功创建!');
    
    // 创建一条默认的HomepageSettings记录
    try {
      const [homepageSettings, created] = await HomepageSettings.findOrCreate({
        where: { id: 1 },
        defaults: {
          welcome_title: 'ExamTopics 模拟练习',
          welcome_description: '选择以下任一题库开始练习，测试您的知识水平',
          featured_categories: ['网络协议', '编程语言', '计算机基础'],
          announcements: '欢迎使用在线题库系统，新增题库将定期更新，请持续关注！',
          footer_text: '© 2023 ExamTopics 在线题库系统 保留所有权利',
          banner_image: '/images/banner.jpg',
          theme: 'light'
        }
      });
      
      if (created) {
        console.log('创建了默认的首页设置');
      } else {
        console.log('首页设置已存在，无需创建');
      }
    } catch (error) {
      console.error('创建首页设置时出错:', error);
    }
    
    // 打印所有创建的表
    const tables = await sequelize.getQueryInterface().showAllTables();
    console.log('已创建的表:');
    tables.forEach((table: string) => {
      console.log(` - ${table}`);
    });
    
    process.exit(0);
  } catch (error) {
    console.error('同步模型时出错:', error);
    process.exit(1);
  }
}

syncAllModels(); 