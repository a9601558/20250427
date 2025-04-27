"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sequelize = void 0;
const promise_1 = __importDefault(require("mysql2/promise"));
const dotenv_1 = __importDefault(require("dotenv"));
const sequelize_1 = require("sequelize");
dotenv_1.default.config();
// 数据库连接配置
const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'exam_practice',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
};
// 创建连接池
const pool = promise_1.default.createPool(dbConfig);
// 创建Sequelize实例
exports.sequelize = new sequelize_1.Sequelize(dbConfig.database, dbConfig.user, dbConfig.password, {
    host: dbConfig.host,
    dialect: 'mysql',
    logging: false // 设置为console.log可以在控制台看到SQL查询
});
// 测试连接
pool.getConnection()
    .then(connection => {
    console.log('数据库连接成功 (mysql2)');
    connection.release();
})
    .catch(err => {
    console.error('数据库连接失败 (mysql2):', err);
});
// 测试Sequelize连接
exports.sequelize.authenticate()
    .then(() => {
    console.log('数据库连接成功 (Sequelize)');
})
    .catch(err => {
    console.error('数据库连接失败 (Sequelize):', err);
});
exports.default = pool;
