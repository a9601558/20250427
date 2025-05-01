const path = require('path');
const fs = require('fs');
const { Sequelize, DataTypes } = require('sequelize');
const { Umzug, SequelizeStorage } = require('umzug');
require('dotenv').config();

async function runMigrations() {
  try {
    console.log('开始运行数据库迁移...');

    // 从环境变量加载数据库配置
    const sequelize = new Sequelize({
      database: process.env.DB_NAME || 'exam_platform',
      username: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '3306', 10),
      dialect: 'mysql',
      logging: false,
    });

    // 测试数据库连接
    try {
      await sequelize.authenticate();
      console.log('数据库连接成功');
    } catch (err) {
      console.error('无法连接到数据库:', err);
      process.exit(1);
    }

    // 初始化迁移
    const umzug = new Umzug({
      migrations: {
        glob: ['src/migrations/*.js', { cwd: path.resolve(__dirname) }],
      },
      context: sequelize.getQueryInterface(),
      storage: new SequelizeStorage({ sequelize }),
      logger: console,
    });

    // 获取所有挂起的迁移
    const pending = await umzug.pending();
    console.log(`发现 ${pending.length} 个待执行的迁移`);

    if (pending.length > 0) {
      // 运行所有迁移
      const migrations = await umzug.up();
      console.log('已成功运行以下迁移:');
      migrations.forEach(migration => {
        console.log(`- ${migration.name}`);
      });
    } else {
      console.log('没有待执行的迁移');
    }

    // Add examCountdowns column to the users table if it doesn't exist
    try {
      await sequelize.query(`
        ALTER TABLE users 
        ADD COLUMN IF NOT EXISTS examCountdowns JSON NULL DEFAULT '[]' 
        COMMENT '用户保存的考试倒计时数据';
      `);
      console.log('Successfully added examCountdowns column to users table');
    } catch (error) {
      console.error('Error adding examCountdowns column:', error.message);
    }

    console.log('数据库迁移完成');
    process.exit(0);
  } catch (error) {
    console.error('迁移过程中出错:', error);
    process.exit(1);
  } finally {
    await sequelize.close();
  }
}

// 执行迁移
runMigrations(); 