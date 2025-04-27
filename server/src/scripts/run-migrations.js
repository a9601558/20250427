const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const initializeDatabase = require('./init-database');

console.log('初始化服务器...');

async function initializeServer() {
  try {
    // 先初始化数据库
    console.log('初始化数据库...');
    const dbInitSuccess = await initializeDatabase();
    
    if (!dbInitSuccess) {
      console.error('数据库初始化失败，终止服务器启动');
      process.exit(1);
    }
    
    console.log('数据库初始化成功');

    // 检查uploads目录
    const uploadsDir = path.join(__dirname, '../../uploads');
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
      console.log('已创建uploads目录');
    }

    // 检查public/images目录
    const imagesDir = path.join(__dirname, '../../public/images');
    if (!fs.existsSync(imagesDir)) {
      fs.mkdirSync(imagesDir, { recursive: true });
      console.log('已创建public/images目录');
    }

    console.log('服务器初始化完成');
  } catch (error) {
    console.error('服务器初始化失败:', error.message);
    process.exit(1);
  }
}

// 执行初始化
initializeServer(); 