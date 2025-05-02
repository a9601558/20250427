#!/usr/bin/env node

/**
 * 数据库初始化工具
 * 
 * 此脚本会确保所有数据库表存在并具有正确的结构
 * 用于第一次安装或修复数据库表结构问题
 * 
 * 用法: node db-init.js [目标目录] [--force]
 * 
 * 选项:
 *   --force  完全重建所有表 (会清除现有数据)
 */

const fs = require('fs');
const path = require('path');

// 处理命令行参数
const args = process.argv.slice(2);
const targetDir = args.find(arg => !arg.startsWith('-')) || '/www/wwwroot/root/git/dist/dist/server';
const forceMode = args.includes('--force');

console.log(`[初始化工具] 目标目录: ${targetDir}`);
console.log(`[初始化工具] 强制模式: ${forceMode ? '是' : '否'}`);

// 创建Sequelize实例
const createSequelize = () => {
  try {
    const { Sequelize } = require('sequelize');
    
    // 尝试加载环境变量
    const dotenv = require('dotenv');
    const envPath = path.join(process.cwd(), '.env');
    if (fs.existsSync(envPath)) {
      console.log(`[初始化工具] 加载环境变量文件: ${envPath}`);
      dotenv.config({ path: envPath });
    }
    
    // 创建实例
    const sequelize = new Sequelize(
      process.env.DB_NAME || 'quiz_app',
      process.env.DB_USER || 'root',
      process.env.DB_PASSWORD || '',
      {
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT || '3306'),
        dialect: 'mysql',
        logging: console.log,
        pool: { max: 5, min: 0, acquire: 30000, idle: 10000 },
        dialectOptions: { connectTimeout: 10000 }
      }
    );
    
    console.log('[初始化工具] Sequelize实例创建成功');
    return sequelize;
  } catch (error) {
    console.error('[初始化工具] Sequelize实例创建失败:', error);
    process.exit(1);
  }
};

// 加载并初始化所有模型
const initializeModels = async (sequelize) => {
  try {
    console.log('[初始化工具] 加载模型...');
    
    // 创建一个模型注册函数
    const registerModel = (modelPath) => {
      try {
        if (fs.existsSync(modelPath)) {
          console.log(`[初始化工具] 正在加载模型: ${modelPath}`);
          const model = require(modelPath);
          return model.default || model;
        } else {
          console.warn(`[初始化工具] 模型文件不存在: ${modelPath}`);
          return null;
        }
      } catch (error) {
        console.error(`[初始化工具] 加载模型失败: ${modelPath}`, error);
        return null;
      }
    };
    
    // 尝试不同路径下的模型文件
    const srcPath = path.join(targetDir, 'src');
    const modelsDir = path.join(srcPath, 'models');
    const distModelsDir = path.join(targetDir, 'dist', 'models');
    
    // 查找模型目录
    let modelsDirPath;
    if (fs.existsSync(modelsDir)) {
      modelsDirPath = modelsDir;
    } else if (fs.existsSync(distModelsDir)) {
      modelsDirPath = distModelsDir;
    } else {
      console.error('[初始化工具] 无法找到模型目录');
      
      // 尝试在各种可能的位置查找
      const possibleDirs = [
        path.join(targetDir, 'models'),
        path.join(targetDir, 'dist/src/models'),
        path.join(targetDir, 'dist/models'),
        path.join(process.cwd(), 'src/models'),
        path.join(process.cwd(), 'dist/models')
      ];
      
      for (const dir of possibleDirs) {
        if (fs.existsSync(dir)) {
          modelsDirPath = dir;
          console.log(`[初始化工具] 找到模型目录: ${modelsDirPath}`);
          break;
        }
      }
      
      if (!modelsDirPath) {
        throw new Error('找不到模型目录');
      }
    }
    
    // 读取所有模型文件
    const modelFiles = fs.readdirSync(modelsDirPath)
      .filter(file => file.endsWith('.js'))
      .map(file => path.join(modelsDirPath, file));
    
    console.log(`[初始化工具] 找到 ${modelFiles.length} 个模型文件`);
    
    // 强制设置global.sequelize
    global.sequelize = sequelize;
    
    // 载入所有模型
    const models = modelFiles.map(file => registerModel(file)).filter(Boolean);
    
    console.log(`[初始化工具] 成功加载 ${models.length} 个模型`);
    
    // 尝试设置关联
    const associationsPath = path.join(modelsDirPath, '../models/associations.js');
    if (fs.existsSync(associationsPath)) {
      try {
        console.log('[初始化工具] 初始化模型关联...');
        const associations = require(associationsPath);
        if (typeof associations.setupAssociations === 'function') {
          associations.setupAssociations();
        } else if (typeof associations.default?.setupAssociations === 'function') {
          associations.default.setupAssociations();
        } else {
          console.warn('[初始化工具] 找不到setupAssociations函数');
        }
      } catch (error) {
        console.error('[初始化工具] 设置模型关联失败:', error);
      }
    } else {
      console.warn('[初始化工具] 找不到associations.js文件');
    }
    
    return models;
  } catch (error) {
    console.error('[初始化工具] 初始化模型失败:', error);
    return [];
  }
};

// 执行数据库同步
const syncDatabase = async (sequelize) => {
  try {
    console.log(`[初始化工具] 开始${forceMode ? '强制' : ''}同步数据库...`);
    
    // 同步所有模型
    await sequelize.sync({ force: forceMode });
    
    console.log('[初始化工具] 数据库同步完成');
    
    // 测试连接
    await sequelize.authenticate();
    console.log('[初始化工具] 数据库连接测试成功');
    
    return true;
  } catch (error) {
    console.error('[初始化工具] 数据库同步失败:', error);
    return false;
  }
};

// 创建HomepageSettings默认数据
const createDefaultHomepageSettings = async (models) => {
  try {
    // 查找HomepageSettings模型
    const HomepageSettings = models.find(m => m.name === 'HomepageSettings');
    
    if (!HomepageSettings) {
      console.error('[初始化工具] 找不到HomepageSettings模型');
      return false;
    }
    
    // 检查表是否存在
    try {
      const count = await HomepageSettings.count();
      console.log(`[初始化工具] 当前有 ${count} 条HomepageSettings记录`);
      
      // 如果没有记录，创建默认记录
      if (count === 0) {
        console.log('[初始化工具] 创建默认HomepageSettings记录');
        await HomepageSettings.create({
          siteTitle: '考试平台',
          welcomeMessage: '欢迎使用我们的考试平台！',
          featuredCategories: [],
          footerText: '© 2024 考试平台 版权所有',
        });
        console.log('[初始化工具] 默认HomepageSettings记录创建成功');
      }
    } catch (error) {
      console.error('[初始化工具] 检查HomepageSettings表时出错:', error);
      
      // 如果表不存在，手动创建
      if (error.parent?.code === 'ER_NO_SUCH_TABLE') {
        console.log('[初始化工具] HomepageSettings表不存在，手动创建...');
        
        // 构建CREATE TABLE语句
        const createTableSQL = `
CREATE TABLE IF NOT EXISTS \`homepage_settings\` (
  \`id\` int NOT NULL AUTO_INCREMENT,
  \`featuredCategories\` json NOT NULL,
  \`siteTitle\` varchar(255) NOT NULL,
  \`welcomeMessage\` text NOT NULL,
  \`footerText\` varchar(255) NOT NULL,
  \`createdAt\` datetime NOT NULL,
  \`updatedAt\` datetime NOT NULL,
  PRIMARY KEY (\`id\`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
        `;
        
        // 执行SQL
        await sequelize.query(createTableSQL);
        
        // 创建默认记录
        await sequelize.query(`
INSERT INTO \`homepage_settings\` (\`id\`, \`featuredCategories\`, \`siteTitle\`, \`welcomeMessage\`, \`footerText\`, \`createdAt\`, \`updatedAt\`)
VALUES (1, '[]', '考试平台', '欢迎使用我们的考试平台！', '© 2024 考试平台 版权所有', NOW(), NOW());
        `);
        
        console.log('[初始化工具] HomepageSettings表创建并初始化成功');
      }
    }
    
    return true;
  } catch (error) {
    console.error('[初始化工具] 创建默认HomepageSettings数据失败:', error);
    return false;
  }
};

// 主函数
const main = async () => {
  try {
    // 创建Sequelize实例
    const sequelize = createSequelize();
    
    // 初始化模型
    const models = await initializeModels(sequelize);
    
    // 同步数据库
    const syncResult = await syncDatabase(sequelize);
    
    if (syncResult) {
      // 创建默认数据
      await createDefaultHomepageSettings(models);
      
      console.log('[初始化工具] 数据库初始化完成');
    } else {
      console.error('[初始化工具] 数据库初始化失败');
    }
  } catch (error) {
    console.error('[初始化工具] 执行失败:', error);
  }
};

// 执行主函数
main().catch(error => {
  console.error('[初始化工具] 未捕获错误:', error);
  process.exit(1);
}); 