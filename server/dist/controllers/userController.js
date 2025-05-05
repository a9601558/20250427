"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteUser = exports.updateUser = exports.getUserById = exports.getUsers = exports.updateUserProfile = exports.getUserProfile = exports.loginUser = exports.registerUser = void 0;
const User_1 = __importDefault(require("../models/User"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const sequelize_1 = require("sequelize");
// Generate JWT token
const generateToken = (id, isAdmin) => {
    return jsonwebtoken_1.default.sign({ id, isAdmin }, process.env.JWT_SECRET || 'default_secret', { expiresIn: '30d' });
};
// Unified response format
const sendResponse = (res, status, data, message) => {
    res.status(status).json({
        success: status >= 200 && status < 300,
        data,
        message
    });
};
// Unified error response
const sendError = (res, status, message, error) => {
    console.error(`Error (${status}): ${message}`, error);
    res.status(status).json({
        success: false,
        message,
        error: process.env.NODE_ENV === 'development' ? error?.message || error : undefined
    });
};
/**
 * @desc    Register a new user
 * @route   POST /api/v1/users/register
 * @access  Public
 */
const registerUser = async (req, res) => {
    try {
        const { username, email, password } = req.body;
        // Validate required fields
        if (!username || !email || !password) {
            return sendError(res, 400, '请提供用户名、邮箱和密码');
        }
        // Validate password length
        if (password.length < 6) {
            return sendError(res, 400, '密码长度至少为6个字符');
        }
        // Check if user already exists
        const existingUser = await User_1.default.findOne({
            where: {
                [sequelize_1.Op.or]: [
                    { email },
                    { username }
                ]
            }
        });
        if (existingUser) {
            if (existingUser.email === email) {
                return sendError(res, 400, '该邮箱已被注册');
            }
            else {
                return sendError(res, 400, '该用户名已被使用');
            }
        }
        // Create new user - password will be hashed in the User model hooks
        const userData = {
            username,
            email,
            password,
            purchases: [],
            redeemCodes: [],
            progress: {},
            socket_id: null,
            isAdmin: false
        };
        const user = await User_1.default.create(userData);
        // Generate JWT token
        const token = generateToken(user.id, user.isAdmin);
        // Return user info (without password)
        const userResponse = {
            id: user.id,
            username: user.username,
            email: user.email,
            createdAt: user.createdAt,
            updatedAt: user.updatedAt,
            isAdmin: user.isAdmin
        };
        sendResponse(res, 201, {
            user: userResponse,
            token
        }, '注册成功');
    }
    catch (error) {
        console.error('用户注册错误:', error);
        if (error instanceof sequelize_1.ValidationError) {
            // Handle validation errors
            return sendError(res, 400, error.message || '输入数据验证失败', error);
        }
        else if (error instanceof sequelize_1.UniqueConstraintError) {
            // Handle unique constraint violations
            return sendError(res, 400, '用户名或邮箱已被使用', error);
        }
        sendError(res, 500, '服务器错误，请稍后重试', error);
    }
};
exports.registerUser = registerUser;
/**
 * @desc    Login user & get token
 * @route   POST /api/v1/users/login
 * @access  Public
 */
const loginUser = async (req, res) => {
    try {
        const { username, password } = req.body;
        // Check if input is empty
        if (!username || !password) {
            return sendError(res, 400, '用户名/邮箱和密码不能为空');
        }
        // First try to find by username
        let user = await User_1.default.scope('withPassword').findOne({
            where: { username: username }
        });
        // If not found by username, try by email
        if (!user) {
            user = await User_1.default.scope('withPassword').findOne({
                where: { email: username }
            });
        }
        // If user doesn't exist, return error
        if (!user) {
            return sendError(res, 401, '用户名/邮箱或密码错误');
        }
        // Check for account lock
        if (user.accountLocked) {
            const now = new Date();
            const lockUntil = user.lockUntil ? new Date(user.lockUntil) : null;
            // If lock period has expired, unlock the account
            if (lockUntil && now > lockUntil) {
                user.accountLocked = false;
                user.lockUntil = undefined;
                await user.save();
            }
            else {
                return sendError(res, 401, '账户已锁定，请稍后再试或重置密码', {
                    lockUntil: lockUntil
                });
            }
        }
        // Check if password field exists
        if (!user.password) {
            console.error('用户密码字段为空:', username);
            console.error('用户对象:', JSON.stringify(user, null, 2));
            return sendError(res, 500, '账户数据异常，请联系管理员或重置密码');
        }
        // Compare password
        try {
            const isPasswordMatch = await user.comparePassword(password);
            if (isPasswordMatch) {
                // Password correct, reset failed attempts and update last login
                await user.resetFailedLoginAttempts();
                // Return user info and token
                const userResponse = {
                    id: user.id,
                    username: user.username,
                    email: user.email,
                    createdAt: user.createdAt,
                    updatedAt: user.updatedAt,
                    isAdmin: user.isAdmin
                };
                sendResponse(res, 200, {
                    user: userResponse,
                    token: generateToken(user.id, user.isAdmin)
                }, '登录成功');
            }
            else {
                // Password doesn't match, record failed attempt
                await user.recordFailedLoginAttempt();
                // Return error
                sendError(res, 401, '用户名/邮箱或密码错误');
            }
        }
        catch (passwordError) {
            console.error('密码比较过程出错:', passwordError);
            sendError(res, 500, '登录时发生错误，请稍后再试', passwordError);
        }
    }
    catch (error) {
        console.error('Login error:', error);
        sendError(res, 500, '登录失败，请稍后再试', error);
    }
};
exports.loginUser = loginUser;
/**
 * @desc    Get user profile
 * @route   GET /api/v1/users/profile
 * @access  Private
 */
const getUserProfile = async (req, res) => {
    try {
        // Get user with associated data
        const user = await User_1.default.findByPk(req.user.id, {
            attributes: { exclude: ['password'] },
            logging: (sql) => {
                console.log(`[用户资料] 获取用户(${req.user.id})资料, 设备: ${req.headers['user-agent']}`);
            },
        });
        if (user) {
            // Ensure returned data structure is complete
            const userData = user.toJSON();
            // Ensure purchases field is an array
            if (!userData.purchases) {
                userData.purchases = [];
            }
            console.log(`[用户资料] 返回用户数据，购买记录 ${userData.purchases?.length || 0}条`);
            // Return complete user data
            sendResponse(res, 200, userData);
        }
        else {
            sendError(res, 404, '用户不存在');
        }
    }
    catch (error) {
        console.error('Get profile error:', error);
        sendError(res, 500, '获取用户信息失败', error);
    }
};
exports.getUserProfile = getUserProfile;
/**
 * @desc    Update user profile
 * @route   PUT /api/v1/users/profile
 * @access  Private
 */
const updateUserProfile = async (req, res) => {
    try {
        const user = await User_1.default.findByPk(req.user.id);
        if (user) {
            // Validate email format if provided
            if (req.body.email && !req.body.email.match(/^\S+@\S+\.\S+$/)) {
                return sendError(res, 400, '请提供有效的邮箱地址');
            }
            // Validate username length if provided
            if (req.body.username && (req.body.username.length < 3 || req.body.username.length > 30)) {
                return sendError(res, 400, '用户名长度必须在3-30个字符之间');
            }
            // Update fields if provided
            user.username = req.body.username || user.username;
            user.email = req.body.email || user.email;
            // Only admin can update isAdmin field (this should be protected by admin middleware)
            if (req.user.isAdmin && req.body.isAdmin !== undefined) {
                user.isAdmin = req.body.isAdmin;
            }
            // Update other fields
            if (req.body.preferredLanguage) {
                user.preferredLanguage = req.body.preferredLanguage;
            }
            if (req.body.profilePicture) {
                user.profilePicture = req.body.profilePicture;
            }
            // Handle password update
            if (req.body.password) {
                if (req.body.password.length < 6) {
                    return sendError(res, 400, '密码长度至少为6个字符');
                }
                if (req.body.currentPassword) {
                    // Verify current password before updating
                    const user = await User_1.default.scope('withPassword').findByPk(req.user.id);
                    const isMatch = await user?.comparePassword(req.body.currentPassword);
                    if (!isMatch) {
                        return sendError(res, 400, '当前密码不正确');
                    }
                }
                user.password = req.body.password;
            }
            // Handle examCountdowns update
            if (req.body.examCountdowns !== undefined) {
                user.examCountdowns = req.body.examCountdowns;
            }
            // Save user
            const updatedUser = await user.save();
            // Return updated user data
            const userResponse = updatedUser.toSafeObject();
            sendResponse(res, 200, {
                user: userResponse,
                // Only generate new token if security-relevant fields were changed
                token: (req.body.email || req.body.password || req.body.isAdmin)
                    ? generateToken(updatedUser.id, updatedUser.isAdmin)
                    : undefined
            }, '个人资料已更新');
        }
        else {
            sendError(res, 404, '用户不存在');
        }
    }
    catch (error) {
        console.error('Update profile error:', error);
        if (error instanceof sequelize_1.ValidationError) {
            // Handle validation errors
            return sendError(res, 400, error.message || '输入数据验证失败', error);
        }
        else if (error instanceof sequelize_1.UniqueConstraintError) {
            // Handle unique constraint violations
            return sendError(res, 400, '用户名或邮箱已被使用', error);
        }
        sendError(res, 500, '更新个人资料失败', error);
    }
};
exports.updateUserProfile = updateUserProfile;
/**
 * @desc    Get all users (admin only)
 * @route   GET /api/v1/users
 * @access  Private/Admin
 */
const getUsers = async (req, res) => {
    try {
        const users = await User_1.default.findAll();
        sendResponse(res, 200, users);
    }
    catch (error) {
        console.error('Get users error:', error);
        sendError(res, 500, '获取用户列表失败', error);
    }
};
exports.getUsers = getUsers;
/**
 * @desc    Get user by ID (admin only)
 * @route   GET /api/v1/users/:id
 * @access  Private/Admin
 */
const getUserById = async (req, res) => {
    try {
        const user = await User_1.default.findByPk(req.params.id);
        if (user) {
            sendResponse(res, 200, user);
        }
        else {
            sendError(res, 404, '用户不存在');
        }
    }
    catch (error) {
        console.error('Get user by ID error:', error);
        sendError(res, 500, '获取用户信息失败', error);
    }
};
exports.getUserById = getUserById;
/**
 * @desc    Update user (admin only)
 * @route   PUT /api/v1/users/:id
 * @access  Private/Admin
 */
const updateUser = async (req, res) => {
    try {
        const user = await User_1.default.findByPk(req.params.id);
        if (user) {
            // Validate inputs
            if (req.body.email && !req.body.email.match(/^\S+@\S+\.\S+$/)) {
                return sendError(res, 400, '请提供有效的邮箱地址');
            }
            if (req.body.username && (req.body.username.length < 3 || req.body.username.length > 30)) {
                return sendError(res, 400, '用户名长度必须在3-30个字符之间');
            }
            // Update fields
            user.username = req.body.username || user.username;
            user.email = req.body.email || user.email;
            user.isAdmin = req.body.isAdmin !== undefined ? req.body.isAdmin : user.isAdmin;
            user.verified = req.body.verified !== undefined ? req.body.verified : user.verified;
            // Handle password reset by admin
            if (req.body.password) {
                if (req.body.password.length < 6) {
                    return sendError(res, 400, '密码长度至少为6个字符');
                }
                user.password = req.body.password;
                // Reset account security fields when admin resets password
                user.failedLoginAttempts = 0;
                user.accountLocked = false;
                user.lockUntil = undefined;
            }
            // Save user
            const updatedUser = await user.save();
            sendResponse(res, 200, updatedUser.toSafeObject(), '用户已更新');
        }
        else {
            sendError(res, 404, '用户不存在');
        }
    }
    catch (error) {
        console.error('Update user error:', error);
        if (error instanceof sequelize_1.ValidationError) {
            return sendError(res, 400, error.message || '输入数据验证失败', error);
        }
        else if (error instanceof sequelize_1.UniqueConstraintError) {
            return sendError(res, 400, '用户名或邮箱已被使用', error);
        }
        sendError(res, 500, '更新用户失败', error);
    }
};
exports.updateUser = updateUser;
/**
 * @desc    Delete user (admin only)
 * @route   DELETE /api/v1/users/:id
 * @access  Private/Admin
 */
const deleteUser = async (req, res) => {
    try {
        const user = await User_1.default.findByPk(req.params.id);
        if (user) {
            // Prevent deletion of admin users by mistake
            if (user.isAdmin && !req.body.confirmDeleteAdmin) {
                return sendError(res, 400, '删除管理员账户需要额外确认');
            }
            // Prevent self-deletion
            if (user.id === req.user.id) {
                return sendError(res, 400, '不能删除当前登录的账户');
            }
            await user.destroy();
            sendResponse(res, 200, { id: req.params.id }, '用户已删除');
        }
        else {
            sendError(res, 404, '用户不存在');
        }
    }
    catch (error) {
        console.error('Delete user error:', error);
        sendError(res, 500, '删除用户失败', error);
    }
};
exports.deleteUser = deleteUser;
