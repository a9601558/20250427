"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteProgressRecord = exports.getProgressStats = exports.getDetailedProgress = exports.createDetailedProgress = exports.resetProgress = exports.updateProgress = exports.getProgressByQuestionSetId = exports.getUserProgress = void 0;
const User_1 = __importDefault(require("../models/User"));
const QuestionSet_1 = __importDefault(require("../models/QuestionSet"));
const UserProgress_1 = __importDefault(require("../models/UserProgress"));
const Question_1 = __importDefault(require("../models/Question"));
const responseUtils_1 = require("../utils/responseUtils");
const sequelize_1 = require("sequelize");
/**
 * @desc    获取用户进度
 * @route   GET /api/user-progress
 * @access  Private
 */
const getUserProgress = async (req, res) => {
    try {
        const user = await User_1.default.findByPk(req.user.id);
        if (!user) {
            return (0, responseUtils_1.sendError)(res, 404, '用户不存在');
        }
        const progress = user.progress || {};
        // 确保响应格式一致 - 转换为数组格式
        const progressArray = Object.entries(progress).map(([questionSetId, data]) => ({
            questionSetId,
            ...data
        }));
        return (0, responseUtils_1.sendResponse)(res, 200, '获取用户进度成功', progressArray);
    }
    catch (error) {
        console.error('Get user progress error:', error);
        return (0, responseUtils_1.sendError)(res, 500, '获取用户进度失败', error);
    }
};
exports.getUserProgress = getUserProgress;
/**
 * @desc    获取特定题库的用户进度
 * @route   GET /api/user-progress/:questionSetId
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
        // 添加 questionSetId 到响应中
        const response = {
            questionSetId,
            ...progress
        };
        return (0, responseUtils_1.sendResponse)(res, 200, '获取题库进度成功', response);
    }
    catch (error) {
        console.error('Get question set progress error:', error);
        return (0, responseUtils_1.sendError)(res, 500, '获取题库进度失败', error);
    }
};
exports.getProgressByQuestionSetId = getProgressByQuestionSetId;
/**
 * @desc    更新用户进度
 * @route   POST /api/user-progress
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
        // 添加 questionSetId 到响应中
        const response = {
            questionSetId,
            ...progress
        };
        return (0, responseUtils_1.sendResponse)(res, 200, '进度更新成功', response);
    }
    catch (error) {
        console.error('Update progress error:', error);
        return (0, responseUtils_1.sendError)(res, 500, '更新进度失败', error);
    }
};
exports.updateProgress = updateProgress;
/**
 * @desc    重置用户进度
 * @route   DELETE /api/user-progress/:questionSetId
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
        return (0, responseUtils_1.sendResponse)(res, 200, '进度重置成功');
    }
    catch (error) {
        console.error('Reset progress error:', error);
        return (0, responseUtils_1.sendError)(res, 500, '重置进度失败', error);
    }
};
exports.resetProgress = resetProgress;
/**
 * @desc    记录详细的进度信息
 * @route   POST /api/user-progress/record
 * @access  Private
 */
const createDetailedProgress = async (req, res) => {
    try {
        const { questionSetId, questionId, isCorrect, timeSpent } = req.body;
        const userId = req.user.id;
        if (!questionSetId || !questionId || typeof isCorrect !== 'boolean') {
            return (0, responseUtils_1.sendError)(res, 400, '缺少必要参数');
        }
        const progress = await UserProgress_1.default.create({
            userId,
            questionSetId,
            questionId,
            isCorrect,
            timeSpent: timeSpent || 0,
        });
        // 确保返回的是纯对象
        return (0, responseUtils_1.sendResponse)(res, 201, '学习进度已记录', progress.toJSON());
    }
    catch (error) {
        console.error('创建学习进度失败:', error);
        return (0, responseUtils_1.sendError)(res, 500, '创建学习进度失败', error);
    }
};
exports.createDetailedProgress = createDetailedProgress;
/**
 * @desc    获取详细的进度记录
 * @route   GET /api/user-progress/detailed
 * @access  Private
 */
const getDetailedProgress = async (req, res) => {
    try {
        const userId = req.user.id;
        const { questionSetId, startDate, endDate } = req.query;
        const where = { userId };
        if (questionSetId)
            where.questionSetId = questionSetId;
        if (startDate && endDate) {
            where.createdAt = {
                [sequelize_1.Op.between]: [new Date(startDate), new Date(endDate)]
            };
        }
        const progress = await UserProgress_1.default.findAll({
            where,
            order: [['createdAt', 'DESC']],
            include: [
                { model: QuestionSet_1.default, as: 'questionSet' },
                { model: Question_1.default, as: 'question' }
            ]
        });
        // 确保返回纯对象数组
        return (0, responseUtils_1.sendResponse)(res, 200, '获取学习进度成功', progress.map(p => p.toJSON()));
    }
    catch (error) {
        console.error('获取学习进度失败:', error);
        return (0, responseUtils_1.sendError)(res, 500, '获取学习进度失败', error);
    }
};
exports.getDetailedProgress = getDetailedProgress;
/**
 * @desc    获取学习统计
 * @route   GET /api/user-progress/stats
 * @access  Private
 */
const getProgressStats = async (req, res) => {
    try {
        const userId = req.user.id;
        const { questionSetId } = req.query;
        const where = { userId };
        if (questionSetId)
            where.questionSetId = questionSetId;
        // 使用 Sequelize 查询所有匹配的记录
        const progressRecords = await UserProgress_1.default.findAll({
            where,
            include: [
                { model: QuestionSet_1.default, as: 'questionSet' }
            ]
        });
        // 在 JavaScript 中进行数据聚合
        const statsMap = new Map();
        progressRecords.forEach(record => {
            const qsId = record.questionSetId;
            if (!statsMap.has(qsId)) {
                const questionSet = record.get('questionSet');
                statsMap.set(qsId, {
                    questionSetId: qsId,
                    questionSet: questionSet ? questionSet.toJSON() : null,
                    totalQuestions: 0,
                    correctAnswers: 0,
                    totalTimeSpent: 0
                });
            }
            const stats = statsMap.get(qsId);
            stats.totalQuestions++;
            if (record.isCorrect) {
                stats.correctAnswers++;
            }
            stats.totalTimeSpent += record.timeSpent;
        });
        // 计算平均时间并整合结果
        const stats = Array.from(statsMap.values()).map(stat => ({
            ...stat,
            averageTimeSpent: stat.totalQuestions > 0 ? stat.totalTimeSpent / stat.totalQuestions : 0
        }));
        // 确保返回数组
        return (0, responseUtils_1.sendResponse)(res, 200, '获取学习统计成功', stats.length > 0 ? stats : []);
    }
    catch (error) {
        console.error('获取学习统计失败:', error);
        return (0, responseUtils_1.sendError)(res, 500, '获取学习统计失败', error);
    }
};
exports.getProgressStats = getProgressStats;
/**
 * @desc    删除进度记录
 * @route   DELETE /api/user-progress/record/:id
 * @access  Private
 */
const deleteProgressRecord = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;
        const progress = await UserProgress_1.default.findOne({
            where: { id, userId }
        });
        if (!progress) {
            return (0, responseUtils_1.sendError)(res, 404, '进度记录不存在');
        }
        await progress.destroy();
        return (0, responseUtils_1.sendResponse)(res, 200, '进度记录已删除');
    }
    catch (error) {
        console.error('删除进度记录失败:', error);
        return (0, responseUtils_1.sendError)(res, 500, '删除进度记录失败', error);
    }
};
exports.deleteProgressRecord = deleteProgressRecord;
