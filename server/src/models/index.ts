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
export const setupAssociations = () => {
  console.log('设置模型关联...');
  
  // User与Purchase的关联
  User.hasMany(Purchase, {
    foreignKey: 'userId',
    as: 'userPurchases'
  });
  Purchase.belongsTo(User, {
    foreignKey: 'userId',
    as: 'user'
  });

  // QuestionSet与Question的关联
  QuestionSet.hasMany(Question, {
    foreignKey: 'questionSetId',
    as: 'questionSetQuestions',
    onDelete: 'CASCADE'
  });
  Question.belongsTo(QuestionSet, {
    foreignKey: 'questionSetId',
    as: 'questionSet'
  });

  // Question与Option的关联
  Question.hasMany(Option, {
    foreignKey: 'questionId',
    as: 'options',
    onDelete: 'CASCADE'
  });
  Option.belongsTo(Question, {
    foreignKey: 'questionId',
    as: 'question'
  });

  // QuestionSet与Purchase的关联
  QuestionSet.hasMany(Purchase, {
    foreignKey: 'quizId',
    as: 'purchases'
  });
  Purchase.belongsTo(QuestionSet, {
    foreignKey: 'quizId',
    as: 'questionSet'
  });

  // QuestionSet与RedeemCode的关联
  QuestionSet.hasMany(RedeemCode, {
    foreignKey: 'questionSetId',
    as: 'redeemCodes'
  });
  RedeemCode.belongsTo(QuestionSet, {
    foreignKey: 'questionSetId',
    as: 'questionSet'
  });

  console.log('模型关联设置完成');
};

// Sync models with database
export const syncModels = async () => {
  try {
    // 首先设置模型关联
    setupAssociations();
    
    // 在同步前确保所有模型已经正确加载
    console.log('准备同步数据库模型...');
    
    // 记录User模型是否已加载
    if (User) {
      console.log('User 模型已加载，含hooks:', Object.keys(User.options.hooks || {}).join(', '));
    } else {
      console.warn('警告: User模型可能未正确加载!');
    }

    // 同步模型到数据库，但不强制重新创建表
    // alter: true 允许添加新列但不删除现有数据
    await sequelize.sync({ alter: true });
    
    console.log('数据库同步完成');
    
    // 确保 HomepageSettings 表有初始数据
    const homepageSettings = await HomepageSettings.findByPk(1);
    if (!homepageSettings) {
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
    }
    
    return true;
  } catch (error) {
    console.error('数据库同步失败:', error);
    throw error;
  }
};

// Export models
export {
  User,
  QuestionSet,
  Question,
  Option,
  HomepageSettings,
  Purchase,
  RedeemCode,
  sequelize
}; 