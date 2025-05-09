import sequelize from '../config/database';
import { setupAssociations } from '../models/associations';
import User from '../models/User';
import Question from '../models/Question';
import QuestionSet from '../models/QuestionSet';
import Purchase from '../models/Purchase';
import RedeemCode from '../models/RedeemCode';
import Option from '../models/Option';
import HomepageSettings from '../models/HomepageSettings';
import UserProgress from '../models/UserProgress';
import { defaultHomepageSettings } from '../config/defaultSettings';

// 确保所有模型都被导入和注册
const models = [
  User,
  Question,
  QuestionSet,
  Purchase,
  RedeemCode,
  Option,
  HomepageSettings,
  UserProgress
];

console.log(`将同步以下 ${models.length} 个模型:`);
models.forEach(model => {
  console.log(` - ${model.name}`);
});

async function syncAllModels() {
  try {
    console.log('✅ 初始化模型关联...');
    setupAssociations();

    console.log('✅ 开始同步所有模型到数据库 (force: true)...');
    await sequelize.sync({ force: true });

    console.log('🎉 所有数据库表已成功创建！');

    // 创建默认HomepageSettings
    try {
      const [homepageSettings, created] = await HomepageSettings.findOrCreate({
        where: { id: 1 },
        defaults: defaultHomepageSettings
      });

      if (created) {
        console.log('✅ 默认首页设置已创建！');
      } else {
        console.log('ℹ️ 默认首页设置已存在，无需创建');
      }
    } catch (error) {
      console.error('❌ 创建首页设置时出错:', error);
    }

    // 打印所有创建的表
    const tables = await sequelize.getQueryInterface().showAllTables();
    console.log('📋 已创建的表:');
    tables.forEach((table: string) => {
      console.log(` - ${table}`);
    });

    console.log('🏁 数据库同步完成！');
    process.exit(0);
  } catch (error) {
    console.error('❌ 同步模型时出错:', error);
    process.exit(1);
  }
}

// 启动同步流程
syncAllModels();
