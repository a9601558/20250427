const path = require('path');
const fs = require('fs');
const { Sequelize } = require('sequelize');
const { Umzug, SequelizeStorage } = require('umzug');
require('dotenv').config();

async function runMigrations() {
  try {
    console.log('开始运行数据库迁移...');

    // 从环境变量加载数据库配置
    const sequelize = new Sequelize(
      process.env.DB_NAME || 'exam_practice',
      process.env.DB_USER || 'root',
      process.env.DB_PASSWORD || '',
      {
        host: process.env.DB_HOST || 'localhost',
        dialect: 'mysql',
        logging: false,
      }
    );

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

    console.log('数据库迁移完成');
    process.exit(0);
  } catch (error) {
    console.error('迁移过程中出错:', error);
    process.exit(1);
  }
}

// 执行迁移
runMigrations(); 