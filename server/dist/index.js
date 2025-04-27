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
// Load environment variables
dotenv_1.default.config();
// Import models to ensure they are initialized
const models_1 = require("./models");
require("./models/HomepageSettings");
// Import routes (will create these next)
const userRoutes_1 = __importDefault(require("./routes/userRoutes"));
const questionSetRoutes_1 = __importDefault(require("./routes/questionSetRoutes"));
const purchaseRoutes_1 = __importDefault(require("./routes/purchaseRoutes"));
const redeemCodeRoutes_1 = __importDefault(require("./routes/redeemCodeRoutes"));
const homepageRoutes_1 = __importDefault(require("./routes/homepageRoutes"));
// Initialize express app
const app = (0, express_1.default)();
const PORT = process.env.PORT || 5000;
// 信任代理，解决X-Forwarded-For头问题
app.set('trust proxy', true);
// Security middleware
app.use((0, helmet_1.default)());
// Rate limit configuration
const generalLimiter = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // 100 requests per IP
    standardHeaders: true,
    message: {
        success: false,
        message: '请求过于频繁，请稍后再试'
    }
});
// Login attempt limit
const loginLimiter = (0, express_rate_limit_1.default)({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 10, // 10 login attempts per IP
    standardHeaders: true,
    message: {
        success: false,
        message: '登录尝试次数过多，请稍后再试'
    }
});
// Middleware
app.use((0, cors_1.default)({
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true
}));
app.use(express_1.default.json({ limit: '50mb' }));
app.use((0, morgan_1.default)('dev'));
// Serve static files
app.use(express_1.default.static(path_1.default.join(__dirname, '../public')));
app.use('/images', express_1.default.static(path_1.default.join(__dirname, '../public/images')));
// Apply global rate limit
app.use(generalLimiter);
// 在控制台输出一个清晰的分隔符
console.log('=========== API路由注册开始 ===========');
// Routes
app.use('/api/users/login', loginLimiter); // Login route extra restriction
app.use('/api/users', userRoutes_1.default);
// QuestionSet路由处理所有题库相关的功能
console.log('注册路由: /api/question-sets');
app.use('/api/question-sets', questionSetRoutes_1.default);
app.use('/api/purchases', purchaseRoutes_1.default);
app.use('/api/redeem-codes', redeemCodeRoutes_1.default);
app.use('/api/homepage', homepageRoutes_1.default);
console.log('=========== API路由注册结束 ===========');
// Create uploads directory if it doesn't exist
const uploadsDir = path_1.default.join(__dirname, '../uploads');
if (!fs_1.default.existsSync(uploadsDir)) {
    fs_1.default.mkdirSync(uploadsDir, { recursive: true });
}
app.use('/uploads', express_1.default.static(uploadsDir));
// Base route
app.get('/', (req, res) => {
    res.json({ message: '欢迎使用在线考试练习系统API' });
});
// 健康检查端点
app.get('/api/health', (req, res) => {
    res.status(200).json({
        status: 'ok',
        message: '系统正常运行',
        timestamp: new Date().toISOString()
    });
});
// 404 handler
app.use((req, res, next) => {
    console.error(`找不到路径 - ${req.originalUrl}`); // 添加错误日志
    res.status(404).json({
        success: false,
        message: `找不到路径 - ${req.originalUrl}`
    });
});
// Error handling middleware
app.use((err, req, res, next) => {
    console.error('服务器错误:', err.stack);
    const statusCode = err.statusCode || 500;
    const message = err.message || '服务器内部错误';
    res.status(statusCode).json({
        success: false,
        message,
        error: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
});
// 同步数据库模型，然后启动服务器
(async () => {
    try {
        console.log('开始同步数据库模型...');
        await (0, models_1.syncModels)();
        console.log('数据库模型同步完成');
        // Start server
        app.listen(PORT, () => {
            console.log(`服务器以 ${process.env.NODE_ENV} 模式运行，端口 ${PORT}`);
        });
    }
    catch (error) {
        console.error('服务器启动失败:', error);
    }
})();
exports.default = app;
