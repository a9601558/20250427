import { sequelize } from '../config/db';

// 导入模型
import User from './User';
import Question from './Question';
import QuestionSet from './QuestionSet';
import Purchase from './Purchase';
import RedeemCode from './RedeemCode';
import Option from './Option';
import HomepageSettings from './HomepageSettings';

// 设置模型关联
User.hasMany(Purchase, {
  foreignKey: 'userId',
  as: 'userPurchases'
});

QuestionSet.hasMany(Question, {
  foreignKey: 'questionSetId',
  as: 'questions'
});
Question.belongsTo(QuestionSet, {
  foreignKey: 'questionSetId',
  as: 'questionSet'
});

Question.hasMany(Option, {
  foreignKey: 'questionId',
  as: 'options'
});
Option.belongsTo(Question, {
  foreignKey: 'questionId',
  as: 'question'
});

QuestionSet.hasMany(Purchase, {
  foreignKey: 'quizId',
  as: 'purchases'
});
Purchase.belongsTo(QuestionSet, {
  foreignKey: 'quizId',
  as: 'questionSet'
});

QuestionSet.hasMany(RedeemCode, {
  foreignKey: 'questionSetId',
  as: 'redeemCodes'
});
RedeemCode.belongsTo(QuestionSet, {
  foreignKey: 'questionSetId',
  as: 'questionSet'
});

Purchase.belongsTo(User, {
  foreignKey: 'userId',
  as: 'user'
});

// 数据库同步函数
const syncModels = async () => {
  try {
    console.log('开始同步数据库模型...');
    console.log('同步 User 模型...');
    await User.sync({ alter: true });
    
    console.log('同步 QuestionSet 模型...');
    await QuestionSet.sync({ alter: true });
    
    console.log('同步 Question 模型...');
    await Question.sync({ alter: true });
    
    console.log('同步 Option 模型...');
    await Option.sync({ alter: true });
    
    console.log('同步 Purchase 模型...');
    await Purchase.sync({ alter: true });
    
    console.log('同步 RedeemCode 模型...');
    await RedeemCode.sync({ alter: true });
    
    console.log('同步 HomepageSettings 模型...');
    await HomepageSettings.sync({ alter: true });
    
    console.log('所有模型同步完成');
    
    // 确保 HomepageSettings 表有初始数据
    const homeSettings = await HomepageSettings.findByPk(1);
    if (!homeSettings) {
      console.log('创建 HomepageSettings 初始数据...');
      await HomepageSettings.create({
        id: 1,
        welcome_title: "ExamTopics 模拟练习",
        welcome_description: "选择以下任一题库开始练习，测试您的知识水平",
        featured_categories: ["网络协议", "编程语言", "计算机基础"],
        announcements: "欢迎使用在线题库系统，新增题库将定期更新，请持续关注！",
        footer_text: "© 2023 ExamTopics 在线题库系统 保留所有权利",
        banner_image: "/images/banner.jpg",
        theme: 'light'
      });
      console.log('HomepageSettings 初始数据创建成功');
    }
    
    return true;
  } catch (error) {
    console.error('数据库模型同步错误:', error);
    
    // 尝试强制同步（谨慎使用，会重建表结构）
    try {
      console.log('尝试使用force模式同步模型...');
      
      console.log('同步 HomepageSettings 模型...');
      await HomepageSettings.sync({ force: true });
      
      console.log('同步 User 模型...');
      await User.sync({ force: true });
      
      console.log('同步 QuestionSet 模型...');
      await QuestionSet.sync({ force: true });
      
      console.log('同步 Question 模型...');
      await Question.sync({ force: true });
      
      console.log('同步 Option 模型...');
      await Option.sync({ force: true });
      
      console.log('同步 Purchase 模型...');
      await Purchase.sync({ force: true });
      
      console.log('同步 RedeemCode 模型...');
      await RedeemCode.sync({ force: true });
      
      console.log('创建 HomepageSettings 初始数据...');
      await HomepageSettings.create({
        id: 1,
        welcome_title: "ExamTopics 模拟练习",
        welcome_description: "选择以下任一题库开始练习，测试您的知识水平",
        featured_categories: ["网络协议", "编程语言", "计算机基础"],
        announcements: "欢迎使用在线题库系统，新增题库将定期更新，请持续关注！",
        footer_text: "© 2023 ExamTopics 在线题库系统 保留所有权利",
        banner_image: "/images/banner.jpg",
        theme: 'light'
      });
      
      console.log('强制模式同步完成');
      return true;
    } catch (forceError) {
      console.error('强制同步数据库模型失败:', forceError);
      throw forceError;
    }
  }
};

// 导出所有模型和函数
export {
  sequelize,
  User,
  Question,
  QuestionSet,
  Purchase,
  RedeemCode,
  Option,
  HomepageSettings,
  syncModels
}; 