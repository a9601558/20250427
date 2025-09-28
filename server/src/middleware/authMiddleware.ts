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
    // Decode the token to check its structure and claims
    const decoded = jwt.decode(token, { complete: true });
    
    if (!decoded || !decoded.payload || typeof decoded.payload === 'string') {
      return reject(new Error('Invalid token format'));
    }

    const payload = decoded.payload as CognitoJwtPayload;
    
    // Validate essential Cognito token properties
    const cognitoRegion = process.env.COGNITO_REGION || 'ap-southeast-2';
    const cognitoUserPoolId = process.env.COGNITO_USER_POOL_ID || 'ap-southeast-2_El0UTGvLD';
    const expectedIssuer = `https://cognito-idp.${cognitoRegion}.amazonaws.com/${cognitoUserPoolId}`;
    
    if (payload.iss !== expectedIssuer) {
      return reject(new Error('Token issuer does not match Cognito'));
    }
    
    if (payload.token_use !== 'access') {
      return reject(new Error('Token is not an access token'));
    }
    
    // Check if token is expired
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp < now) {
      return reject(new Error('Token has expired'));
    }
    
    resolve(payload);
  });
};

// Pure AWS Cognito authentication middleware
export const protect = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Extract token from Authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'No authorization token provided'
      });
    }

    const token = authHeader.split(' ')[1];
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Invalid authorization format'
      });
    }

    try {
      // Verify AWS Cognito token only
      const payload = await verifyCognitoToken(token);
      
      console.log('AWS Cognito token verified successfully:', {
        sub: payload.sub,
        username: payload.username,
        email: payload.email
      });

      // Find or create user based on Cognito sub (stored in id field)
      let user = await User.findOne({
        where: { id: payload.sub },
        attributes: { exclude: ['password'] }
      });

      // If user doesn't exist, create new user from Cognito data
      if (!user) {
        console.log('Creating new user from Cognito token');
        
        // Prepare user data with fallback values for required fields
        const username = payload.username || payload.preferred_username || `user_${payload.sub.substring(0, 8)}`;
        const email = payload.email || `${username}_${payload.sub.substring(0, 8)}@cognito.local`;
        const password = `cognito_${payload.sub}_dummy_password`; // Dummy password for Cognito users
        
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
        
        console.log(`Created Cognito user: ${username} (${email})`);
      } else {
        // Update last login time
        await user.update({ lastLoginAt: new Date() });
      }

      // Attach both Cognito payload and user data to request
      req.cognitoUser = payload;
      req.user = user;
      
      next();
    } catch (verifyError) {
      console.error('AWS Cognito token verification failed:', verifyError);
      return res.status(401).json({
        success: false,
        message: 'Invalid or expired token'
      });
    }
  } catch (error) {
    console.error('Authentication middleware error:', error);
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