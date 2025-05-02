
// Sequelize Instance Recovery - 自动添加于 2025-05-02T10:36:55.642Z
// 这段代码确保Sequelize模型总是有有效的实例，即使在模块导入失败的情况下
(function() {
  try {
    // 修复空的sequelize实例
    if (typeof global.sequelize === 'undefined' && 
        (typeof sequelize === 'undefined' || !sequelize)) {
      const { Sequelize } = require('sequelize');
      const path = require('path');
      const fs = require('fs');
      const dotenv = require('dotenv');
      
      // 加载环境变量
      const envPath = path.join(process.cwd(), '.env');
      if (fs.existsSync(envPath)) {
        console.log('Recovery: 加载环境变量文件', envPath);
        dotenv.config({ path: envPath });
      }
      
      console.log('Recovery: 创建应急Sequelize实例');
      global.sequelize = new Sequelize(
        process.env.DB_NAME || 'quiz_app',
        process.env.DB_USER || 'root',
        process.env.DB_PASSWORD || '',
        {
          host: process.env.DB_HOST || 'localhost',
          port: parseInt(process.env.DB_PORT || '3306'),
          dialect: 'mysql',
          logging: false,
          pool: { max: 5, min: 0, acquire: 30000, idle: 10000 }
        }
      );
      
      // 设置全局变量，避免"未定义"错误
      if (typeof sequelize === 'undefined') {
        global.sequelize = global.sequelize;
      }
    }
  } catch (error) {
    console.error('Recovery: Sequelize恢复机制出错', error);
  }
})();
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateToken = exports.admin = exports.protect = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const User_1 = __importDefault(require("../models/User"));
// Middleware to protect routes
const protect = async (req, res, next) => {
    let token;
    // Check for token in Authorization header
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        try {
            // Get token from header
            token = req.headers.authorization.split(' ')[1];
            // Verify token
            // @ts-ignore - JWT verify type issues
            const decoded = jsonwebtoken_1.default.verify(token, process.env.JWT_SECRET || '');
            // Get user from token (Sequelize方式)
            req.user = await User_1.default.findByPk(decoded.id, {
                attributes: { exclude: ['password'] },
            });
            if (!req.user) {
                return res.status(401).json({
                    success: false,
                    message: 'User not found, token invalid',
                });
            }
            return next();
        }
        catch (error) {
            console.error('Authentication error:', error);
            return res.status(401).json({
                success: false,
                message: 'Not authorized, token failed',
            });
        }
    }
    if (!token) {
        return res.status(401).json({
            success: false,
            message: 'Not authorized, no token',
        });
    }
};
exports.protect = protect;
// Middleware to check if user is admin
const admin = (req, res, next) => {
    if (req.user && req.user.isAdmin) {
        next();
    }
    else {
        res.status(403).json({
            success: false,
            message: 'Not authorized as admin',
        });
    }
};
exports.admin = admin;
// Generate JWT token
const generateToken = (id) => {
    const secret = process.env.JWT_SECRET || '';
    const expiresIn = process.env.JWT_EXPIRES_IN || '30d';
    // @ts-ignore - JWT sign type issues
    return jsonwebtoken_1.default.sign({ id }, secret, { expiresIn });
};
exports.generateToken = generateToken;
