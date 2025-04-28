"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteUser = exports.updateUser = exports.getUserById = exports.getUsers = exports.updateUserProfile = exports.getUserProfile = exports.loginUser = exports.registerUser = void 0;
const User_1 = __importDefault(require("../models/User"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const bcrypt_1 = __importDefault(require("bcrypt"));
// 生成JWT令牌函数
const generateToken = (id) => {
    return jsonwebtoken_1.default.sign({ id }, process.env.JWT_SECRET || 'default_secret', {
        expiresIn: '30d',
    });
};
// 统一响应格式
const sendResponse = (res, status, data, message) => {
    res.status(status).json({
        success: status >= 200 && status < 300,
        data,
        message
    });
};
// 统一错误响应
const sendError = (res, status, message, error) => {
    res.status(status).json({
        success: false,
        message,
        error: process.env.NODE_ENV === 'development' ? error?.message : undefined
    });
};
// @desc    Register a new user
// @route   POST /api/v1/users/register
// @access  Public
const registerUser = async (req, res) => {
    try {
        const { username, email, password } = req.body;
        // 验证必填字段
        if (!username || !email || !password) {
            return sendError(res, 400, '请提供用户名、邮箱和密码');
        }
        // 验证密码长度
        if (password.length < 6) {
            return sendError(res, 400, '密码长度至少为6个字符');
        }
        // 检查用户是否已存在
        const existingUser = await User_1.default.findOne({
            where: { email }
        });
        if (existingUser) {
            return sendError(res, 400, '该邮箱已被注册');
        }
        // 创建新用户 - 不需要在此处加密密码，密码会在User模型的beforeSave钩子中自动加密
        const user = await User_1.default.create({
            username,
            email,
            password, // 直接使用明文密码，让模型的钩子去处理加密
            isAdmin: false,
            progress: {},
            purchases: [],
            redeemCodes: []
        });
        // 生成 JWT token
        const token = generateToken(user.id);
        // 返回用户信息（不包含密码）
        const userResponse = {
            id: user.id,
            username: user.username,
            email: user.email,
            isAdmin: user.isAdmin,
            createdAt: user.createdAt,
            updatedAt: user.updatedAt
        };
        sendResponse(res, 201, {
            user: userResponse,
            token
        }, '注册成功');
    }
    catch (error) {
        console.error('注册用户时出错:', error);
        sendError(res, 500, '服务器错误，请稍后重试', error);
    }
};
exports.registerUser = registerUser;
// @desc    Login user & get token
// @route   POST /api/v1/users/login
// @access  Public
const loginUser = async (req, res) => {
    try {
        const { username, password } = req.body;
        // 检查输入是否为空
        if (!username || !password) {
            return sendError(res, 400, '用户名/邮箱和密码不能为空');
        }
        // 先尝试按用户名查找
        let user = await User_1.default.findOne({
            where: { username: username }
        });
        // 如果按用户名找不到，再按邮箱查找
        if (!user) {
            user = await User_1.default.findOne({
                where: { email: username }
            });
        }
        // 如果用户不存在，返回错误
        if (!user) {
            return sendError(res, 401, '用户名/邮箱或密码错误');
        }
        // 检查密码是否存在
        if (!user.password) {
            console.error('用户密码字段为空:', username);
            return sendError(res, 500, '账户数据异常，请联系管理员或重置密码');
        }
        // 比较密码
        try {
            const isPasswordMatch = await user.comparePassword(password);
            if (isPasswordMatch) {
                // 密码正确，返回用户信息和令牌
                const userResponse = {
                    id: user.id,
                    username: user.username,
                    email: user.email,
                    isAdmin: user.isAdmin,
                    createdAt: user.createdAt,
                    updatedAt: user.updatedAt
                };
                sendResponse(res, 200, {
                    user: userResponse,
                    token: generateToken(user.id)
                }, '登录成功');
            }
            else {
                // 密码不匹配
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
// @desc    Get user profile
// @route   GET /api/v1/users/profile
// @access  Private
const getUserProfile = async (req, res) => {
    try {
        const user = await User_1.default.findByPk(req.user.id, {
            attributes: { exclude: ['password'] }
        });
        if (user) {
            sendResponse(res, 200, user);
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
// @desc    Update user profile
// @route   PUT /api/v1/users/profile
// @access  Private
const updateUserProfile = async (req, res) => {
    try {
        const user = await User_1.default.findByPk(req.user.id);
        if (user) {
            user.username = req.body.username || user.username;
            user.email = req.body.email || user.email;
            if (req.body.password) {
                const salt = await bcrypt_1.default.genSalt(10);
                user.password = await bcrypt_1.default.hash(req.body.password, salt);
            }
            const updatedUser = await user.save();
            const userResponse = {
                id: updatedUser.id,
                username: updatedUser.username,
                email: updatedUser.email,
                isAdmin: updatedUser.isAdmin,
                createdAt: updatedUser.createdAt,
                updatedAt: updatedUser.updatedAt
            };
            sendResponse(res, 200, {
                user: userResponse,
                token: generateToken(updatedUser.id)
            }, '用户信息更新成功');
        }
        else {
            sendError(res, 404, '用户不存在');
        }
    }
    catch (error) {
        console.error('Update profile error:', error);
        sendError(res, 500, '更新用户信息失败', error);
    }
};
exports.updateUserProfile = updateUserProfile;
// @desc    Get all users
// @route   GET /api/v1/users
// @access  Private/Admin
const getUsers = async (req, res) => {
    try {
        const users = await User_1.default.findAll({
            attributes: { exclude: ['password'] }
        });
        sendResponse(res, 200, users);
    }
    catch (error) {
        console.error('Get users error:', error);
        sendError(res, 500, '获取用户列表失败', error);
    }
};
exports.getUsers = getUsers;
// @desc    Get user by ID
// @route   GET /api/v1/users/:id
// @access  Private/Admin
const getUserById = async (req, res) => {
    try {
        const user = await User_1.default.findByPk(req.params.id, {
            attributes: { exclude: ['password'] }
        });
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
// @desc    Update user
// @route   PUT /api/v1/users/:id
// @access  Private/Admin
const updateUser = async (req, res) => {
    try {
        const user = await User_1.default.findByPk(req.params.id);
        if (user) {
            user.username = req.body.username || user.username;
            user.email = req.body.email || user.email;
            user.isAdmin = req.body.isAdmin !== undefined ? req.body.isAdmin : user.isAdmin;
            const updatedUser = await user.save();
            const userResponse = {
                id: updatedUser.id,
                username: updatedUser.username,
                email: updatedUser.email,
                isAdmin: updatedUser.isAdmin,
                createdAt: updatedUser.createdAt,
                updatedAt: updatedUser.updatedAt
            };
            sendResponse(res, 200, userResponse, '用户信息更新成功');
        }
        else {
            sendError(res, 404, '用户不存在');
        }
    }
    catch (error) {
        console.error('Update user error:', error);
        sendError(res, 500, '更新用户信息失败', error);
    }
};
exports.updateUser = updateUser;
// @desc    Delete user
// @route   DELETE /api/v1/users/:id
// @access  Private/Admin
const deleteUser = async (req, res) => {
    try {
        const user = await User_1.default.findByPk(req.params.id);
        if (user) {
            await user.destroy();
            sendResponse(res, 200, null, '用户删除成功');
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
