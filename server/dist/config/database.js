"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const sequelize_1 = require("sequelize");
const dotenv_1 = __importDefault(require("dotenv"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
// Load environment variables from .env file
const envPath = path_1.default.resolve(__dirname, '../../.env');
if (fs_1.default.existsSync(envPath)) {
    console.log('加载环境变量文件:', envPath);
    dotenv_1.default.config({ path: envPath });
}
else {
    console.log('未找到.env文件，使用默认配置');
    dotenv_1.default.config();
}
// Database configuration with fallbacks
const DB_HOST = process.env.DB_HOST || 'localhost';
const DB_PORT = parseInt(process.env.DB_PORT || '3306', 10);
const DB_NAME = process.env.DB_NAME || 'quiz_app';
const DB_USER = process.env.DB_USER || 'root'; // Default to root
const DB_PASSWORD = process.env.DB_PASSWORD || ''; // Default to empty password
console.log(`数据库连接信息: ${DB_HOST}:${DB_PORT}/${DB_NAME} (用户: ${DB_USER})`);
// Configure Sequelize
const sequelizeOptions = {
    host: DB_HOST,
    port: DB_PORT,
    dialect: 'mysql',
    logging: process.env.NODE_ENV === 'development' ? console.log : false,
    timezone: '+08:00',
    define: {
        charset: 'utf8mb4',
        collate: 'utf8mb4_unicode_ci',
        timestamps: true,
    },
    pool: {
        max: 20,
        min: 0,
        acquire: 60000,
        idle: 10000
    }
};
// Handle connection errors gracefully
const sequelize = new sequelize_1.Sequelize(DB_NAME, DB_USER, DB_PASSWORD, sequelizeOptions);
// Test the connection
sequelize.authenticate()
    .then(() => {
    console.log('数据库连接成功!');
})
    .catch(err => {
    console.error('数据库连接失败:', err);
    // Continue execution to allow for error handling in routes
});
exports.default = sequelize;
