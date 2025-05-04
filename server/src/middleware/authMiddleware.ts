import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import User from '../models/User';

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
        } else {
          return res.status(401).json({
            success: false,
            message: 'Account is locked due to too many failed login attempts',
            lockExpires: lockUntil
          });
        }
      }

      return next();
    } catch (error) {
      console.error('Authentication error:', error);
      return res.status(401).json({
        success: false,
        message: 'Not authorized, token failed',
        error: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined
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

/**
 * Middleware to verify user has admin role
 * Must be used after the protect middleware
 */
export const admin = (req: Request, res: Response, next: NextFunction) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required'
    });
  }

  if (req.user.isAdmin || req.user.role === 'admin') {
    next();
  } else {
    res.status(403).json({
      success: false,
      message: 'Admin privileges required for this operation'
    });
  }
};

/**
 * Generate JWT token for authentication
 */
export const generateToken = (id: string, isAdmin: boolean = false): string => {
  const secret = process.env.JWT_SECRET || 'default_secret';
  const expiresIn = process.env.JWT_EXPIRES_IN || '30d';
  
  // @ts-ignore - Type issues with JWT sign
  return jwt.sign({ id, isAdmin }, secret, { expiresIn });
}; 