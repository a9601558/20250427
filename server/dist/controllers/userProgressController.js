"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateUserProgress = exports.getUserProgress = void 0;
const User_1 = __importDefault(require("../models/User"));
const socket_1 = require("../config/socket");
/**
 * @desc    获取用户进度
 * @route   GET /api/user-progress/:questionSetId
 * @access  Private
 */
const getUserProgress = async (req, res) => {
    try {
        const userId = req.user.id;
        const questionSetId = req.params.questionSetId;
        const user = await User_1.default.findByPk(userId);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: '用户不存在'
            });
        }
        const progress = user.progress[questionSetId] || null;
        res.json({
            success: true,
            data: progress
        });
    }
    catch (error) {
        console.error('获取用户进度失败:', error);
        res.status(500).json({
            success: false,
            message: error.message || '服务器错误'
        });
    }
};
exports.getUserProgress = getUserProgress;
/**
 * @desc    更新用户进度
 * @route   PUT /api/user-progress/:questionSetId
 * @access  Private
 */
const updateUserProgress = async (req, res) => {
    try {
        const userId = req.user.id;
        // 可以从URL参数或请求体中获取题库ID
        const questionSetId = req.params.questionSetId || req.body.questionSetId;
        if (!questionSetId) {
            return res.status(400).json({
                success: false,
                message: '题库ID不能为空'
            });
        }
        const { completedQuestions, totalQuestions, correctAnswers } = req.body;
        const user = await User_1.default.findByPk(userId);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: '用户不存在'
            });
        }
        // 更新或创建进度记录
        if (!user.progress) {
            user.progress = {};
        }
        const updatedProgress = {
            completedQuestions,
            totalQuestions,
            correctAnswers,
            lastAccessed: new Date()
        };
        user.progress[questionSetId] = updatedProgress;
        await user.save();
        // 通过Socket.IO通知用户更新进度
        const io = req.app.get('io');
        (0, socket_1.emitToUser)(io, userId, 'progress_updated', {
            questionSetId,
            progress: updatedProgress
        });
        res.json({
            success: true,
            message: '进度更新成功',
            data: updatedProgress
        });
    }
    catch (error) {
        console.error('更新用户进度失败:', error);
        res.status(500).json({
            success: false,
            message: error.message || '服务器错误'
        });
    }
};
exports.updateUserProgress = updateUserProgress;
