"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const morgan_1 = __importDefault(require("morgan"));
const dotenv_1 = __importDefault(require("dotenv"));
const helmet_1 = __importDefault(require("helmet"));
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const http_1 = require("http");
const socket_1 = require("./config/socket");
const associations_1 = require("./models/associations");
const appstate_1 = require("./utils/appstate");
const applyFieldMappings_1 = require("./utils/applyFieldMappings");
const database_validator_1 = require("./utils/database-validator");
const logger_1 = require("./utils/logger");
// 确保在一开始就加载环境变量
const envPath = path_1.default.join(process.cwd(), '.env');
if (fs_1.default.existsSync(envPath)) {
    logger_1.logger.info(`加载环境变量文件: ${envPath}`);
    dotenv_1.default.config({ path: envPath });
}
else {
    logger_1.logger.warn(`警告: 环境变量文件不存在: ${envPath}`);
}
// Import models to ensure they are initialized
require("./models/User");
require("./models/QuestionSet");
require("./models/Question");
require("./models/Option");
require("./models/Purchase");
require("./models/RedeemCode");
require("./models/UserProgress");
// Import routes
const userRoutes_1 = __importDefault(require("./routes/userRoutes"));
const questionSetRoutes_1 = __importDefault(require("./routes/questionSetRoutes"));
const questionRoutes_1 = __importDefault(require("./routes/questionRoutes"));
const userProgressRoutes_1 = __importDefault(require("./routes/userProgressRoutes"));
const purchaseRoutes_1 = __importDefault(require("./routes/purchaseRoutes"));
const redeemCodeRoutes_1 = __importDefault(require("./routes/redeemCodeRoutes"));
const homepageRoutes_1 = __importDefault(require("./routes/homepageRoutes"));
const wrongAnswerRoutes_1 = __importDefault(require("./routes/wrongAnswerRoutes"));
// Initialize express app
const app = (0, express_1.default)();
const PORT = process.env.PORT || 5000;
// 设置trust proxy为1，只信任第一级代理（通常是Nginx）
app.set('trust proxy', 1);
// Middleware
app.use((0, cors_1.default)());
app.use(express_1.default.json());
app.use((0, morgan_1.default)('dev'));
app.use((0, helmet_1.default)());
// Rate limiting
const limiter = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
});
app.use(limiter);
// API routes
app.use('/api/users', userRoutes_1.default);
app.use('/api/question-sets', questionSetRoutes_1.default);
app.use('/api/questions', questionRoutes_1.default);
app.use('/api/user-progress', userProgressRoutes_1.default);
app.use('/api/purchases', purchaseRoutes_1.default);
app.use('/api/redeem-codes', redeemCodeRoutes_1.default);
app.use('/api/homepage', homepageRoutes_1.default);
app.use('/api/wrong-answers', wrongAnswerRoutes_1.default);
// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({
        success: false,
        message: '服务器内部错误',
        error: process.env.NODE_ENV === 'development' ? err.message : undefined,
    });
});
// Start server
const server = (0, http_1.createServer)(app);
// Initialize socket
(0, socket_1.initializeSocket)(server);
// 初始化模型关联
console.log('正在初始化模型关联...');
(0, associations_1.setupAssociations)();
appstate_1.appState.associationsInitialized = true;
console.log('模型关联初始化完成');
// 应用字段映射修复
(0, applyFieldMappings_1.applyGlobalFieldMappings)();
// 启动验证和主程序
async function bootstrap() {
    try {
        // 首先验证数据库连接
        logger_1.logger.info('正在验证数据库连接...');
        const isDbValid = await (0, database_validator_1.validateDatabaseConnection)();
        if (!isDbValid) {
            logger_1.logger.error('数据库连接验证失败，尝试使用紧急恢复措施...');
            // 尝试应急措施，但继续启动应用
        }
        else {
            logger_1.logger.info('数据库连接验证成功！');
        }
        // 在验证之后导入主应用，确保数据库已准备就绪
        const { default: server, syncDatabase } = await Promise.resolve().then(() => __importStar(require('./app')));
        // 同步数据库
        await syncDatabase();
        // 获取PORT
        const PORT = process.env.PORT || 3001;
        // 启动服务器
        server.listen(PORT, () => {
            logger_1.logger.info(`服务器在端口 ${PORT} 上运行`);
        });
        // 处理未捕获的异常
        process.on('uncaughtException', (err) => {
            logger_1.logger.error('未捕获的异常:', err);
        });
        // 处理未处理的Promise拒绝
        process.on('unhandledRejection', (reason) => {
            logger_1.logger.error('未处理的Promise拒绝:', reason);
        });
        // 确保 HomepageSettings 表有初始数据
        const homepageSettingsModule = await Promise.resolve().then(() => __importStar(require('./models/HomepageSettings')));
        const HomepageSettings = homepageSettingsModule.default;
        const settingsCount = await HomepageSettings.count();
        if (settingsCount === 0) {
            logger_1.logger.info('创建默认首页设置...');
            await HomepageSettings.create({
                featuredCategories: [],
                siteTitle: '考试平台',
                welcomeMessage: '欢迎使用我们的考试平台！',
                footerText: '© 2024 考试平台 版权所有',
            });
        }
        // 导出server实例以便测试
        return server;
    }
    catch (error) {
        logger_1.logger.error('服务器启动失败:', error);
        process.exit(1);
    }
}
// 启动应用
bootstrap().catch(err => {
    logger_1.logger.error('启动过程中出错:', err);
    process.exit(1);
});
exports.default = app;
