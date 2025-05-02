const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const mysql = require('mysql2/promise');
require('dotenv').config();

// 颜色控制台输出
const colors = {
    reset: '\x1b[0m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m',
};

console.log(`${colors.cyan}=== 宝塔面板自动部署脚本 ===${colors.reset}`);

// 数据库配置
const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'exam_practice',
};

// 检查环境变量
const checkEnv = () => {
    console.log(`${colors.yellow}[1/5] 检查环境变量...${colors.reset}`);
    
    const requiredVars = ['DB_HOST', 'DB_USER', 'DB_PASSWORD', 'DB_NAME'];
    const missing = requiredVars.filter((varName) => !process.env[varName]);
    
    if (missing.length > 0) {
        console.error(`${colors.red}错误: 缺少必要的环境变量: ${missing.join(', ')}${colors.reset}`);
        console.log('请确保 .env 文件存在并包含所有必要的变量。');
        process.exit(1);
    }
    
    console.log(`${colors.green}环境变量检查通过${colors.reset}`);
};

// 安装依赖
const installDependencies = () => {
    console.log(`${colors.yellow}[2/5] 安装依赖...${colors.reset}`);
    try {
        execSync('npm install', { stdio: 'inherit' });
        console.log(`${colors.green}依赖安装完成${colors.reset}`);
    } catch (error) {
        console.error(`${colors.red}依赖安装失败:${colors.reset}`, error.message);
        process.exit(1);
    }
};

// 编译代码
const buildCode = () => {
    console.log(`${colors.yellow}[3/5] 编译TypeScript代码...${colors.reset}`);
    try {
        execSync('npm run build', { stdio: 'inherit' });
        console.log(`${colors.green}代码编译完成${colors.reset}`);
    } catch (error) {
        console.error(`${colors.red}代码编译失败:${colors.reset}`, error.message);
        process.exit(1);
    }
};

// 设置数据库
const setupDatabase = async () => {
    console.log(`${colors.yellow}[4/5] 设置数据库...${colors.reset}`);
    
    let connection;
    
    try {
        // 连接到MySQL（不指定数据库）
        connection = await mysql.createConnection({
            host: dbConfig.host,
            user: dbConfig.user,
            password: dbConfig.password,
        });
        
        // 创建数据库（如果不存在）
        await connection.query(`CREATE DATABASE IF NOT EXISTS ${dbConfig.database} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`);
        console.log(`${colors.green}数据库 '${dbConfig.database}' 已创建或已存在${colors.reset}`);
        
        // 切换到该数据库
        await connection.query(`USE ${dbConfig.database};`);
        
        // 执行所有迁移文件
        console.log(`${colors.blue}执行数据库迁移...${colors.reset}`);
        execSync('npm run migrate', { stdio: 'inherit' });
        
        console.log(`${colors.green}数据库设置完成${colors.reset}`);
    } catch (error) {
        console.error(`${colors.red}数据库设置失败:${colors.reset}`, error.message);
        process.exit(1);
    } finally {
        if (connection) {
            await connection.end();
        }
    }
};

// 部署完成后的清理工作
const cleanupAndFinish = () => {
    console.log(`${colors.yellow}[5/5] 清理并完成部署...${colors.reset}`);
    
    // 创建必要的目录
    const publicImgDir = path.join(__dirname, 'public', 'images');
    if (!fs.existsSync(publicImgDir)) {
        fs.mkdirSync(publicImgDir, { recursive: true });
        console.log(`${colors.blue}创建目录: ${publicImgDir}${colors.reset}`);
    }
    
    console.log(`${colors.green}部署过程完成${colors.reset}`);
    console.log(`${colors.cyan}=== 部署成功! ===${colors.reset}`);
    console.log(`现在可以启动应用: ${colors.yellow}npm start${colors.reset}`);
};

// 运行部署流程
const deploy = async () => {
    try {
        checkEnv();
        installDependencies();
        buildCode();
        await setupDatabase();
        cleanupAndFinish();
    } catch (error) {
        console.error(`${colors.red}部署失败:${colors.reset}`, error.message);
        process.exit(1);
    }
};

// 执行部署流程
deploy(); 
