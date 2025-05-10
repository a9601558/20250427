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
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const database_1 = __importDefault(require("./config/database"));
const http_1 = require("http");
const socket_1 = require("./config/socket");
const associations_1 = require("./models/associations");
const appstate_1 = require("./utils/appstate");
const HomepageSettings_1 = __importDefault(require("./models/HomepageSettings"));
const defaultSettings_1 = require("./config/defaultSettings");
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
const userProgressRoutes_1 = __importDefault(require("./routes/userProgressRoutes"));
const purchaseRoutes_1 = __importDefault(require("./routes/purchaseRoutes"));
const redeemCodeRoutes_1 = __importDefault(require("./routes/redeemCodeRoutes"));
const homepageRoutes_1 = __importDefault(require("./routes/homepageRoutes"));
const wrongAnswerRoutes_1 = __importDefault(require("./routes/wrongAnswerRoutes"));
const payment_1 = __importDefault(require("./routes/payment"));
const adminRoutes_1 = __importDefault(require("./routes/adminRoutes"));
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
// General rate limiting - more restrictive
const standardLimiter = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 1000, // Increased from 100 to 500 requests per windowMs
    message: 'Too many requests from this IP, please try again later'
});
// Less restrictive rate limiting for homepage content - needed for admin updates
const homepageLimiter = (0, express_rate_limit_1.default)({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 600, // Increased from 120 to 300 requests
    message: 'Too many homepage requests, please try again later'
});
// Special rate limiter for admin operations - very lenient
const adminLimiter = (0, express_rate_limit_1.default)({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 500, // Very high limit for admin operations
    message: 'Too many admin requests, please try again later'
});
// 设置静态文件服务，用于提供上传的文件
const uploadsDir = path_1.default.join(__dirname, '../uploads');
// 确保上传目录存在
if (!fs_1.default.existsSync(uploadsDir)) {
    fs_1.default.mkdirSync(uploadsDir, { recursive: true });
}
app.use('/uploads', express_1.default.static(uploadsDir));
// Apply rate limiters to specific routes
app.use('/api/homepage', homepageLimiter);
app.use('/api/question-sets', homepageLimiter);
app.use('/api/admin', adminLimiter); // Apply admin limiter to admin routes
app.use('/api', standardLimiter); // Apply standard limiter to all other API routes
// API routes
app.use('/api/users', userRoutes_1.default);
app.use('/api/question-sets', questionSetRoutes_1.default);
app.use('/api/questions', questionRoutes_1.default);
app.use('/api/user-progress', userProgressRoutes_1.default);
app.use('/api/purchases', purchaseRoutes_1.default);
app.use('/api/redeem-codes', redeemCodeRoutes_1.default);
app.use('/api/homepage', homepageRoutes_1.default);
app.use('/api/wrong-answers', wrongAnswerRoutes_1.default);
app.use('/api/payments', payment_1.default);
app.use('/api/admin', adminRoutes_1.default);
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
// 同步数据库并启动服务器
database_1.default.sync({ alter: false }).then(() => {
    console.log('Database synced');
    // 初始化所有关联 - 现在所有关联都统一在 associations.ts 中管理
    (0, associations_1.setupAssociations)();
    console.log('All associations initialized');
    appstate_1.appState.associationsInitialized = true;
    // 确保 HomepageSettings 表有初始数据
    return HomepageSettings_1.default.findOne();
}).then(settings => {
    if (!settings) {
        console.log('创建首页默认设置');
        return HomepageSettings_1.default.create(defaultSettings_1.defaultHomepageSettings);
    }
    return settings;
}).then(() => {
    // 初始化 Socket.io
    const io = (0, socket_1.initializeSocket)(server);
    console.log('Socket.io 初始化完成');
    // 启动 HTTP 服务器
    server.listen(PORT, () => {
        console.log(`服务器已启动, 端口: ${PORT}`);
    });
}).catch(err => {
    console.error('Error during server initialization:', err);
});
exports.default = app;
