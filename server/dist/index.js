"use strict";
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
const database_1 = __importDefault(require("./config/database"));
const http_1 = require("http");
const socket_1 = require("./config/socket");
const associations_1 = require("./models/associations");
const appstate_1 = require("./utils/appstate");
const HomepageSettings_1 = __importDefault(require("./models/HomepageSettings"));
const sequelizeHelpers_1 = require("./utils/sequelizeHelpers");
// Load environment variables
dotenv_1.default.config();
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
const purchaseRoutes_1 = __importDefault(require("./routes/purchaseRoutes"));
const redeemCodeRoutes_1 = __importDefault(require("./routes/redeemCodeRoutes"));
const homepageRoutes_1 = __importDefault(require("./routes/homepageRoutes"));
const userProgressRoutes_1 = __importDefault(require("./routes/userProgressRoutes"));
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
    max: 100 // limit each IP to 100 requests per windowMs
});
app.use(limiter);
// API routes
app.use('/api/users', userRoutes_1.default);
app.use('/api/question-sets', questionSetRoutes_1.default);
app.use('/api/questions', questionRoutes_1.default);
app.use('/api/purchases', purchaseRoutes_1.default);
app.use('/api/redeem-codes', redeemCodeRoutes_1.default);
app.use('/api/homepage', homepageRoutes_1.default);
app.use('/api/user-progress', userProgressRoutes_1.default);
// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({
        success: false,
        message: '服务器内部错误',
        error: process.env.NODE_ENV === 'development' ? err.message : undefined
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
// 确保设置关联关系
console.log('正在应用字段映射修复...');
console.log('QuestionSet字段映射:', sequelizeHelpers_1.questionSetAttributes);
console.log('Purchase字段映射:', sequelizeHelpers_1.purchaseAttributes);
// 同步数据库并启动服务器
database_1.default.sync({ alter: true }).then(() => {
    console.log('数据库同步完成');
    // 确保 HomepageSettings 表有初始数据
    HomepageSettings_1.default.findByPk(1).then((homepageSettings) => {
        if (!homepageSettings) {
            console.log('创建 HomepageSettings 初始数据...');
            return HomepageSettings_1.default.create({
                id: 1,
                welcome_title: "ExamTopics 模拟练习",
                welcome_description: "选择以下任一题库开始练习，测试您的知识水平",
                featured_categories: ["网络协议", "编程语言", "计算机基础"],
                announcements: "欢迎使用在线题库系统，新增题库将定期更新，请持续关注！",
                footer_text: "© 2023 ExamTopics 在线题库系统 保留所有权利",
                banner_image: "/images/banner.jpg",
                theme: 'light'
            });
        }
    }).then(() => {
        server.listen(PORT, () => {
            console.log(`Server is running on port ${PORT}`);
        });
    });
});
exports.default = app;
