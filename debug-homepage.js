const { execSync } = require('child_process');
const path = require('path');

// 构建服务器代码（如果需要）
try {
  console.log('检查服务器构建...');
  const serverPath = path.join(__dirname, 'server');
  process.chdir(serverPath);
  
  // 直接使用node运行dist版本，检查数据库数据
  const testScript = `
const HomepageSettings = require('./dist/models/HomepageSettings.js').default;
const sequelize = require('./dist/config/database.js').default;

async function test() {
  try {
    await sequelize.authenticate();
    console.log('数据库连接成功');
    
    const settings = await HomepageSettings.findByPk(1);
    console.log('原始数据库数据:');
    console.log('settings:', settings ? settings.toJSON() : null);
    
    if (settings) {
      console.log('featured_categories getter结果:', settings.featured_categories);
      console.log('featured_categories类型:', typeof settings.featured_categories);
      console.log('featured_categories是否为数组:', Array.isArray(settings.featured_categories));
    }
    
    process.exit(0);
  } catch (error) {
    console.error('错误:', error);
    process.exit(1);
  }
}

test();
  `;
  
  require('fs').writeFileSync('test-db.js', testScript);
  const result = execSync('node test-db.js', { encoding: 'utf-8' });
  console.log(result);
  
} catch (error) {
  console.error('测试失败:', error.toString());
}