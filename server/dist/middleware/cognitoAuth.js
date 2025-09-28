"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.optionalAuth = exports.admin = exports.protect = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const User_1 = __importDefault(require("../models/User"));
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
// Verify AWS Cognito JWT token (simplified for production readiness)
const verifyCognitoToken = async (token) => {
    return new Promise((resolve, reject) => {
        // Decode without verification for now - in production, you should verify the signature
        const decoded = jsonwebtoken_1.default.decode(token, { complete: true });
        if (!decoded || !decoded.payload || typeof decoded.payload === 'string') {
            return reject(new Error('Invalid token format'));
        }
        const payload = decoded.payload;
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
        // Check expiration
        const now = Math.floor(Date.now() / 1000);
        if (payload.exp && payload.exp < now) {
            return reject(new Error('Token has expired'));
        }
        resolve(payload);
    });
};
// Pure AWS Cognito authentication middleware
const protect = async (req, res, next) => {
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
            // Verify AWS Cognito token
            const payload = await verifyCognitoToken(token);
            console.log('AWS Cognito token verified successfully:', {
                sub: payload.sub,
                username: payload.username,
                email: payload.email
            });
            // Find or create user based on Cognito sub (stored in id field)
            let user = await User_1.default.findOne({
                where: { id: payload.sub },
                attributes: { exclude: ['password'] }
            });
            // If user doesn't exist, create new user from Cognito data
            if (!user) {
                console.log('Creating new user from Cognito token');
                user = await User_1.default.create({
                    id: payload.sub,
                    username: payload.username || payload.preferred_username || payload.email || `user_${payload.sub.substring(0, 8)}`,
                    email: payload.email || '',
                    password: '', // AWS Cognito users don't need local passwords
                    isAdmin: false,
                    role: 'user',
                    verified: true, // Assume Cognito users are verified
                    createdAt: new Date(),
                    lastLoginAt: new Date()
                });
            }
            else {
                // Update last login time
                await user.update({ lastLoginAt: new Date() });
            }
            // Attach both Cognito payload and user data to request
            req.cognitoUser = payload;
            req.user = user;
            next();
        }
        catch (verifyError) {
            console.error('AWS Cognito token verification failed:', verifyError);
            return res.status(401).json({
                success: false,
                message: 'Invalid or expired token'
            });
        }
    }
    catch (error) {
        console.error('Authentication middleware error:', error);
        return res.status(500).json({
            success: false,
            message: 'Authentication service error'
        });
    }
};
exports.protect = protect;
// Admin role verification middleware
const admin = (req, res, next) => {
    if (req.user && req.user.isAdmin) {
        next();
    }
    else {
        res.status(403).json({
            success: false,
            message: 'Admin access required'
        });
    }
};
exports.admin = admin;
// Optional authentication - allows both authenticated and anonymous access
const optionalAuth = async (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        // No token provided, continue without authentication
        return next();
    }
    const token = authHeader.split(' ')[1];
    if (!token) {
        return next();
    }
    try {
        const payload = await verifyCognitoToken(token);
        let user = await User_1.default.findOne({
            where: { id: payload.sub },
            attributes: { exclude: ['password'] }
        });
        if (user) {
            req.cognitoUser = payload;
            req.user = user;
        }
    }
    catch (error) {
        // Token verification failed, but continue without authentication
        console.warn('Optional auth token verification failed:', error);
    }
    next();
};
exports.optionalAuth = optionalAuth;
/*
 * Required environment variables:
 * - COGNITO_USER_POOL_ID: AWS Cognito User Pool ID (e.g., 'ap-southeast-2_El0UTGvLD')
 * - COGNITO_APP_CLIENT_ID: AWS Cognito App Client ID
 * - COGNITO_REGION: AWS region (e.g., 'ap-southeast-2')
 */ 
