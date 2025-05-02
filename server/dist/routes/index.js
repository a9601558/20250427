"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const userRoutes_1 = __importDefault(require("./userRoutes"));
const questionSetRoutes_1 = __importDefault(require("./questionSetRoutes"));
const questionRoutes_1 = __importDefault(require("./questionRoutes"));
const userProgressRoutes_1 = __importDefault(require("./userProgressRoutes"));
const purchaseRoutes_1 = __importDefault(require("./purchaseRoutes"));
const redeemCodeRoutes_1 = __importDefault(require("./redeemCodeRoutes"));
const homepageRoutes_1 = __importDefault(require("./homepageRoutes"));
const wrongAnswerRoutes_1 = __importDefault(require("./wrongAnswerRoutes"));
const logger_1 = require("../utils/logger");
/**
 * 配置所有API路由
 * @param app Express应用实例
 * @param req Express请求对象
 * @param res Express响应对象
 */
const configureRoutes = (app, req, res) => {
    logger_1.logger.info('配置API路由');
    // API路由
    app.use('/api/users', userRoutes_1.default);
    app.use('/api/question-sets', questionSetRoutes_1.default);
    app.use('/api/questions', questionRoutes_1.default);
    app.use('/api/user-progress', userProgressRoutes_1.default);
    app.use('/api/purchases', purchaseRoutes_1.default);
    app.use('/api/redeem-codes', redeemCodeRoutes_1.default);
    app.use('/api/homepage', homepageRoutes_1.default);
    app.use('/api/wrong-answers', wrongAnswerRoutes_1.default);
    // 最后的错误处理中间件
    app.use((err, req, res, next) => {
        logger_1.logger.error('请求处理错误:', err);
        res.status(500).json({
            success: false,
            message: '服务器内部错误',
            error: process.env.NODE_ENV === 'development' ? err.message : undefined,
        });
    });
};
exports.default = configureRoutes;
