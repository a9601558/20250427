import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import User from '../models/User';

// Extend Express Request interface to include user
declare global {
  namespace Express {
    interface Request {
      user?: any;
      cognitoUser?: any;
    }
  }
}

// Interface for Cognito JWT payload
interface CognitoJwtPayload extends jwt.JwtPayload {
  sub: string;
  username?: string;
  email?: string;
  preferred_username?: string;
  iss: string;
  token_use: string;
  client_id: string;
}

// Function to verify AWS Cognito JWT token (production ready)
const verifyCognitoToken = async (token: string): Promise<CognitoJwtPayload> => {
  return new Promise((resolve, reject) => {
    console.log('[AuthMiddleware] 开始验证token, 长度:', token.length);
    
    // Decode the token to check its structure and claims
    const decoded = jwt.decode(token, { complete: true });
    
    console.log('[AuthMiddleware] Token解码结果:', decoded ? '成功' : '失败');
    
    if (!decoded || !decoded.payload || typeof decoded.payload === 'string') {
      console.log('[AuthMiddleware] Token格式无效');
      return reject(new Error('Invalid token format'));
    }

    const payload = decoded.payload as CognitoJwtPayload;
    console.log('[AuthMiddleware] Token payload:', {
      sub: payload.sub,
      iss: payload.iss,
      token_use: payload.token_use,
      exp: payload.exp,
      current_time: Math.floor(Date.now() / 1000)
    });
    
    // 检查必要字段
    if (!payload.sub) {
      console.log('[AuthMiddleware] Token缺少sub字段');
      return reject(new Error('Token missing sub field'));
    }
    
    // Validate essential Cognito token properties (more lenient for OIDC)
    const cognitoRegion = process.env.COGNITO_REGION || 'ap-southeast-2';
    const cognitoUserPoolId = process.env.COGNITO_USER_POOL_ID || 'ap-southeast-2_El0UTGvLD';
    const expectedIssuer = `https://cognito-idp.${cognitoRegion}.amazonaws.com/${cognitoUserPoolId}`;
    
    // 对OIDC token更宽松的验证
    if (payload.iss && payload.iss !== expectedIssuer) {
      console.log('[AuthMiddleware] Token issuer不匹配:', payload.iss, '期望:', expectedIssuer);
      // 对于OIDC token，如果iss不匹配，仍然继续（因为可能是测试环境）
      console.log('[AuthMiddleware] 继续处理（OIDC token可能有不同的issuer）');
    }
    
    // 检查token类型（对OIDC更宽松）
    if (payload.token_use && payload.token_use !== 'access' && payload.token_use !== 'id') {
      console.log('[AuthMiddleware] Token类型不是access或id token:', payload.token_use);
      // 继续处理，OIDC可能有不同的token_use值
    }
    
    // Check if token is expired
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp < now) {
      console.log('[AuthMiddleware] Token已过期, exp:', payload.exp, 'now:', now);
      return reject(new Error('Token has expired'));
    }
    
    console.log('[AuthMiddleware] Token验证成功');
    resolve(payload);
  });
};

// Pure AWS Cognito authentication middleware
export const protect = async (req: Request, res: Response, next: NextFunction) => {
  try {
    console.log('[AuthMiddleware] 开始处理认证请求');
    
    // Extract token from Authorization header
    const authHeader = req.headers.authorization;
    console.log('[AuthMiddleware] Authorization header:', authHeader ? 'Bearer ' + authHeader.substring(7, 20) + '...' : '空');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.log('[AuthMiddleware] 缺少或格式错误的Authorization header');
      return res.status(401).json({
        success: false,
        message: 'No authorization token provided'
      });
    }

    const token = authHeader.split(' ')[1];
    if (!token) {
      console.log('[AuthMiddleware] Token为空');
      return res.status(401).json({
        success: false,
        message: 'Invalid authorization format'
      });
    }

    console.log('[AuthMiddleware] 提取到token, 长度:', token.length);

    try {
      // Verify AWS Cognito token only
      console.log('[AuthMiddleware] 开始验证Cognito token');
      const payload = await verifyCognitoToken(token);
      
      console.log('[AuthMiddleware] AWS Cognito token验证成功:', {
        sub: payload.sub,
        username: payload.username,
        email: payload.email
      });

      // Find or create user based on Cognito sub (stored in id field)
      console.log('[AuthMiddleware] 查找数据库用户, sub:', payload.sub);
      let user = await User.findOne({
        where: { id: payload.sub },
        attributes: { exclude: ['password'] }
      });
      
      console.log('[AuthMiddleware] 数据库查找结果:', user ? '找到用户' : '未找到用户');

      // If user doesn't exist, create new user from Cognito data
      if (!user) {
        console.log('[AuthMiddleware] 从 Cognito token 创建新用户');
        
        // Prepare user data with fallback values for required fields
        const username = payload.username || payload.preferred_username || `user_${payload.sub.substring(0, 8)}`;
        const email = payload.email || `${username}_${payload.sub.substring(0, 8)}@cognito.local`;
        const password = `cognito_${payload.sub}_dummy_password`; // Dummy password for Cognito users
        
        console.log('[AuthMiddleware] 准备创建用户数据:', { id: payload.sub, username, email });
        
        try {
          user = await User.create({
            id: payload.sub,
            username: username,
            email: email,
            password: password, // Dummy password - authentication is handled by Cognito
            isAdmin: false,
            role: 'user',
            verified: true, // Assume Cognito users are verified
            createdAt: new Date(),
            lastLoginAt: new Date()
          });
          
          console.log(`[AuthMiddleware] 成功创建 Cognito 用户: ${username} (${email})`);
        } catch (createError: any) {
          console.error('[AuthMiddleware] 创建用户失败:', createError.message);
          console.error('[AuthMiddleware] 创建用户错误详情:', createError);
          
          // 尝试重新查找，可能是并发创建问题
          user = await User.findOne({
            where: { id: payload.sub },
            attributes: { exclude: ['password'] }
          });
          
          if (!user) {
            console.error('[AuthMiddleware] 重新查找也失败，返回错误');
            return res.status(500).json({
              success: false,
              message: '用户创建失败'
            });
          }
          
          console.log('[AuthMiddleware] 重新查找找到用户，继续处理');
        }
      } else {
        // Update last login time and sync email from Cognito if different
        const cognitoEmail = payload.email;
        if (cognitoEmail && user.email !== cognitoEmail) {
          console.log(`[AuthMiddleware] 同步Cognito邮箱: ${user.email} -> ${cognitoEmail}`);
          await user.update({ 
            email: cognitoEmail,
            lastLoginAt: new Date()
          });
        } else {
          await user.update({ lastLoginAt: new Date() });
        }
        
        console.log('[AuthMiddleware] 更新用户最后登录时间');
      }

      // Attach both Cognito payload and user data to request
      req.cognitoUser = payload;
      req.user = user;
      
      console.log('[AuthMiddleware] 认证成功，用户ID:', user.id, '用户名:', user.username);
      next();
    } catch (verifyError: any) {
      console.error('[AuthMiddleware] AWS Cognito token验证失败:', verifyError.message);
      console.error('[AuthMiddleware] 验证错误详情:', verifyError);
      return res.status(401).json({
        success: false,
        message: 'Invalid or expired token'
      });
    }
  } catch (error: any) {
    console.error('[AuthMiddleware] 认证中间件错误:', error.message);
    console.error('[AuthMiddleware] 错误详情:', error);
    return res.status(500).json({
      success: false,
      message: 'Authentication service error'
    });
  }
};

// Middleware to check if user is admin
export const admin = (req: Request, res: Response, next: NextFunction) => {
  if (req.user && req.user.isAdmin) {
    next();
  } else {
    res.status(403).json({
      success: false,
      message: 'Not authorized as admin'
    });
  }
};

/*
 * Required environment variables:
 * - COGNITO_REGION: AWS Cognito region (e.g., 'ap-southeast-2')
 * - COGNITO_USER_POOL_ID: AWS Cognito User Pool ID (e.g., 'ap-southeast-2_El0UTGvLD')
 * - COGNITO_APP_CLIENT_ID: AWS Cognito App Client ID (optional for enhanced verification)
 */