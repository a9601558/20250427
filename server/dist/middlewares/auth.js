"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireAdmin = exports.authenticateJwt = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const User_1 = __importDefault(require("../models/User"));
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
// JWT 身份验证中间件
const authenticateJwt = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader) {
            return res.status(401).json({ success: false, message: '未提供身份验证令牌' });
        }
        const token = authHeader.split(' ')[1];
        if (!token) {
            return res.status(401).json({ success: false, message: '未提供有效的身份验证令牌' });
        }
        const jwtSecret = process.env.JWT_SECRET || 'your-secret-key';
        try {
            const decoded = jsonwebtoken_1.default.verify(token, jwtSecret);
            // 查找用户
            const user = await User_1.default.findByPk(decoded.id);
            if (!user) {
                return res.status(401).json({ success: false, message: '无效的用户令牌' });
            }
            // 将用户信息添加到请求中
            req.user = user;
            next();
        }
        catch (error) {
            console.error('JWT 验证失败:', error);
            return res.status(401).json({ success: false, message: '令牌验证失败' });
        }
    }
    catch (error) {
        console.error('身份验证中间件错误:', error);
        return res.status(500).json({ success: false, message: '服务器错误' });
    }
};
exports.authenticateJwt = authenticateJwt;
// 管理员权限中间件
const requireAdmin = (req, res, next) => {
    if (!req.user || !req.user.isAdmin) {
        return res.status(403).json({ success: false, message: '需要管理员权限' });
    }
    next();
};
exports.requireAdmin = requireAdmin;
