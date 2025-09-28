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
}

// Function to verify AWS Cognito JWT token (simplified for development)
const verifyCognitoToken = async (token: string): Promise<any> => {
  try {
    // 简化版本：只解码token而不验证签名（用于开发测试）
    // 生产环境中应该进行完整的签名验证
    const decoded = jwt.decode(token);
    
    if (!decoded || typeof decoded === 'string') {
      throw new Error('Invalid token format');
    }
    
    // 检查token是否来自Cognito（通过iss字段）
    const cognitoRegion = process.env.COGNITO_REGION || 'ap-southeast-2';
    const cognitoUserPoolId = process.env.COGNITO_USER_POOL_ID || 'ap-southeast-2_El0UTGvLD';
    const expectedIssuer = `https://cognito-idp.${cognitoRegion}.amazonaws.com/${cognitoUserPoolId}`;
    
    if (decoded.iss !== expectedIssuer) {
      throw new Error('Token issuer does not match Cognito');
    }
    
    // 检查token是否过期
    const now = Math.floor(Date.now() / 1000);
    if (decoded.exp && decoded.exp < now) {
      throw new Error('Token has expired');
    }
    
    return decoded;
  } catch (error) {
    throw error;
  }
};

// Middleware to protect routes
export const protect = async (req: Request, res: Response, next: NextFunction) => {
  let token;

  // Check for token in Authorization header
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    try {
      // Get token from header
      token = req.headers.authorization.split(' ')[1];

      let decoded: any;
      let userId: string;
      
      try {
        // First try AWS Cognito verification
        decoded = await verifyCognitoToken(token);
        userId = decoded.sub; // AWS Cognito uses 'sub' for user ID
        console.log('AWS Cognito token verified successfully');
      } catch (cognitoError) {
        try {
          // Fall back to traditional JWT verification with explicit algorithm
          const jwtSecret = process.env.JWT_SECRET || 'default-dev-secret-key-change-in-production';
          
          // Explicitly specify HS256 algorithm for traditional JWT
          decoded = jwt.verify(token, jwtSecret, { algorithms: ['HS256'] }) as JwtPayload;
          userId = decoded.id; // Traditional JWT uses 'id'
          console.log('Traditional JWT token verified successfully');
        } catch (jwtError) {
          console.error('Both token verification methods failed:', { 
            cognitoError: cognitoError instanceof Error ? cognitoError.message : cognitoError, 
            jwtError: jwtError instanceof Error ? jwtError.message : jwtError 
          });
          throw new Error('Token verification failed');
        }
      }

      // Get or create user from token
      let user = await User.findOne({
        where: { id: userId },
        attributes: { exclude: ['password'] }
      });

      // If user doesn't exist and this is a Cognito token, create the user
      if (!user && decoded.sub) {
        console.log('Creating new user from Cognito token');
        user = await User.create({
          id: decoded.sub,
          username: decoded.preferred_username || decoded.email || `user_${decoded.sub.substring(0, 8)}`,
          email: decoded.email || '',
          password: '', // AWS Cognito用户无需密码存储
          isAdmin: false,
          createdAt: new Date(),
          lastLoginAt: new Date()
        });
      }

      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'User not found, token invalid'
        });
      }

      req.user = user;
      return next();
    } catch (error) {
      console.error('Authentication error:', error);
      return res.status(401).json({
        success: false,
        message: 'Not authorized, token failed'
      });
    }
  }

  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Not authorized, no token'
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

// Generate JWT token (for traditional authentication)
export const generateToken = (id: string): string => {
  const secret = process.env.JWT_SECRET || 'default-dev-secret-key-change-in-production';
  const expiresIn = process.env.JWT_EXPIRES_IN || '30d';
  
  // Use type assertion to bypass TypeScript strict checking
  return jwt.sign({ id }, secret, { expiresIn, algorithm: 'HS256' } as any);
};

/*
 * Environment variables needed:
 * - COGNITO_REGION: AWS Cognito region (e.g., 'ap-southeast-2')
 * - COGNITO_USER_POOL_ID: AWS Cognito User Pool ID (e.g., 'ap-southeast-2_El0UTGvLD')
 * - JWT_SECRET: Secret for traditional JWT tokens
 */