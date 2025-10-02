const HomepageSettings = require('./dist/models/HomepageSettings.js').default;
const QuestionSet = require('./dist/models/QuestionSet.js').default;
const sequelize = require('./dist/config/database.js').default;

async function fixFeaturedCategories() {
  try {
    await sequelize.authenticate();
    console.log('数据库连接成功');
    
    // 获取所有有效的分类
    const questionSets = await QuestionSet.findAll({
      attributes: ['category'],
      group: ['category']
    });
    
    const validCategories = questionSets
      .map(qs => qs.category)
      .filter(cat => cat && cat.trim() !== '');
    
    console.log('有效的分类列表:', validCategories);
    
    // 获取当前设置
    const settings = await HomepageSettings.findByPk(1);
    if (settings) {
      console.log('当前featured_categories:', settings.featured_categories);
      
      // 使用前几个有效分类作为featured categories
      const newFeaturedCategories = validCategories.slice(0, 3);
      
      // 更新设置
      await settings.update({
        featured_categories: newFeaturedCategories
      });
      
      console.log('已更新featured_categories为:', newFeaturedCategories);
      
      // 验证更新
      const updatedSettings = await HomepageSettings.findByPk(1);
      console.log('验证更新后的featured_categories:', updatedSettings.featured_categories);
    }
    
    process.exit(0);
  } catch (error) {
    console.error('错误:', error);
    process.exit(1);
  }
}

fixFeaturedCategories();