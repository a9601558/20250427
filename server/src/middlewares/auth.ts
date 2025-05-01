import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import User from '../models/User';
import dotenv from 'dotenv';

dotenv.config();

// 扩展 Request 类型，添加 user 属性
declare global {
  namespace Express {
    interface Request {
      user?: any;
    }
  }
}

// JWT 身份验证中间件
export const authenticateJwt = async (req: Request, res: Response, next: NextFunction) => {
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
      const decoded: any = jwt.verify(token, jwtSecret);
      
      // 查找用户
      const user = await User.findByPk(decoded.id);
      
      if (!user) {
        return res.status(401).json({ success: false, message: '无效的用户令牌' });
      }
      
      // 将用户信息添加到请求中
      req.user = user;
      next();
    } catch (error) {
      console.error('JWT 验证失败:', error);
      return res.status(401).json({ success: false, message: '令牌验证失败' });
    }
  } catch (error) {
    console.error('身份验证中间件错误:', error);
    return res.status(500).json({ success: false, message: '服务器错误' });
  }
};

// 管理员权限中间件
export const requireAdmin = (req: Request, res: Response, next: NextFunction) => {
  if (!req.user || !req.user.isAdmin) {
    return res.status(403).json({ success: false, message: '需要管理员权限' });
  }
  
  next();
}; 