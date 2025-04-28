"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateUser = exports.getUserById = exports.deleteUser = exports.getUsers = exports.updateUserProfile = exports.getUserProfile = exports.loginUser = exports.registerUser = void 0;
const User_1 = __importDefault(require("../models/User"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
// 生成JWT令牌函数
const generateToken = (id) => {
    return jsonwebtoken_1.default.sign({ id }, process.env.JWT_SECRET || 'default_secret', {
        expiresIn: '30d',
    });
};
// @desc    Register a new user
// @route   POST /api/users
// @access  Public
const registerUser = async (req, res) => {
    try {
        const { username, email, password } = req.body;
        // 验证必要字段
        if (!username || !email || !password) {
            return res.status(400).json({
                success: false,
                message: '请提供用户名、邮箱和密码'
            });
        }
        // 密码长度验证
        if (password.length < 6) {
            return res.status(400).json({
                success: false,
                message: '密码长度必须至少为6个字符'
            });
        }
        console.log(`开始注册新用户: ${username}, ${email}`);
        // 检查用户名是否已存在
        const userExistsByUsername = await User_1.default.findOne({
            where: { username },
        });
        // 检查邮箱是否已存在
        const userExistsByEmail = await User_1.default.findOne({
            where: { email },
        });
        if (userExistsByUsername) {
            return res.status(400).json({ success: false, message: '用户名已被使用' });
        }
        if (userExistsByEmail) {
            return res.status(400).json({ success: false, message: '邮箱已被注册' });
        }
        console.log(`开始创建用户记录, 原始密码长度: ${password.length}`);
        // 创建新用户
        const user = await User_1.default.create({
            username,
            email,
            password,
            isAdmin: false,
            progress: {},
            purchases: [],
            redeemCodes: []
        });
        console.log(`用户创建完成, 密码长度: ${user.password.length}, 密码前缀: ${user.password.substring(0, 10)}...`);
        // 简单验证密码是否已被加密（加密后应该很长且包含$字符）
        if (!user.password.includes('$') || user.password.length < 20) {
            console.warn(`警告: 用户密码可能未被正确加密! 密码长度:${user.password.length}`);
        }
        // 返回成功响应和用户信息（不包含密码）
        if (user) {
            res.status(201).json({
                success: true,
                message: '注册成功',
                user: {
                    id: user.id,
                    username: user.username,
                    email: user.email,
                    isAdmin: user.isAdmin,
                    token: generateToken(user.id),
                },
            });
        }
        else {
            res.status(500).json({
                success: false,
                message: '用户创建失败，请稍后再试'
            });
        }
    }
    catch (error) {
        console.error('Register error:', error);
        res.status(500).json({
            success: false,
            message: '注册失败',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined,
        });
    }
};
exports.registerUser = registerUser;
// @desc    Login user & get token
// @route   POST /api/users/login
// @access  Public
const loginUser = async (req, res) => {
    try {
        const { username, password } = req.body;
        // 检查输入是否为空
        if (!username || !password) {
            return res.status(400).json({
                success: false,
                message: '用户名/邮箱和密码不能为空'
            });
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
            return res.status(401).json({
                success: false,
                message: '用户名/邮箱或密码错误'
            });
        }
        // 检查密码是否存在
        if (!user.password) {
            console.error('用户密码字段为空:', username);
            // 尝试更新用户密码为默认值以修复数据问题
            if (process.env.NODE_ENV === 'development') {
                try {
                    user.password = 'temporary_password';
                    await user.save();
                    console.log('已为用户创建临时密码，请用户重置密码');
                }
                catch (e) {
                    console.error('无法修复密码字段:', e);
                }
            }
            return res.status(500).json({
                success: false,
                message: '账户数据异常，请联系管理员或重置密码'
            });
        }
        // 比较密码 - 添加额外的错误处理
        try {
            const isPasswordMatch = await user.comparePassword(password);
            if (isPasswordMatch) {
                // 密码正确，返回用户信息和令牌
                return res.json({
                    success: true,
                    data: {
                        id: user.id,
                        username: user.username,
                        email: user.email,
                        isAdmin: user.isAdmin,
                        token: generateToken(user.id)
                    }
                });
            }
            else {
                // 密码不匹配
                return res.status(401).json({
                    success: false,
                    message: '用户名/邮箱或密码错误'
                });
            }
        }
        catch (passwordError) {
            // 密码比较过程出错
            console.error('密码比较过程出错:', passwordError);
            return res.status(500).json({
                success: false,
                message: '登录时发生错误，请稍后再试'
            });
        }
    }
    catch (error) {
        // 捕获所有其他错误
        console.error('Login error:', error);
        res.status(500).json({
            success: false,
            message: '登录失败，请稍后再试',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};
exports.loginUser = loginUser;
// @desc    Get user profile
// @route   GET /api/users/profile
// @access  Private
const getUserProfile = async (req, res) => {
    try {
        const user = await User_1.default.findByPk(req.user.id, {
            attributes: { exclude: ['password'] }
        });
        if (user) {
            res.json({
                success: true,
                data: user
            });
        }
        else {
            res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }
    }
    catch (error) {
        console.error('Get profile error:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Server error'
        });
    }
};
exports.getUserProfile = getUserProfile;
// @desc    Update user profile
// @route   PUT /api/users/profile
// @access  Private
const updateUserProfile = async (req, res) => {
    try {
        const user = await User_1.default.findByPk(req.user.id);
        if (user) {
            user.username = req.body.username || user.username;
            user.email = req.body.email || user.email;
            if (req.body.password) {
                user.password = req.body.password;
            }
            const updatedUser = await user.save();
            res.json({
                success: true,
                data: {
                    id: updatedUser.id,
                    username: updatedUser.username,
                    email: updatedUser.email,
                    isAdmin: updatedUser.isAdmin,
                    token: generateToken(updatedUser.id)
                }
            });
        }
        else {
            res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }
    }
    catch (error) {
        console.error('Update profile error:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Server error'
        });
    }
};
exports.updateUserProfile = updateUserProfile;
// @desc    Get all users
// @route   GET /api/users
// @access  Private/Admin
const getUsers = async (req, res) => {
    try {
        const users = await User_1.default.findAll({
            attributes: { exclude: ['password'] }
        });
        res.json({
            success: true,
            data: users
        });
    }
    catch (error) {
        console.error('Get users error:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Server error'
        });
    }
};
exports.getUsers = getUsers;
// @desc    Delete user
// @route   DELETE /api/users/:id
// @access  Private/Admin
const deleteUser = async (req, res) => {
    try {
        const user = await User_1.default.findByPk(req.params.id);
        if (user) {
            await user.destroy();
            res.json({
                success: true,
                message: 'User removed'
            });
        }
        else {
            res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }
    }
    catch (error) {
        console.error('Delete user error:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Server error'
        });
    }
};
exports.deleteUser = deleteUser;
// @desc    Get user by ID
// @route   GET /api/users/:id
// @access  Private/Admin
const getUserById = async (req, res) => {
    try {
        const user = await User_1.default.findByPk(req.params.id, {
            attributes: { exclude: ['password'] }
        });
        if (user) {
            res.json({
                success: true,
                data: user
            });
        }
        else {
            res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }
    }
    catch (error) {
        console.error('Get user by ID error:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Server error'
        });
    }
};
exports.getUserById = getUserById;
// @desc    Update user
// @route   PUT /api/users/:id
// @access  Private/Admin
const updateUser = async (req, res) => {
    try {
        const user = await User_1.default.findByPk(req.params.id);
        if (user) {
            user.username = req.body.username || user.username;
            user.email = req.body.email || user.email;
            user.isAdmin = req.body.isAdmin !== undefined ? req.body.isAdmin : user.isAdmin;
            const updatedUser = await user.save();
            res.json({
                success: true,
                data: {
                    id: updatedUser.id,
                    username: updatedUser.username,
                    email: updatedUser.email,
                    isAdmin: updatedUser.isAdmin
                }
            });
        }
        else {
            res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }
    }
    catch (error) {
        console.error('Update user error:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Server error'
        });
    }
};
exports.updateUser = updateUser;
