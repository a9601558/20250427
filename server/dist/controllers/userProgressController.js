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
const socket_1 = require("../config/socket");
const progressService_1 = require("../services/progressService");
/**
 * @desc    ユーザー進捗を取得
 * @route   GET /api/user-progress/:userId
 * @access  Private
 */
const getUserProgress = async (req, res) => {
    try {
        const { userId } = req.params;
        // ユーザー権限を検証：自分の情報のみ、または管理者は全員の情報にアクセス可能
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
        return (0, responseUtils_1.sendResponse)(res, 200, 'ユーザー進捗の取得に成功しました', progress);
    }
    catch (error) {
        return (0, responseUtils_1.sendError)(res, 500, 'ユーザー進捗の取得に失敗しました', error);
    }
};
exports.getUserProgress = getUserProgress;
/**
 * @desc    特定問題集のユーザー進捗を取得
 * @route   GET /api/user-progress/:userId/:questionSetId
 * @access  Private
 */
const getProgressByQuestionSetId = async (req, res) => {
    try {
        const { userId, questionSetId } = req.params;
        // ユーザー権限を検証：自分の情報のみ、または管理者は全員の情報にアクセス可能
        const currentUserId = req.user.id;
        if (userId !== currentUserId && req.user.role !== 'admin') {
            return (0, responseUtils_1.sendError)(res, 403, 'このユーザーの進捗にアクセスする権限がありません');
        }
        const progress = await UserProgress_1.default.findAll({
            where: { userId, questionSetId },
            include: [
                { model: QuestionSet_1.default, as: 'progressQuestionSet' },
                { model: Question_1.default, as: 'question' }
            ]
        });
        if (!progress || progress.length === 0) {
            return (0, responseUtils_1.sendError)(res, 404, 'Progress not found');
        }
        return (0, responseUtils_1.sendResponse)(res, 200, '進捗の取得に成功しました', progress);
    }
    catch (error) {
        return (0, responseUtils_1.sendError)(res, 500, 'Error fetching progress', error);
    }
};
exports.getProgressByQuestionSetId = getProgressByQuestionSetId;
/**
 * @desc    ユーザー進捗を更新
 * @route   POST /api/user-progress
 * @access  Private
 */
const updateProgress = async (req, res) => {
    try {
        const userId = req.user.id;
        const { questionSetId, questionId, isCorrect, timeSpent } = req.body;
        // 必須パラメータを検証
        if (!questionSetId || !questionId || typeof isCorrect !== 'boolean') {
            return (0, responseUtils_1.sendError)(res, 400, '必須パラメータが不足しています');
        }
        // 進捗記録を作成または更新
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
        // 記録が既に存在する場合は更新
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
            questionSet: progress.get('progressQuestionSet'),
            stats
        };
        socket_1.io.to(userId).emit('progress:update', updateEvent);
        return (0, responseUtils_1.sendResponse)(res, 200, '進捗の更新に成功しました', progress);
    }
    catch (error) {
        console.error('進捗の更新に失敗しました:', error);
        return (0, responseUtils_1.sendError)(res, 500, 'Error updating progress', error);
    }
};
exports.updateProgress = updateProgress;
/**
 * @desc    ユーザー進捗をリセット
 * @route   DELETE /api/user-progress/:userId/:questionSetId
 * @access  Private
 */
const resetProgress = async (req, res) => {
    try {
        const { userId, questionSetId } = req.params;
        // 验证用户权限：只能重置自己的或管理员有权限重置所有人的
        const currentUserId = req.user.id;
        if (userId !== currentUserId && req.user.role !== 'admin') {
            return (0, responseUtils_1.sendError)(res, 403, 'このユーザーの進捗をリセットする権限がありません');
        }
        await UserProgress_1.default.destroy({
            where: { userId, questionSetId },
        });
        return (0, responseUtils_1.sendResponse)(res, 200, '進捗のリセットに成功しました');
    }
    catch (error) {
        return (0, responseUtils_1.sendError)(res, 500, 'Error resetting progress', error);
    }
};
exports.resetProgress = resetProgress;
/**
 * @desc    詳細な進捗情報を記録
 * @route   POST /api/user-progress/record
 * @access  Private
 */
const createDetailedProgress = async (req, res) => {
    try {
        const userId = req.user.id;
        // デバッグ用リクエスト情報を出力
        console.log('Create Detailed Progress Request:', {
            body: req.body,
            userId: userId
        });
        // 互換性向上のため、異なるリクエストフィールドからデータを取得を試行
        let questionSetId = req.body.questionSetId;
        let questionId = req.body.questionId;
        let isCorrect = req.body.isCorrect;
        let timeSpent = req.body.timeSpent || 0;
        // リクエストに問題集データオブジェクトが含まれている場合
        if (req.body.questionSet) {
            questionSetId = req.body.questionSet.id || questionSetId;
        }
        // リクエストに問題データオブジェクトが含まれている場合
        if (req.body.question) {
            questionId = req.body.question.id || questionId;
            if (req.body.question.questionSetId) {
                questionSetId = req.body.question.questionSetId || questionSetId;
            }
        }
        // リクエストに回答データオブジェクトが含まれている場合
        if (req.body.answer) {
            isCorrect = req.body.answer.isCorrect !== undefined ? req.body.answer.isCorrect : isCorrect;
            timeSpent = req.body.answer.timeSpent || req.body.answer.time || timeSpent;
        }
        // リクエストに直接回答結果が含まれている場合
        if (req.body.result !== undefined) {
            isCorrect = !!req.body.result;
        }
        // 詳細なパラメータ検証
        const missingParams = [];
        if (!questionSetId)
            missingParams.push('questionSetId');
        if (!questionId)
            missingParams.push('questionId');
        if (typeof isCorrect !== 'boolean') {
            // 文字列の可能性があるブール値の変換を試行
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
            return (0, responseUtils_1.sendError)(res, 400, `必須パラメータが不足しています: ${missingParams.join(', ')}`);
        }
        // 新しい進捗記録を作成
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
            questionSet: newProgress.get('progressQuestionSet'),
            stats
        };
        socket_1.io.to(userId).emit('progress:update', updateEvent);
        return (0, responseUtils_1.sendResponse)(res, 201, '学習進捗を記録しました', newProgress.toJSON());
    }
    catch (error) {
        console.error('学習進捗の作成に失敗しました:', error);
        return (0, responseUtils_1.sendError)(res, 500, '学習進捗の作成に失敗しました', error);
    }
};
exports.createDetailedProgress = createDetailedProgress;
/**
 * @desc    詳細な進捗記録を取得
 * @route   GET /api/user-progress/detailed
 * @access  Private
 */
const getDetailedProgress = async (req, res) => {
    try {
        const userId = req.user?.id;
        const { questionSetId } = req.params;
        // 進捗記録を照会
        const progressRecords = await UserProgress_1.default.findAll({
            where: {
                userId,
                questionSetId
            },
            include: [
                {
                    model: Question_1.default,
                    as: 'question',
                    attributes: ['id', 'text', 'questionType', 'explanation']
                },
                {
                    model: QuestionSet_1.default,
                    as: 'progressQuestionSet',
                    attributes: ['id', 'title', 'description']
                }
            ]
        });
        if (!progressRecords.length) {
            return res.status(404).json({
                success: false,
                message: '進捗記録が見つかりません'
            });
        }
        return res.json({
            success: true,
            data: progressRecords
        });
    }
    catch (error) {
        console.error('進捗詳細の取得に失敗しました:', error);
        return res.status(500).json({
            success: false,
            message: 'サーバーエラー、進捗詳細の取得に失敗しました'
        });
    }
};
exports.getDetailedProgress = getDetailedProgress;
/**
 * @desc    学習統計を取得
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
                    as: 'questionSetQuestions',
                    attributes: ['id']
                }]
        });
        // 2. 查所有答题记录，包含关联的题库信息
        const userProgressRecords = await UserProgress_1.default.findAll({
            where: { userId },
            include: [{
                    model: QuestionSet_1.default,
                    as: 'progressQuestionSet',
                    attributes: ['id', 'title']
                }]
        });
        // 3. 整理成 Map，包含最后访问时间
        const progressMap = new Map();
        userProgressRecords.forEach(record => {
            // 确保 questionSetId 是有效的
            if (!record.questionSetId) {
                console.warn('questionSetIdが不足している記録を発見しました:', record.id);
                return; // 跳过此记录
            }
            const qsId = record.questionSetId.toString();
            if (!progressMap.has(qsId)) {
                progressMap.set(qsId, {
                    completed: 0,
                    correct: 0,
                    totalTime: 0,
                    lastAccessed: undefined
                });
            }
            const stats = progressMap.get(qsId);
            stats.completed++;
            if (record.isCorrect)
                stats.correct++;
            stats.totalTime += record.timeSpent || 0;
            // 更新 lastAccessed 为最新值
            const currentAccess = stats.lastAccessed?.getTime() || 0;
            const thisAccess = record.updatedAt ? new Date(record.updatedAt).getTime() : Date.now();
            if (thisAccess > currentAccess) {
                stats.lastAccessed = record.updatedAt ? new Date(record.updatedAt) : new Date();
            }
        });
        // 4. 生成最终统计
        const stats = questionSets.map(qs => {
            // 确保 qs.id 是有效的
            if (!qs || !qs.id) {
                console.warn('idが不足している問題集を発見しました');
                return null; // 返回 null，之后会过滤掉
            }
            const questions = qs.get('questionSetQuestions') || [];
            const totalQuestions = Array.isArray(questions) ? questions.length : 0;
            const progress = progressMap.get(qs.id.toString()) || {
                completed: 0,
                correct: 0,
                totalTime: 0,
                lastAccessed: new Date(0)
            };
            const completedQuestions = progress.completed;
            const correctAnswers = progress.correct;
            const totalTimeSpent = progress.totalTime;
            const averageTimeSpent = completedQuestions > 0 ? totalTimeSpent / completedQuestions : 0;
            const accuracy = completedQuestions > 0 ? (correctAnswers / completedQuestions) * 100 : 0;
            const lastAccessed = progress.lastAccessed
                ? progress.lastAccessed.toISOString()
                : new Date(0).toISOString();
            return {
                questionSetId: qs.id,
                questionSet: {
                    id: qs.id,
                    title: qs.get('title') || 'Unknown'
                },
                totalQuestions,
                completedQuestions,
                correctAnswers,
                totalTimeSpent,
                averageTimeSpent,
                accuracy,
                lastAccessed,
                total: totalQuestions,
                correct: correctAnswers,
                timeSpent: totalTimeSpent
            };
        }).filter(Boolean); // 过滤掉 null 值
        return (0, responseUtils_1.sendResponse)(res, 200, '学習統計の取得に成功しました', stats);
    }
    catch (error) {
        console.error('学習統計の取得に失敗しました:', error);
        return (0, responseUtils_1.sendError)(res, 500, '学習統計の取得に失敗しました', error);
    }
};
exports.getProgressStats = getProgressStats;
/**
 * @desc    進捗記録を削除
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
            return (0, responseUtils_1.sendError)(res, 404, '進捗記録が存在しません');
        }
        await progress.destroy();
        return (0, responseUtils_1.sendResponse)(res, 200, '進捗記録を削除しました');
    }
    catch (error) {
        console.error('進捗記録の削除に失敗しました:', error);
        return (0, responseUtils_1.sendError)(res, 500, '進捗記録の削除に失敗しました', error);
    }
};
exports.deleteProgressRecord = deleteProgressRecord;
/**
 * @desc    ユーザー進捗統計を取得
 * @route   GET /api/user-progress/stats/:userId
 * @access  Private
 */
const getUserProgressStats = async (req, res) => {
    try {
        const { userId } = req.params;
        const currentUserId = req.user.id;
        // 修改权限检查逻辑：允许用户访问自己的进度，或管理员访问任何用户的进度
        if (userId !== currentUserId && !req.user.isAdmin) {
            return (0, responseUtils_1.sendError)(res, 403, 'このユーザーの進捗統計にアクセスする権限がありません');
        }
        // 获取用户的所有进度记录，包括关联的题目集和题目信息
        const progressRecords = await UserProgress_1.default.findAll({
            where: { userId },
            include: [
                {
                    model: QuestionSet_1.default,
                    as: 'progressQuestionSet',
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
            ? progressRecords.reduce((sum, p) => sum + (p.timeSpent || 0), 0) / totalQuestions
            : 0;
        // 按题目集统计
        const setStats = progressRecords.reduce((acc, record) => {
            // 确保 questionSetId 是有效的
            if (!record.questionSetId) {
                return acc;
            }
            const setId = record.questionSetId.toString();
            const questionSet = record.get('progressQuestionSet');
            if (!acc[setId]) {
                acc[setId] = {
                    title: questionSet?.title || 'Unknown',
                    total: 0,
                    correct: 0,
                    timeSpent: 0,
                    lastAccessed: record.updatedAt ? record.updatedAt.toISOString() : new Date().toISOString()
                };
            }
            acc[setId].total++;
            if (record.isCorrect)
                acc[setId].correct++;
            acc[setId].timeSpent += record.timeSpent || 0;
            // 安全地更新 lastAccessed
            if (record.updatedAt) {
                const recordDate = new Date(record.updatedAt);
                const currentLastAccessed = acc[setId].lastAccessed ? new Date(acc[setId].lastAccessed) : new Date(0);
                if (recordDate > currentLastAccessed) {
                    acc[setId].lastAccessed = recordDate.toISOString();
                }
            }
            return acc;
        }, {});
        // 按题目类型统计，类似的安全处理
        const typeStats = progressRecords.reduce((acc, record) => {
            const question = record.get('question');
            const type = question?.questionType;
            if (!type)
                return acc;
            if (!acc[type]) {
                acc[type] = {
                    total: 0,
                    correct: 0,
                    timeSpent: 0,
                    lastAccessed: record.updatedAt ? record.updatedAt.toISOString() : new Date().toISOString()
                };
            }
            acc[type].total++;
            if (record.isCorrect)
                acc[type].correct++;
            acc[type].timeSpent += record.timeSpent || 0;
            // 安全地更新 lastAccessed
            if (record.updatedAt) {
                const recordDate = new Date(record.updatedAt);
                const currentLastAccessed = acc[type].lastAccessed ? new Date(acc[type].lastAccessed) : new Date(0);
                if (recordDate > currentLastAccessed) {
                    acc[type].lastAccessed = recordDate.toISOString();
                }
            }
            return acc;
        }, {});
        // 计算每个统计的准确率和平均时间
        Object.values(setStats).forEach((stat) => {
            stat.accuracy = stat.total > 0 ? (stat.correct / stat.total) * 100 : 0;
            stat.averageTime = stat.total > 0 ? stat.timeSpent / stat.total : 0;
        });
        Object.values(typeStats).forEach((stat) => {
            stat.accuracy = stat.total > 0 ? (stat.correct / stat.total) * 100 : 0;
            stat.averageTime = stat.total > 0 ? stat.timeSpent / stat.total : 0;
        });
        return (0, responseUtils_1.sendResponse)(res, 200, 'ユーザー進捗統計の取得に成功しました', {
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
 * @desc    ユーザーの原始進捗記録を取得
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
        return (0, responseUtils_1.sendResponse)(res, 200, '進捗記録の取得に成功しました', progressRecords);
    }
    catch (error) {
        console.error('進捗記録の取得に失敗しました:', error);
        return (0, responseUtils_1.sendError)(res, 500, '進捗記録の取得に失敗しました', error);
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
                    as: 'question',
                    attributes: ['id', 'questionSetId']
                }]
        });
        // 按题库分组计算统计信息
        const summary = questionSets.map(qs => {
            const progressRecords = userProgress.filter(p => {
                const question = p.get('question');
                return question?.questionSetId === qs.id;
            });
            const totalQuestions = qs.questionSetQuestions?.length || 0;
            const completedQuestions = progressRecords.length;
            const correctAnswers = progressRecords.filter(p => p.isCorrect).length;
            const totalTimeSpent = progressRecords.reduce((sum, p) => sum + (p.timeSpent || 0), 0);
            const averageTimeSpent = completedQuestions > 0 ? totalTimeSpent / completedQuestions : 0;
            const accuracy = completedQuestions > 0 ? (correctAnswers / completedQuestions) * 100 : 0;
            // 获取最后访问时间
            const lastAccessed = progressRecords.length > 0
                ? new Date(Math.max(...progressRecords.map(p => new Date(p.updatedAt).getTime())))
                : null;
            return {
                questionSetId: qs.id,
                questionSetTitle: qs.title,
                totalQuestions,
                completedQuestions,
                correctAnswers,
                totalTimeSpent,
                averageTimeSpent,
                accuracy,
                lastAccessed: lastAccessed?.toISOString() || null
            };
        });
        res.json({
            success: true,
            data: summary
        });
    }
    catch (error) {
        console.error('進捗サマリー統計の取得に失敗しました:', error);
        res.status(500).json({
            success: false,
            error: '進捗サマリー統計の取得に失敗しました'
        });
    }
};
exports.getProgressSummary = getProgressSummary;
