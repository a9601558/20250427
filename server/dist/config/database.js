"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const sequelize_1 = require("sequelize");
const dotenv_1 = __importDefault(require("dotenv"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
// 使用相对路径指向项目根目录的.env文件
const envPath = path_1.default.join(process.cwd(), '.env');
// 检查并加载 .env 文件
if (fs_1.default.existsSync(envPath)) {
    console.log(`加载环境变量文件: ${envPath}`);
    dotenv_1.default.config({ path: envPath });
}
else {
    console.warn(`警告: 环境变量文件不存在: ${envPath}`);
}
// 数据库配置
const dbConfig = {
    dialect: 'mysql',
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
const sequelize = new sequelize_1.Sequelize(dbConfig);
// 测试数据库连接
const testConnection = async () => {
    try {
        await sequelize.authenticate();
        console.log('数据库连接成功！');
    }
    catch (error) {
        console.error('无法连接到数据库:', error);
        process.exit(1); // 如果无法连接，退出进程
    }
};
// 立即测试连接
testConnection();
exports.default = sequelize;
