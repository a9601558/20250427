import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import User from '../models/User';
import dotenv from 'dotenv';

dotenv.config();

// Extend Express Request interface to include user
declare global {
  namespace Express {
    interface Request {
      user?: any;
    }
  }
}

// Interface for JWT payload
interface JwtPayload {
  id: string;
  isAdmin?: boolean;
}

/**
 * Middleware to protect routes requiring authentication
 * Verifies JWT token and attaches user to request
 */
export const protect = async (req: Request, res: Response, next: NextFunction) => {
  let token;

  // Check for token in Authorization header
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    try {
      // Get token from header
      token = req.headers.authorization.split(' ')[1];

      // Verify token
      const decoded = jwt.verify(
        token, 
        process.env.JWT_SECRET || 'default_secret'
      ) as JwtPayload;

      // Get user from token
      req.user = await User.findByPk(decoded.id, {
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
        } else {
          return res.status(401).json({
            success: false,
            message: '账户因多次登录失败已被锁定',
            lockExpires: lockUntil
          });
        }
      }

      return next();
    } catch (error) {
      console.error('认证错误:', error);
      return res.status(401).json({
        success: false,
        message: '未授权，令牌验证失败',
        error: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined
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

/**
 * Alternative name for protect middleware to maintain compatibility
 * with existing code using authenticateJwt
 */
export const authenticateJwt = protect;

/**
 * Middleware to verify user has admin role
 * Must be used after the protect middleware
 */
export const admin = (req: Request, res: Response, next: NextFunction) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: '需要身份验证'
    });
  }

  if (req.user.isAdmin || req.user.role === 'admin') {
    next();
  } else {
    res.status(403).json({
      success: false,
      message: '此操作需要管理员权限'
    });
  }
};

/**
 * Alternative name for admin middleware to maintain compatibility
 * with existing code using requireAdmin
 */
export const requireAdmin = admin;

/**
 * Generate JWT token for authentication
 */
export const generateToken = (id: string, isAdmin: boolean = false): string => {
  const secret = process.env.JWT_SECRET || 'default_secret';
  const expiresIn = process.env.JWT_EXPIRES_IN || '30d';
  
  // @ts-ignore - Type issues with JWT sign options
  return jwt.sign({ id, isAdmin }, secret, { expiresIn });
}; 