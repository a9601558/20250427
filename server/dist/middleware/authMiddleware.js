"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateToken = exports.admin = exports.protect = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const User_1 = __importDefault(require("../models/User"));
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
                    message: 'User not found or token invalid'
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
                        message: 'Account is locked due to too many failed login attempts',
                        lockExpires: lockUntil
                    });
                }
            }
            return next();
        }
        catch (error) {
            console.error('Authentication error:', error);
            return res.status(401).json({
                success: false,
                message: 'Not authorized, token failed',
                error: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
        }
    }
    if (!token) {
        return res.status(401).json({
            success: false,
            message: 'Not authorized, no token provided'
        });
    }
};
exports.protect = protect;
/**
 * Middleware to verify user has admin role
 * Must be used after the protect middleware
 */
const admin = (req, res, next) => {
    if (!req.user) {
        return res.status(401).json({
            success: false,
            message: 'Authentication required'
        });
    }
    if (req.user.isAdmin || req.user.role === 'admin') {
        next();
    }
    else {
        res.status(403).json({
            success: false,
            message: 'Admin privileges required for this operation'
        });
    }
};
exports.admin = admin;
/**
 * Generate JWT token for authentication
 */
const generateToken = (id, isAdmin = false) => {
    const secret = process.env.JWT_SECRET || 'default_secret';
    const expiresIn = process.env.JWT_EXPIRES_IN || '30d';
    // @ts-ignore - Type issues with JWT sign
    return jsonwebtoken_1.default.sign({ id, isAdmin }, secret, { expiresIn });
};
exports.generateToken = generateToken;
