"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const morgan_1 = __importDefault(require("morgan"));
const dotenv_1 = __importDefault(require("dotenv"));
const db_1 = __importDefault(require("./config/db"));
const helmet_1 = __importDefault(require("helmet"));
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
// Load environment variables
dotenv_1.default.config();
// Import models to ensure they are initialized
require("./models");
// Import routes (will create these next)
const userRoutes_1 = __importDefault(require("./routes/userRoutes"));
const questionSetRoutes_1 = __importDefault(require("./routes/questionSetRoutes"));
const purchaseRoutes_1 = __importDefault(require("./routes/purchaseRoutes"));
const redeemCodeRoutes_1 = __importDefault(require("./routes/redeemCodeRoutes"));
// Initialize express app
const app = (0, express_1.default)();
const PORT = process.env.PORT || 5000;
// Connect to database
(0, db_1.default)();
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
app.use(express_1.default.json());
app.use((0, morgan_1.default)('dev'));
// Apply global rate limit
app.use(generalLimiter);
// Routes
app.use('/api/users/login', loginLimiter); // Login route extra restriction
app.use('/api/users', userRoutes_1.default);
app.use('/api/question-sets', questionSetRoutes_1.default);
app.use('/api/purchases', purchaseRoutes_1.default);
app.use('/api/redeem-codes', redeemCodeRoutes_1.default);
// Base route
app.get('/', (req, res) => {
    res.json({ message: '欢迎使用在线考试练习系统API' });
});
// 404 handler
app.use((req, res, next) => {
    res.status(404).json({
        success: false,
        message: `找不到路径 - ${req.originalUrl}`
    });
});
// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    const statusCode = err.statusCode || 500;
    const message = err.message || '服务器内部错误';
    res.status(statusCode).json({
        success: false,
        message,
        error: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
});
// Start server
app.listen(PORT, () => {
    console.log(`服务器以 ${process.env.NODE_ENV} 模式运行，端口 ${PORT}`);
});
exports.default = app;
