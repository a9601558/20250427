"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateToken = exports.requireAdmin = exports.admin = exports.authenticateJwt = exports.protect = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const User_1 = __importDefault(require("../models/User"));
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
/**
 * Middleware to protect routes requiring authentication
 * Verifies JWT token and attaches user to request
 */
const protect = async (req, res, next) => {
    let token;
    // Check for token in Authorization header
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        try {
            // Get token from header
            token = req.headers.authorization.split(' ')[1];
            // Verify token
            const decoded = jsonwebtoken_1.default.verify(token, process.env.JWT_SECRET || 'default_secret');
            // Get user from token
            req.user = await User_1.default.findByPk(decoded.id, {
                attributes: { exclude: ['password'] }
            });
            if (!req.user) {
                return res.status(401).json({
                    success: false,
                    message: '用户不存在或令牌无效'
                });
            }
            // Check if account is locked
            if (req.user.accountLocked) {
                const now = new Date();
                const lockUntil = req.user.lockUntil ? new Date(req.user.lockUntil) : null;
                // If lock period has expired, unlock the account
                if (lockUntil && now > lockUntil) {
                    req.user.accountLocked = false;
                    req.user.lockUntil = null;
                    await req.user.save();
                }
                else {
                    return res.status(401).json({
                        success: false,
                        message: '账户因多次登录失败已被锁定',
                        lockExpires: lockUntil
                    });
                }
            }
            return next();
        }
        catch (error) {
            console.error('认证错误:', error);
            return res.status(401).json({
                success: false,
                message: '未授权，令牌验证失败',
                error: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
        }
    }
    if (!token) {
        return res.status(401).json({
            success: false,
            message: '未授权，未提供令牌'
        });
    }
};
exports.protect = protect;
/**
 * Alternative name for protect middleware to maintain compatibility
 * with existing code using authenticateJwt
 */
exports.authenticateJwt = exports.protect;
/**
 * Middleware to verify user has admin role
 * Must be used after the protect middleware
 */
const admin = (req, res, next) => {
    if (!req.user) {
        return res.status(401).json({
            success: false,
            message: '需要身份验证'
        });
    }
    if (req.user.isAdmin || req.user.role === 'admin') {
        next();
    }
    else {
        res.status(403).json({
            success: false,
            message: '此操作需要管理员权限'
        });
    }
};
exports.admin = admin;
/**
 * Alternative name for admin middleware to maintain compatibility
 * with existing code using requireAdmin
 */
exports.requireAdmin = exports.admin;
/**
 * Generate JWT token for authentication
 */
const generateToken = (id, isAdmin = false) => {
    const secret = process.env.JWT_SECRET || 'default_secret';
    const expiresIn = process.env.JWT_EXPIRES_IN || '30d';
    // @ts-ignore - Type issues with JWT sign options
    return jsonwebtoken_1.default.sign({ id, isAdmin }, secret, { expiresIn });
};
exports.generateToken = generateToken;
