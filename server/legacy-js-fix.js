#!/usr/bin/env node

/**
 * 旧JS文件修复工具
 * 用于处理项目中的旧JavaScript文件，确保它们和TypeScript版本兼容
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('===== 旧JavaScript文件修复工具 =====');

// 当前目录
const baseDir = process.cwd();
console.log(`当前目录: ${baseDir}`);

// 需要处理的文件列表
const targetFiles = [
  'src/routes/homepageRoutes.js',
  'src/routes/userRoutes.js',
  'src/controllers/homepageController.js',
  'src/controllers/userController.js',
  'src/models/User.js',
  'src/app.js'
];

// 修复文件的问题
function fixFile(filePath) {
  const fullPath = path.join(baseDir, filePath);
  
  // 检查文件是否存在
  if (!fs.existsSync(fullPath)) {
    console.log(`跳过: ${filePath} - 文件不存在`);
    return;
  }
  
  console.log(`处理: ${filePath}`);
  
  try {
    // 读取文件内容
    let content = fs.readFileSync(fullPath, 'utf8');
    let modified = false;
    
    // 创建备份
    const backupPath = `${fullPath}.bak`;
    if (!fs.existsSync(backupPath)) {
      fs.writeFileSync(backupPath, content, 'utf8');
      console.log(`已创建备份: ${backupPath}`);
    }
    
    // 1. 修复错误的导入/引用路径
    if (content.includes("require('../middleware/auth')")) {
      content = content.replace(
        "require('../middleware/auth')",
        "require('../middleware/authMiddleware')"
      );
      
      // 更新中间件函数名
      content = content.replace(/isAuth/g, 'protect');
      content = content.replace(/isAdmin/g, 'admin');
      modified = true;
      console.log(`- 已修复中间件路径和函数名`);
    }
    
    // 2. 修复User模型的问题
    if (filePath === 'src/models/User.js') {
      // 确保User.js能正确使用全局Sequelize实例
      if (!content.includes('global.sequelize')) {
        const sequelizeSetup = `
// 注入全局Sequelize实例
// 确保全局sequelize实例存在
if (!global.sequelize) {
  const { Sequelize } = require('sequelize');
  const path = require('path');
  const fs = require('fs');
  const dotenv = require('dotenv');
  
  // 检查并加载 .env 文件
  const envPath = path.join(process.cwd(), '.env');
  if (fs.existsSync(envPath)) {
    console.log(\`加载环境变量文件: \${envPath}\`);
    dotenv.config({ path: envPath });
  }
  
  // 创建全局sequelize实例
  global.sequelize = new Sequelize(
    process.env.DB_NAME || 'quiz_app',
    process.env.DB_USER || 'root',
    process.env.DB_PASSWORD || '',
    {
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '3306'),
      dialect: 'mysql',
      logging: false,
      pool: { max: 5, min: 0, acquire: 30000, idle: 10000 }
    }
  );
  console.log('全局Sequelize实例创建成功');
}

// 使用全局sequelize实例
const sequelize = global.sequelize;`;
        
        content = content.replace(
          /const\s+{\s*Model,\s*DataTypes\s*}\s*=\s*require\(['"]sequelize['"]\)/,
          `const { Model, DataTypes } = require('sequelize');\n${sequelizeSetup}`
        );
        modified = true;
        console.log(`- 已添加全局Sequelize实例注入`);
      }
    }
    
    // 3. 修复可能存在的循环引用问题
    if (filePath === 'src/app.js') {
      // 添加适当的错误处理
      if (!content.includes('process.on(\'uncaughtException\'')) {
        content += `\n
// 全局错误处理
process.on('uncaughtException', (error) => {
  console.error('未捕获的异常:', error);
  // 避免立即崩溃，记录错误后继续运行
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('未处理的Promise拒绝:', reason);
  // 避免立即崩溃，记录错误后继续运行
});\n`;
        modified = true;
        console.log(`- 已添加全局错误处理`);
      }
    }
    
    // 4. 修复控制器方法名不匹配的问题
    if (filePath === 'src/controllers/homepageController.js') {
      // 检查并修复可能的方法名不匹配
      if (content.includes('getHomeContent') && !content.includes('getHomepageContent')) {
        // 添加兼容性导出
        content = content.replace(
          'module.exports = homepageController;',
          `module.exports = homepageController;

// 兼容性导出 - 与TypeScript版本保持一致
module.exports.getHomepageContent = homepageController.getHomeContent;
module.exports.updateHomepageContent = homepageController.updateHomeContent;
module.exports.getFeaturedCategories = homepageController.getFeaturedCategories;
module.exports.updateFeaturedCategories = homepageController.updateFeaturedCategories;
`
        );
        modified = true;
        console.log(`- 已添加兼容性方法导出`);
      }
    }
    
    // 5. 修复可能存在的导入问题 (针对require的模型)
    if (content.includes('require(\'../models\')')) {
      // 这种导入方式在混合TS/JS环境下可能有问题
      content = content.replace(
        /const\s+{\s*([^}]+)\s*}\s*=\s*require\(['"]\.\.\/models['"]\)/g,
        (match, models) => {
          // 将一次性导入变成单独导入
          const modelImports = models.split(',').map(model => {
            const trimmedModel = model.trim();
            return `const ${trimmedModel} = require('../models/${trimmedModel}');`;
          }).join('\n');
          return modelImports;
        }
      );
      modified = true;
      console.log(`- 已修复模型导入方式`);
    }
    
    // 写回修改后的内容
    if (modified) {
      fs.writeFileSync(fullPath, content, 'utf8');
      console.log(`✅ 文件已更新: ${filePath}`);
    } else {
      console.log(`✓ 文件无需修改: ${filePath}`);
    }
  } catch (error) {
    console.error(`处理文件${filePath}时出错:`, error.message);
  }
}

// 检查是否有TypeScript版本的文件存在
function checkTsVersion(jsFilePath) {
  const tsFilePath = jsFilePath.replace('.js', '.ts');
  const fullTsPath = path.join(baseDir, tsFilePath);
  
  if (fs.existsSync(fullTsPath)) {
    return { exists: true, path: tsFilePath };
  }
  
  return { exists: false };
}

// 主函数
async function main() {
  try {
    console.log('开始处理旧JavaScript文件...');
    
    // 处理每个目标文件
    for (const filePath of targetFiles) {
      // 检查是否有TS版本
      const tsVersion = checkTsVersion(filePath);
      
      if (tsVersion.exists) {
        console.log(`${filePath} 有TypeScript版本: ${tsVersion.path}`);
        console.log(`建议重命名或备份JS文件，以避免混淆`);
      }
      
      // 无论是否有TS版本，都修复JS文件的内容
      fixFile(filePath);
    }
    
    console.log('\n===== 旧JavaScript文件处理完成 =====');
    console.log('提示: 这些JS文件应该与相应的TS文件保持同步，或者考虑完全迁移到TypeScript');
  } catch (error) {
    console.error('处理过程中出错:', error);
  }
}

// 执行主函数
main(); 