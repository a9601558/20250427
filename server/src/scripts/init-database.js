const mysql = require('mysql2/promise');
const dotenv = require('dotenv');
const path = require('path');
const { execSync } = require('child_process');
const fs = require('fs');

// 加载环境变量
dotenv.config({ path: path.join(__dirname, '../../.env') });

// 数据库配置
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || '3306',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'exam_practice_app'
};

async function initializeDatabase() {
  let connection;

  try {
    console.log('正在检查数据库...');
    
    // 尝试连接到MySQL，但不指定数据库
    connection = await mysql.createConnection({
      host: dbConfig.host,
      port: dbConfig.port,
      user: dbConfig.user,
      password: dbConfig.password
    });

    // 检查数据库是否存在
    const [rows] = await connection.execute(
      `SELECT SCHEMA_NAME FROM INFORMATION_SCHEMA.SCHEMATA WHERE SCHEMA_NAME = ?`,
      [dbConfig.database]
    );

    if (rows.length === 0) {
      console.log(`数据库 ${dbConfig.database} 不存在，正在创建...`);
      await connection.execute(`CREATE DATABASE IF NOT EXISTS ${dbConfig.database} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
      console.log(`数据库 ${dbConfig.database} 创建成功`);
    } else {
      console.log(`数据库 ${dbConfig.database} 已存在`);
    }

    // 关闭连接
    await connection.end();

    // 运行迁移
    console.log('正在执行数据库迁移...');
    try {
      execSync('npx sequelize-cli db:migrate', { stdio: 'inherit' });
      console.log('数据库迁移执行成功');
    } catch (migrateError) {
      console.error('数据库迁移执行失败:', migrateError.message);
      // 迁移失败不影响后续操作，因为模型同步可能会创建相应的表
    }

    // 检查数据库表是否存在
    try {
      // 创建一个新的连接，这次连接到指定的数据库
      const dbConnection = await mysql.createConnection({
        host: dbConfig.host,
        port: dbConfig.port,
        user: dbConfig.user,
        password: dbConfig.password,
        database: dbConfig.database
      });
      
      // 检查是否存在关键表，如users, question_sets等
      const [tables] = await dbConnection.execute(`SHOW TABLES`);
      const tableNames = tables.map(t => Object.values(t)[0].toLowerCase());
      
      // 关闭连接
      await dbConnection.end();
      
      const requiredTables = ['users', 'question_sets', 'questions', 'options'];
      const missingTables = requiredTables.filter(t => !tableNames.includes(t));
      
      if (missingTables.length > 0) {
        console.log(`缺少关键表: ${missingTables.join(', ')}，将强制同步所有模型...`);
        
        // 强制同步所有模型
        console.log('开始强制同步所有模型...');
        
        // 检查sync-all-models.ts是否存在
        const syncScriptPath = path.join(__dirname, 'sync-all-models.ts');
        if (!fs.existsSync(syncScriptPath)) {
          console.error('错误: 找不到同步脚本 sync-all-models.ts');
          return false;
        }
        
        // 运行同步脚本
        execSync('npx ts-node src/scripts/sync-all-models.ts', { 
          stdio: 'inherit',
          cwd: path.join(__dirname, '../..')
        });
        
        console.log('强制同步模型完成');
      } else {
        console.log('所有关键表都已存在，无需强制同步');
      }
    } catch (checkError) {
      console.error('检查数据库表时出错:', checkError);
      return false;
    }

    console.log('数据库初始化完成');
    return true;
  } catch (error) {
    console.error('数据库初始化失败:', error);
    if (connection) {
      await connection.end();
    }
    return false;
  }
}

// 如果直接运行这个脚本
if (require.main === module) {
  initializeDatabase()
    .then(success => {
      if (!success) {
        process.exit(1);
      }
    })
    .catch(err => {
      console.error('初始化数据库时发生错误:', err);
      process.exit(1);
    });
} else {
  // 如果作为模块导入
  module.exports = initializeDatabase;
} 