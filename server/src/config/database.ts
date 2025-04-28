import { Sequelize, Dialect } from 'sequelize';

// 数据库配置
const dbConfig = {
  dialect: 'mysql' as Dialect,
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '3306'),
  username: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'quiz_app',
  logging: console.log, // 启用日志以便调试
  pool: {
    max: 5,
    min: 0,
    acquire: 30000,
    idle: 10000
  },
  dialectOptions: {
    connectTimeout: 10000, // 10 秒连接超时
  }
};

// 创建 Sequelize 实例
const sequelize = new Sequelize(dbConfig);

// 测试数据库连接
const testConnection = async () => {
  try {
    await sequelize.authenticate();
    console.log('数据库连接成功！');
  } catch (error) {
    console.error('无法连接到数据库:', error);
    process.exit(1); // 如果无法连接，退出进程
  }
};

// 立即测试连接
testConnection();

export default sequelize; 