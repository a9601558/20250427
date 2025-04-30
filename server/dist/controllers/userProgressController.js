"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getProgressSummary = exports.getUserProgressRecords = exports.getUserProgressStats = exports.deleteProgressRecord = exports.getProgressStats = exports.getDetailedProgress = exports.createDetailedProgress = exports.resetProgress = exports.updateProgress = exports.getProgressByQuestionSetId = exports.getUserProgress = void 0;
const QuestionSet_1 = __importDefault(require("../models/QuestionSet"));
const UserProgress_1 = __importDefault(require("../models/UserProgress"));
const Question_1 = __importDefault(require("../models/Question"));
const responseUtils_1 = require("../utils/responseUtils");
const sequelize_1 = require("sequelize");
const socket_1 = require("../config/socket");
const progressService_1 = require("../services/progressService");
/**
 * @desc    获取用户进度
 * @route   GET /api/user-progress/:userId
 * @access  Private
 */
const getUserProgress = async (req, res) => {
    try {
        const { userId } = req.params;
        // 验证用户权限：只能查询自己的或管理员有权限查询所有人的
        const currentUserId = req.user.id;
        if (userId !== currentUserId && !req.user.isAdmin) {
            return (0, responseUtils_1.sendError)(res, 403, '无权访问此用户的进度');
        }
        const progress = await UserProgress_1.default.findAll({
            where: { userId },
            include: [
                {
                    model: QuestionSet_1.default,
                    as: 'progressQuestionSet',
                    attributes: ['id', 'title']
                }
            ]
        });
        return (0, responseUtils_1.sendResponse)(res, 200, '获取用户进度成功', progress);
    }
    catch (error) {
        return (0, responseUtils_1.sendError)(res, 500, '获取用户进度失败', error);
    }
};
exports.getUserProgress = getUserProgress;
/**
 * @desc    获取特定题库的用户进度
 * @route   GET /api/user-progress/:userId/:questionSetId
 * @access  Private
 */
const getProgressByQuestionSetId = async (req, res) => {
    try {
        const { userId, questionSetId } = req.params;
        // 验证用户权限：只能查询自己的或管理员有权限查询所有人的
        const currentUserId = req.user.id;
        if (userId !== currentUserId && req.user.role !== 'admin') {
            return (0, responseUtils_1.sendError)(res, 403, '无权访问此用户的进度');
        }
        const progress = await UserProgress_1.default.findAll({
            where: { userId, questionSetId },
            include: [
                { model: QuestionSet_1.default, as: 'questionSet' },
                { model: Question_1.default, as: 'question' }
            ]
        });
        if (!progress || progress.length === 0) {
            return (0, responseUtils_1.sendError)(res, 404, 'Progress not found');
        }
        return (0, responseUtils_1.sendResponse)(res, 200, '获取进度成功', progress);
    }
    catch (error) {
        return (0, responseUtils_1.sendError)(res, 500, 'Error fetching progress', error);
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
        const userId = req.user.id;
        const { questionSetId, questionId, isCorrect, timeSpent } = req.body;
        // 验证必要参数
        if (!questionSetId || !questionId || typeof isCorrect !== 'boolean') {
            return (0, responseUtils_1.sendError)(res, 400, '缺少必要参数');
        }
        // 创建或更新进度记录
        const [progress, created] = await UserProgress_1.default.findOrCreate({
            where: {
                userId,
                questionSetId,
                questionId
            },
            defaults: {
                userId,
                questionSetId,
                questionId,
                isCorrect,
                timeSpent: timeSpent || 0,
                lastAccessed: new Date()
            }
        });
        // 如果记录已存在，更新它
        if (!created) {
            await progress.update({
                isCorrect,
                timeSpent: timeSpent || progress.timeSpent,
                lastAccessed: new Date()
            });
        }
        // 获取最新的统计数据
        const stats = await (0, progressService_1.calculateProgressStats)(userId, questionSetId);
        // 发送实时更新
        const updateEvent = {
            questionSetId,
            questionSet: progress.progressQuestionSet,
            stats
        };
        socket_1.io.to(userId).emit('progress:update', updateEvent);
        return (0, responseUtils_1.sendResponse)(res, 200, '更新进度成功', progress);
    }
    catch (error) {
        console.error('更新进度失败:', error);
        return (0, responseUtils_1.sendError)(res, 500, 'Error updating progress', error);
    }
};
exports.updateProgress = updateProgress;
/**
 * @desc    重置用户进度
 * @route   DELETE /api/user-progress/:userId/:questionSetId
 * @access  Private
 */
const resetProgress = async (req, res) => {
    try {
        const { userId, questionSetId } = req.params;
        // 验证用户权限：只能重置自己的或管理员有权限重置所有人的
        const currentUserId = req.user.id;
        if (userId !== currentUserId && req.user.role !== 'admin') {
            return (0, responseUtils_1.sendError)(res, 403, '无权重置此用户的进度');
        }
        await UserProgress_1.default.destroy({
            where: { userId, questionSetId },
        });
        return (0, responseUtils_1.sendResponse)(res, 200, '进度重置成功');
    }
    catch (error) {
        return (0, responseUtils_1.sendError)(res, 500, 'Error resetting progress', error);
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
        const userId = req.user.id;
        // 打印请求信息，便于调试
        console.log('Create Detailed Progress Request:', {
            body: req.body,
            userId: userId
        });
        // 尝试从不同的请求字段获取数据，增加兼容性
        let questionSetId = req.body.questionSetId;
        let questionId = req.body.questionId;
        let isCorrect = req.body.isCorrect;
        let timeSpent = req.body.timeSpent || 0;
        // 如果请求包含问题集数据对象
        if (req.body.questionSet) {
            questionSetId = req.body.questionSet.id || questionSetId;
        }
        // 如果请求包含问题数据对象
        if (req.body.question) {
            questionId = req.body.question.id || questionId;
            if (req.body.question.questionSetId) {
                questionSetId = req.body.question.questionSetId || questionSetId;
            }
        }
        // 如果请求包含答案数据对象
        if (req.body.answer) {
            isCorrect = req.body.answer.isCorrect !== undefined ? req.body.answer.isCorrect : isCorrect;
            timeSpent = req.body.answer.timeSpent || req.body.answer.time || timeSpent;
        }
        // 如果请求直接包含答案结果
        if (req.body.result !== undefined) {
            isCorrect = !!req.body.result;
        }
        // 详细的参数验证
        const missingParams = [];
        if (!questionSetId)
            missingParams.push('questionSetId');
        if (!questionId)
            missingParams.push('questionId');
        if (typeof isCorrect !== 'boolean') {
            // 尝试转换可能是字符串的布尔值
            if (isCorrect === 'true')
                isCorrect = true;
            else if (isCorrect === 'false')
                isCorrect = false;
            else
                missingParams.push('isCorrect');
        }
        console.log('Processed parameters:', {
            questionSetId,
            questionId,
            isCorrect,
            timeSpent
        });
        if (missingParams.length > 0) {
            return (0, responseUtils_1.sendError)(res, 400, `缺少必要参数: ${missingParams.join(', ')}`);
        }
        // 创建新的进度记录
        const newProgress = await UserProgress_1.default.create({
            userId,
            questionSetId,
            questionId,
            isCorrect,
            timeSpent,
            lastAccessed: new Date()
        });
        // 获取最新的统计数据
        const stats = await (0, progressService_1.calculateProgressStats)(userId, questionSetId);
        // 发送实时更新
        const updateEvent = {
            questionSetId,
            questionSet: newProgress.progressQuestionSet,
            stats
        };
        socket_1.io.to(userId).emit('progress:update', updateEvent);
        return (0, responseUtils_1.sendResponse)(res, 201, '学习进度已记录', newProgress.toJSON());
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
        // 1. 查所有题库 + 题目
        const questionSets = await QuestionSet_1.default.findAll({
            attributes: ['id', 'title'],
            include: [{
                    model: Question_1.default,
                    as: 'questions',
                    attributes: ['id']
                }]
        });
        // 2. 查所有答题记录
        const userProgressRecords = await UserProgress_1.default.findAll({
            where: { userId },
        });
        // 3. 整理成 Map
        const progressMap = new Map();
        userProgressRecords.forEach(record => {
            const qsId = record.questionSetId;
            if (!progressMap.has(qsId)) {
                progressMap.set(qsId, { completed: 0, correct: 0, totalTime: 0 });
            }
            const stats = progressMap.get(qsId);
            stats.completed++;
            if (record.isCorrect)
                stats.correct++;
            stats.totalTime += record.timeSpent;
        });
        // 4. 生成最终统计
        const stats = questionSets.map(qs => {
            // 安全地获取 questions 数组
            const questions = qs.get('questions') || [];
            const totalQuestions = Array.isArray(questions) ? questions.length : 0;
            // 获取用户进度数据，如果不存在则使用默认值
            const progress = progressMap.get(qs.id) || { completed: 0, correct: 0, totalTime: 0 };
            const completedQuestions = progress.completed;
            const correctAnswers = progress.correct;
            const totalTimeSpent = progress.totalTime;
            const averageTimeSpent = completedQuestions > 0 ? totalTimeSpent / completedQuestions : 0;
            const accuracy = completedQuestions > 0 ? (correctAnswers / completedQuestions) * 100 : 0;
            return {
                questionSetId: qs.id,
                questionSet: {
                    id: qs.id,
                    title: qs.get('title')
                },
                totalQuestions,
                completedQuestions,
                correctAnswers,
                totalTimeSpent,
                averageTimeSpent,
                accuracy,
                total: totalQuestions, // 兼容字段
                correct: correctAnswers,
                timeSpent: totalTimeSpent
            };
        });
        return (0, responseUtils_1.sendResponse)(res, 200, '获取学习统计成功', stats);
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
/**
 * @desc    获取用户进度统计
 * @route   GET /api/user-progress/stats/:userId
 * @access  Private
 */
const getUserProgressStats = async (req, res) => {
    try {
        const { userId } = req.params;
        // 验证用户权限：只能查询自己的或管理员有权限查询所有人的
        const currentUserId = req.user.id;
        if (userId !== currentUserId && req.user.role !== 'admin') {
            return (0, responseUtils_1.sendError)(res, 403, '无权访问此用户的进度统计');
        }
        // 获取用户的所有进度记录，包括关联的题目集和题目信息
        const progressRecords = await UserProgress_1.default.findAll({
            where: { userId },
            include: [
                {
                    model: QuestionSet_1.default,
                    as: 'questionSet',
                    attributes: ['id', 'title']
                },
                {
                    model: Question_1.default,
                    as: 'question',
                    attributes: ['id', 'questionType']
                }
            ]
        });
        // 计算总体统计
        const totalQuestions = progressRecords.length;
        const correctAnswers = progressRecords.filter(p => p.isCorrect).length;
        const accuracy = totalQuestions > 0 ? (correctAnswers / totalQuestions) * 100 : 0;
        const averageTimeSpent = totalQuestions > 0
            ? progressRecords.reduce((sum, p) => sum + p.timeSpent, 0) / totalQuestions
            : 0;
        // 按题目集统计
        const setStats = progressRecords.reduce((acc, record) => {
            const setId = record.questionSetId.toString();
            const questionSet = record.get('questionSet');
            if (!acc[setId]) {
                acc[setId] = {
                    title: questionSet?.title,
                    total: 0,
                    correct: 0,
                    timeSpent: 0
                };
            }
            acc[setId].total++;
            if (record.isCorrect)
                acc[setId].correct++;
            acc[setId].timeSpent += record.timeSpent;
            return acc;
        }, {});
        // 按题目类型统计
        const typeStats = progressRecords.reduce((acc, record) => {
            const question = record.get('question');
            const type = question?.questionType;
            if (!type)
                return acc;
            if (!acc[type]) {
                acc[type] = {
                    total: 0,
                    correct: 0,
                    timeSpent: 0
                };
            }
            acc[type].total++;
            if (record.isCorrect)
                acc[type].correct++;
            acc[type].timeSpent += record.timeSpent;
            return acc;
        }, {});
        // 计算每个统计的准确率和平均时间
        Object.values(setStats).forEach((stat) => {
            stat.accuracy = (stat.correct / stat.total) * 100;
            stat.averageTime = stat.timeSpent / stat.total;
        });
        Object.values(typeStats).forEach((stat) => {
            stat.accuracy = (stat.correct / stat.total) * 100;
            stat.averageTime = stat.timeSpent / stat.total;
        });
        return (0, responseUtils_1.sendResponse)(res, 200, '获取用户进度统计成功', {
            overall: {
                totalQuestions,
                correctAnswers,
                accuracy,
                averageTimeSpent
            },
            bySet: setStats,
            byType: typeStats
        });
    }
    catch (error) {
        console.error('Error getting user progress stats:', error);
        return (0, responseUtils_1.sendError)(res, 500, 'Failed to get user progress statistics', error);
    }
};
exports.getUserProgressStats = getUserProgressStats;
/**
 * @desc    获取用户的原始进度记录
 * @route   GET /api/user-progress/records
 * @access  Private
 */
const getUserProgressRecords = async (req, res) => {
    try {
        const userId = req.user.id;
        // 获取用户的所有进度记录
        const progressRecords = await UserProgress_1.default.findAll({
            where: { userId },
            attributes: ['id', 'questionSetId', 'questionId', 'isCorrect', 'timeSpent', 'createdAt', 'updatedAt'],
            include: [{
                    model: QuestionSet_1.default,
                    as: 'progressQuestionSet',
                    attributes: ['id', 'title']
                }]
        });
        return (0, responseUtils_1.sendResponse)(res, 200, '获取进度记录成功', progressRecords);
    }
    catch (error) {
        console.error('获取进度记录失败:', error);
        return (0, responseUtils_1.sendError)(res, 500, '获取进度记录失败', error);
    }
};
exports.getUserProgressRecords = getUserProgressRecords;
// 获取用户进度汇总统计
const getProgressSummary = async (req, res) => {
    try {
        const userId = req.user.id;
        // 获取所有题库
        const questionSets = await QuestionSet_1.default.findAll();
        // 获取用户的所有进度记录
        const userProgress = await UserProgress_1.default.findAll({
            where: { userId },
            include: [{
                    model: Question_1.default,
                    as: 'progressQuestion',
                    attributes: ['id', 'questionSetId']
                }]
        });
        // 按题库分组计算统计信息
        const summary = questionSets.map(qs => {
            const progressRecords = userProgress.filter(p => p.progressQuestion?.questionSetId === qs.id);
            const totalQuestions = qs.questions?.length || 0;
            const completedQuestions = progressRecords.length;
            const correctAnswers = progressRecords.filter(p => p.isCorrect).length;
            const totalTimeSpent = progressRecords.reduce((sum, p) => sum + (p.timeSpent || 0), 0);
            const averageTimeSpent = completedQuestions > 0 ? totalTimeSpent / completedQuestions : 0;
            const accuracy = completedQuestions > 0 ? (correctAnswers / completedQuestions) * 100 : 0;
            return {
                questionSetId: qs.id,
                questionSetTitle: qs.title,
                totalQuestions,
                completedQuestions,
                correctAnswers,
                totalTimeSpent,
                averageTimeSpent,
                accuracy
            };
        });
        res.json({
            success: true,
            data: summary
        });
    }
    catch (error) {
        console.error('获取进度汇总统计失败:', error);
        res.status(500).json({
            success: false,
            error: '获取进度汇总统计失败'
        });
    }
};
exports.getProgressSummary = getProgressSummary;
