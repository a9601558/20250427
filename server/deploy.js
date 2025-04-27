const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

// 确保在项目根目录中运行
const rootDir = __dirname;

console.log('开始部署应用...');

try {
  // 安装依赖
  console.log('正在安装依赖...');
  execSync('npm install', { stdio: 'inherit', cwd: rootDir });
  console.log('依赖安装完成');

  // 编译 TypeScript
  console.log('正在编译 TypeScript 文件...');
  execSync('npm run build', { stdio: 'inherit', cwd: rootDir });
  console.log('TypeScript 编译完成');

  // 创建必要的目录
  const dirs = [
    path.join(rootDir, 'uploads'),
    path.join(rootDir, 'public'),
    path.join(rootDir, 'public/images')
  ];

  dirs.forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      console.log(`创建目录: ${dir}`);
    }
  });

  // 初始化数据库
  console.log('正在初始化数据库...');
  execSync('node src/scripts/init-database.js', { stdio: 'inherit', cwd: rootDir });
  console.log('数据库初始化完成');

  // 上传默认图片（如果有）
  const defaultImagesDir = path.join(rootDir, 'src/assets/default');
  const targetImagesDir = path.join(rootDir, 'public/images');
  
  if (fs.existsSync(defaultImagesDir)) {
    console.log('正在复制默认图片...');
    const imageFiles = fs.readdirSync(defaultImagesDir);
    
    imageFiles.forEach(file => {
      const sourcePath = path.join(defaultImagesDir, file);
      const targetPath = path.join(targetImagesDir, file);
      
      if (fs.statSync(sourcePath).isFile()) {
        fs.copyFileSync(sourcePath, targetPath);
        console.log(`复制文件: ${file}`);
      }
    });
  }

  console.log('应用部署完成！');
  console.log('现在您可以使用 "npm start" 启动应用');
} catch (error) {
  console.error('部署过程中出错:', error);
  process.exit(1);
} 