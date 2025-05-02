'use strict';

/**
 * Sequelize实例修复脚本 - 构建后自动运行
 * 
 * 这个脚本会在构建后运行，确保所有编译后的文件能够正确处理Sequelize实例
 */

const fs = require('fs');
const path = require('path');

console.log('======== 开始执行Sequelize实例修复脚本 ========');

// 扫描目录，找到所有JS文件
const scanDir = (dir, fileList = []) => {
  const files = fs.readdirSync(dir);
  
  files.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    
    if (stat.isDirectory()) {
      scanDir(filePath, fileList);
    } else if (file.endsWith('.js')) {
      fileList.push(filePath);
    }
  });
  
  return fileList;
};

// 检查JS文件是否包含Sequelize相关代码
const hasSequelizeCode = (content) => {
  return content.includes('sequelize') || 
         content.includes('Sequelize') || 
         content.includes('Model.init') || 
         content.includes('.init(');
};

// 添加全局错误处理和恢复机制
const addErrorHandling = (content) => {
  // 检查是否已经有了我们的处理代码
  if (content.includes('// Sequelize Instance Recovery')) {
    return content;
  }
  
  // 添加全局恢复代码
  const recoveryCode = `
// Sequelize Instance Recovery - 自动添加于 ${new Date().toISOString()}
// 这段代码确保Sequelize模型总是有有效的实例，即使在模块导入失败的情况下
(function() {
  try {
    // 修复空的sequelize实例
    if (typeof global.sequelize === 'undefined' && 
        (typeof sequelize === 'undefined' || !sequelize)) {
      const { Sequelize } = require('sequelize');
      const path = require('path');
      const fs = require('fs');
      const dotenv = require('dotenv');
      
      // 加载环境变量
      const envPath = path.join(process.cwd(), '.env');
      if (fs.existsSync(envPath)) {
        console.log('Recovery: 加载环境变量文件', envPath);
        dotenv.config({ path: envPath });
      }
      
      console.log('Recovery: 创建应急Sequelize实例');
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
      
      // 设置全局变量，避免"未定义"错误
      if (typeof sequelize === 'undefined') {
        global.sequelize = global.sequelize;
      }
    }
  } catch (error) {
    console.error('Recovery: Sequelize恢复机制出错', error);
  }
})();
`;

  // 添加到文件开头
  return recoveryCode + content;
};

// 检查并修复目标目录中的所有文件
const targetDir = path.join(__dirname, 'dist');
if (!fs.existsSync(targetDir)) {
  console.error(`目标目录不存在: ${targetDir}`);
  process.exit(1);
}

// 扫描并处理所有JS文件
const jsFiles = scanDir(targetDir);
console.log(`找到 ${jsFiles.length} 个JS文件`);

let fixedCount = 0;

jsFiles.forEach(file => {
  try {
    const content = fs.readFileSync(file, 'utf8');
    
    // 只处理包含Sequelize相关代码的文件
    if (hasSequelizeCode(content)) {
      const modifiedContent = addErrorHandling(content);
      
      // 如果内容有变化，写回文件
      if (modifiedContent !== content) {
        fs.writeFileSync(file, modifiedContent, 'utf8');
        fixedCount++;
        console.log(`已修复: ${file}`);
      }
    }
  } catch (error) {
    console.error(`处理文件出错 ${file}:`, error);
  }
});

// 复制特殊的数据库处理文件
const dbConfigDir = path.join(targetDir, 'src', 'config');
if (!fs.existsSync(dbConfigDir)) {
  fs.mkdirSync(dbConfigDir, { recursive: true });
}

// 创建db.js作为备份
const dbJsPath = path.join(dbConfigDir, 'db.js');
const dbJsContent = `'use strict';

/**
 * 自动创建的数据库配置备份
 * 生成时间: ${new Date().toISOString()}
 */

const { Sequelize } = require('sequelize');
const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');

// 加载环境变量
const envPath = path.join(process.cwd(), '.env');
if (fs.existsSync(envPath)) {
  console.log(\`加载环境变量文件: \${envPath}\`);
  dotenv.config({ path: envPath });
}

// 创建Sequelize实例
const sequelize = new Sequelize(
  process.env.DB_NAME || 'quiz_app',
  process.env.DB_USER || 'root',
  process.env.DB_PASSWORD || '',
  {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '3306'),
    dialect: 'mysql',
    logging: console.log,
    pool: {
      max: 5,
      min: 0,
      acquire: 30000,
      idle: 10000
    },
    dialectOptions: {
      connectTimeout: 10000
    }
  }
);

// 提供模块导出
module.exports = sequelize;
module.exports.default = sequelize;
`;

fs.writeFileSync(dbJsPath, dbJsContent, 'utf8');
console.log(`已创建数据库配置备份: ${dbJsPath}`);

console.log(`总计修复了 ${fixedCount} 个文件`);
console.log('======== Sequelize实例修复脚本执行完成 ========'); 