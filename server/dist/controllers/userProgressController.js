"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserProgressController = exports.resetProgress = exports.updateProgress = exports.getProgressByQuestionSetId = exports.getUserProgress = void 0;
const User_1 = __importDefault(require("../models/User"));
const QuestionSet_1 = __importDefault(require("../models/QuestionSet"));
const UserProgress_1 = require("../models/UserProgress");
const responseUtils_1 = require("../utils/responseUtils");
/**
 * @desc    获取用户进度
 * @route   GET /api/v1/user-progress
 * @access  Private
 */
const getUserProgress = async (req, res) => {
    try {
        const user = await User_1.default.findByPk(req.user.id);
        if (!user) {
            return (0, responseUtils_1.sendError)(res, 404, '用户不存在');
        }
        const progress = user.progress || {};
        (0, responseUtils_1.sendResponse)(res, 200, '获取用户进度成功', progress);
    }
    catch (error) {
        console.error('Get user progress error:', error);
        (0, responseUtils_1.sendError)(res, 500, '获取用户进度失败', error);
    }
};
exports.getUserProgress = getUserProgress;
/**
 * @desc    获取特定题库的用户进度
 * @route   GET /api/v1/user-progress/:questionSetId
 * @access  Private
 */
const getProgressByQuestionSetId = async (req, res) => {
    try {
        const user = await User_1.default.findByPk(req.user.id);
        const questionSetId = req.params.questionSetId;
        if (!user) {
            return (0, responseUtils_1.sendError)(res, 404, '用户不存在');
        }
        // 检查题库是否存在
        const questionSet = await QuestionSet_1.default.findByPk(questionSetId);
        if (!questionSet) {
            return (0, responseUtils_1.sendError)(res, 404, '题库不存在');
        }
        const progress = user.progress?.[questionSetId] || {
            completedQuestions: 0,
            totalQuestions: 0,
            correctAnswers: 0,
            lastAccessed: null
        };
        (0, responseUtils_1.sendResponse)(res, 200, '获取题库进度成功', progress);
    }
    catch (error) {
        console.error('Get question set progress error:', error);
        (0, responseUtils_1.sendError)(res, 500, '获取题库进度失败', error);
    }
};
exports.getProgressByQuestionSetId = getProgressByQuestionSetId;
/**
 * @desc    更新用户进度
 * @route   POST /api/v1/user-progress
 * @access  Private
 */
const updateProgress = async (req, res) => {
    try {
        const { questionSetId, completedQuestions, totalQuestions, correctAnswers } = req.body;
        // 验证必填字段
        if (!questionSetId || completedQuestions === undefined || totalQuestions === undefined) {
            return (0, responseUtils_1.sendError)(res, 400, '请提供题库ID、已完成题目数和总题目数');
        }
        const user = await User_1.default.findByPk(req.user.id);
        if (!user) {
            return (0, responseUtils_1.sendError)(res, 404, '用户不存在');
        }
        // 检查题库是否存在
        const questionSet = await QuestionSet_1.default.findByPk(questionSetId);
        if (!questionSet) {
            return (0, responseUtils_1.sendError)(res, 404, '题库不存在');
        }
        // 更新进度
        if (!user.progress) {
            user.progress = {};
        }
        const progress = {
            completedQuestions,
            totalQuestions,
            correctAnswers: correctAnswers || 0,
            lastAccessed: new Date()
        };
        user.progress[questionSetId] = progress;
        await user.save();
        (0, responseUtils_1.sendResponse)(res, 200, '进度更新成功', progress);
    }
    catch (error) {
        console.error('Update progress error:', error);
        (0, responseUtils_1.sendError)(res, 500, '更新进度失败', error);
    }
};
exports.updateProgress = updateProgress;
/**
 * @desc    重置用户进度
 * @route   DELETE /api/v1/user-progress/:questionSetId
 * @access  Private
 */
const resetProgress = async (req, res) => {
    try {
        const user = await User_1.default.findByPk(req.user.id);
        const questionSetId = req.params.questionSetId;
        if (!user) {
            return (0, responseUtils_1.sendError)(res, 404, '用户不存在');
        }
        // 检查题库是否存在
        const questionSet = await QuestionSet_1.default.findByPk(questionSetId);
        if (!questionSet) {
            return (0, responseUtils_1.sendError)(res, 404, '题库不存在');
        }
        // 重置进度
        if (user.progress && user.progress[questionSetId]) {
            delete user.progress[questionSetId];
            await user.save();
        }
        (0, responseUtils_1.sendResponse)(res, 200, '进度重置成功');
    }
    catch (error) {
        console.error('Reset progress error:', error);
        (0, responseUtils_1.sendError)(res, 500, '重置进度失败', error);
    }
};
exports.resetProgress = resetProgress;
class UserProgressController {
    /**
     * @route POST /api/v1/progress
     * @access Private
     */
    static async createProgress(req, res) {
        try {
            const { questionSetId, questionId, isCorrect, timeSpent } = req.body;
            const userId = req.user.id;
            if (!questionSetId || !questionId || typeof isCorrect !== 'boolean') {
                return (0, responseUtils_1.sendError)(res, 400, '缺少必要参数');
            }
            const progress = await UserProgress_1.UserProgress.create({
                userId,
                questionSetId,
                questionId,
                isCorrect,
                timeSpent: timeSpent || 0,
            });
            return (0, responseUtils_1.sendResponse)(res, 201, '学习进度已记录', progress);
        }
        catch (error) {
            console.error('创建学习进度失败:', error);
            return (0, responseUtils_1.sendError)(res, 500, '创建学习进度失败');
        }
    }
    /**
     * @route GET /api/v1/progress
     * @access Private
     */
    static async getUserProgress(req, res) {
        try {
            const userId = req.user.id;
            const { questionSetId, startDate, endDate } = req.query;
            const where = { userId };
            if (questionSetId)
                where.questionSetId = questionSetId;
            if (startDate && endDate) {
                where.createdAt = {
                    $gte: new Date(startDate),
                    $lte: new Date(endDate),
                };
            }
            const progress = await UserProgress_1.UserProgress.find(where)
                .sort({ createdAt: -1 })
                .populate('questionSetId')
                .populate('questionId');
            return (0, responseUtils_1.sendResponse)(res, 200, '获取学习进度成功', progress);
        }
        catch (error) {
            console.error('获取学习进度失败:', error);
            return (0, responseUtils_1.sendError)(res, 500, '获取学习进度失败');
        }
    }
    /**
     * @route GET /api/v1/progress/stats
     * @access Private
     */
    static async getProgressStats(req, res) {
        try {
            const userId = req.user.id;
            const { questionSetId } = req.query;
            const where = { userId };
            if (questionSetId)
                where.questionSetId = questionSetId;
            const stats = await UserProgress_1.UserProgress.aggregate([
                { $match: where },
                {
                    $group: {
                        _id: '$questionSetId',
                        totalQuestions: { $sum: 1 },
                        correctAnswers: {
                            $sum: { $cond: ['$isCorrect', 1, 0] },
                        },
                        averageTimeSpent: { $avg: '$timeSpent' },
                    },
                },
                {
                    $lookup: {
                        from: 'questionsets',
                        localField: '_id',
                        foreignField: '_id',
                        as: 'questionSet',
                    },
                },
                { $unwind: '$questionSet' },
            ]);
            return (0, responseUtils_1.sendResponse)(res, 200, '获取学习统计成功', stats);
        }
        catch (error) {
            console.error('获取学习统计失败:', error);
            return (0, responseUtils_1.sendError)(res, 500, '获取学习统计失败');
        }
    }
    /**
     * @route DELETE /api/v1/progress/:id
     * @access Private
     */
    static async deleteProgress(req, res) {
        try {
            const { id } = req.params;
            const userId = req.user.id;
            const progress = await UserProgress_1.UserProgress.findOneAndDelete({
                _id: id,
                userId,
            });
            if (!progress) {
                return (0, responseUtils_1.sendError)(res, 404, '学习记录不存在');
            }
            return (0, responseUtils_1.sendResponse)(res, 200, '删除学习记录成功');
        }
        catch (error) {
            console.error('删除学习记录失败:', error);
            return (0, responseUtils_1.sendError)(res, 500, '删除学习记录失败');
        }
    }
}
exports.UserProgressController = UserProgressController;
