"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateToken = exports.admin = exports.protect = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const User_1 = __importDefault(require("../models/User"));
const axios_1 = __importDefault(require("axios"));
// Function to verify AWS Cognito JWT token
const verifyCognitoToken = async (token) => {
    try {
        // Decode JWT header to get key ID
        const decodedHeader = jsonwebtoken_1.default.decode(token, { complete: true });
        if (!decodedHeader || !decodedHeader.header.kid) {
            throw new Error('Invalid token header');
        }
        // AWS Cognito JWT keys URL (adjust region and user pool ID as needed)
        const cognitoRegion = process.env.COGNITO_REGION || 'ap-southeast-2';
        const cognitoUserPoolId = process.env.COGNITO_USER_POOL_ID || 'ap-southeast-2_El0UTGvLD';
        const jwksUrl = `https://cognito-idp.${cognitoRegion}.amazonaws.com/${cognitoUserPoolId}/.well-known/jwks.json`;
        // Get public keys from Cognito
        const response = await axios_1.default.get(jwksUrl);
        const keys = response.data.keys;
        // Find the key that matches the token's kid
        const key = keys.find((k) => k.kid === decodedHeader.header.kid);
        if (!key) {
            throw new Error('Public key not found');
        }
        // Convert JWK to PEM format
        const jwkToPem = (jwk) => {
            const modulus = Buffer.from(jwk.n, 'base64');
            const exponent = Buffer.from(jwk.e, 'base64');
            const modulusHex = modulus.toString('hex');
            const exponentHex = exponent.toString('hex');
            const modLen = modulus.length;
            const expLen = exponent.length;
            const asnHeader = '30820122300d06092a864886f70d01010105000382010f003082010a0282010100';
            const publicKeyDer = asnHeader + modulusHex + '0203' + exponentHex;
            const publicKeyPem = '-----BEGIN PUBLIC KEY-----\n' +
                Buffer.from(publicKeyDer, 'hex').toString('base64').match(/.{1,64}/g)?.join('\n') +
                '\n-----END PUBLIC KEY-----';
            return publicKeyPem;
        };
        let publicKey;
        if (key.kty === 'RSA') {
            publicKey = jwkToPem(key);
        }
        else {
            throw new Error('Unsupported key type');
        }
        // Verify the token with the public key
        const decoded = jsonwebtoken_1.default.verify(token, publicKey, { algorithms: ['RS256'] });
        return decoded;
    }
    catch (error) {
        throw error;
    }
};
// Middleware to protect routes
const protect = async (req, res, next) => {
    let token;
    // Check for token in Authorization header
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        try {
            // Get token from header
            token = req.headers.authorization.split(' ')[1];
            let decoded;
            let userId;
            try {
                // First try AWS Cognito verification
                decoded = await verifyCognitoToken(token);
                userId = decoded.sub; // AWS Cognito uses 'sub' for user ID
                console.log('AWS Cognito token verified successfully');
            }
            catch (cognitoError) {
                try {
                    // Fall back to traditional JWT verification
                    decoded = jsonwebtoken_1.default.verify(token, process.env.JWT_SECRET || '');
                    userId = decoded.id; // Traditional JWT uses 'id'
                    console.log('Traditional JWT token verified successfully');
                }
                catch (jwtError) {
                    console.error('Both token verification methods failed:', { cognitoError, jwtError });
                    throw new Error('Token verification failed');
                }
            }
            // Get or create user from token
            let user = await User_1.default.findOne({
                where: { id: userId },
                attributes: { exclude: ['password'] }
            });
            // If user doesn't exist and this is a Cognito token, create the user
            if (!user && decoded.sub) {
                console.log('Creating new user from Cognito token');
                user = await User_1.default.create({
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
        }
        catch (error) {
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
exports.protect = protect;
// Middleware to check if user is admin
const admin = (req, res, next) => {
    if (req.user && req.user.isAdmin) {
        next();
    }
    else {
        res.status(403).json({
            success: false,
            message: 'Not authorized as admin'
        });
    }
};
exports.admin = admin;
// Generate JWT token (for traditional authentication)
const generateToken = (id) => {
    const secret = process.env.JWT_SECRET || '';
    const expiresIn = process.env.JWT_EXPIRES_IN || '30d';
    // @ts-ignore - JWT sign type issues
    return jsonwebtoken_1.default.sign({ id }, secret, { expiresIn });
};
exports.generateToken = generateToken;
/*
 * Environment variables needed:
 * - COGNITO_REGION: AWS Cognito region (e.g., 'ap-southeast-2')
 * - COGNITO_USER_POOL_ID: AWS Cognito User Pool ID (e.g., 'ap-southeast-2_El0UTGvLD')
 * - JWT_SECRET: Secret for traditional JWT tokens
 */ 
