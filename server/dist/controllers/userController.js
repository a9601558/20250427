"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateUser = exports.getUserById = exports.deleteUser = exports.getUsers = exports.updateUserProfile = exports.getUserProfile = exports.loginUser = exports.registerUser = void 0;
const User_1 = __importDefault(require("../models/User"));
const authMiddleware_1 = require("../middleware/authMiddleware");
const sequelize_1 = require("sequelize");
// @desc    Register a new user
// @route   POST /api/users
// @access  Public
const registerUser = async (req, res) => {
    try {
        const { username, email, password } = req.body;
        // Check if user exists
        const userExists = await User_1.default.findOne({
            where: {
                [sequelize_1.Op.or]: [{ email }, { username }]
            }
        });
        if (userExists) {
            return res.status(400).json({
                success: false,
                message: 'User already exists'
            });
        }
        // Create user
        const user = await User_1.default.create({
            username,
            email,
            password,
            isAdmin: false,
            progress: {},
            purchases: [],
            redeemCodes: []
        });
        if (user) {
            res.status(201).json({
                success: true,
                data: {
                    id: user.id,
                    username: user.username,
                    email: user.email,
                    isAdmin: user.isAdmin,
                    token: (0, authMiddleware_1.generateToken)(user.id)
                }
            });
        }
        else {
            res.status(400).json({
                success: false,
                message: 'Invalid user data'
            });
        }
    }
    catch (error) {
        console.error('Register error:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Server error'
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
        // 使用 Op.or 同时查询用户名和邮箱，更加健壮
        const user = await User_1.default.findOne({
            where: {
                [sequelize_1.Op.or]: [
                    { username: username },
                    { email: username }
                ]
            }
        });
        // Check if user exists and password matches
        if (user && (await user.comparePassword(password))) {
            res.json({
                success: true,
                data: {
                    id: user.id,
                    username: user.username,
                    email: user.email,
                    isAdmin: user.isAdmin,
                    token: (0, authMiddleware_1.generateToken)(user.id)
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
                    token: (0, authMiddleware_1.generateToken)(updatedUser.id)
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
