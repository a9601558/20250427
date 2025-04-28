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
        if (!username || !password) {
            return res.status(400).json({
                success: false,
                message: '用户名/邮箱和密码不能为空'
            });
        }
        // 避免使用Op.or，使用两次查询代替
        let user = await User_1.default.findOne({
            where: { username: username }
        });
        // 如果按用户名找不到，再按邮箱查找
        if (!user) {
            user = await User_1.default.findOne({
                where: { email: username }
            });
        }
        // Check if user exists and password matches
        if (user && (await user.comparePassword(password))) {
            res.json({
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
            res.status(401).json({
                success: false,
                message: '用户名/邮箱或密码错误'
            });
        }
    }
    catch (error) {
        console.error('Login error:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Server error'
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
