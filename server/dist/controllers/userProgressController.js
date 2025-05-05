"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.quizSubmit = exports.deleteProgressRecord = exports.getUserProgressRecords = exports.syncProgressViaBeacon = exports.getProgressSummary = exports.getUserProgressStats = exports.getProgressStats = exports.getDetailedProgress = exports.createDetailedProgress = exports.resetProgress = exports.updateProgress = exports.getProgressByQuestionSetId = exports.getUserProgress = void 0;
const User_1 = __importDefault(require("../models/User"));
const QuestionSet_1 = __importDefault(require("../models/QuestionSet"));
const UserProgress_1 = __importDefault(require("../models/UserProgress"));
const Question_1 = __importDefault(require("../models/Question"));
const responseUtils_1 = require("../utils/responseUtils");
const sequelize_1 = require("sequelize");
const database_1 = __importDefault(require("../config/database"));
const socket_1 = require("../socket");
const uuid_1 = require("uuid");
/**
 * Progress record types - helps distinguish between different recording strategies
 */
const PROGRESS_RECORD_TYPES = {
    INDIVIDUAL_ANSWER: 'individual_answer', // Individual question answer
    DETAILED_PROGRESS: 'detailed_progress', // Detailed progress with metadata
    SESSION_SUMMARY: 'session_summary', // Summary of a session (beacon API)
    AGGREGATED: 'aggregated' // Aggregated stats
};
/**
 * Check if the user has permission to access/modify the requested user's data
 * @param req Express request
 * @param targetUserId Target user ID
 * @returns Boolean indicating if access is permitted
 */
const checkPermission = (req, targetUserId) => {
    // Ensure user is logged in
    if (!req.user || !req.user.id) {
        return false;
    }
    // Admin can access all user data
    if (req.user.isAdmin || req.user.role === 'admin') {
        return true;
    }
    // Regular user can only access their own data
    return req.user.id === targetUserId;
};
/**
 * @desc    获取用户进度
 * @route   GET /api/user-progress/:userId
 * @access  Private
 */
const getUserProgress = async (req, res) => {
    try {
        const { userId } = req.params;
        const { page = 1, limit = 10, sort = 'lastAccessed', order = 'desc', recordType } = req.query;
        // Validate params
        if (!userId) {
            return (0, responseUtils_1.sendError)(res, 400, '缺少用户ID参数');
        }
        // Permission check
        if (!checkPermission(req, userId)) {
            return (0, responseUtils_1.sendError)(res, 403, '无权访问此用户的进度');
        }
        // Calculate pagination params
        const pageNum = parseInt(page, 10);
        const limitNum = parseInt(limit, 10);
        const offset = (pageNum - 1) * limitNum;
        // Define sorting options
        const sortFields = ['lastAccessed', 'createdAt', 'updatedAt', 'timeSpent', 'isCorrect'];
        const sortField = sortFields.includes(sort) ? sort : 'lastAccessed';
        const sortOrder = order?.toLowerCase() === 'asc' ? 'ASC' : 'DESC';
        // Build where clause
        const whereClause = { userId };
        if (recordType) {
            whereClause.recordType = recordType;
        }
        // Get paginated progress records
        const { count, rows } = await UserProgress_1.default.findAndCountAll({
            where: whereClause,
            include: [
                {
                    model: QuestionSet_1.default,
                    as: 'progressQuestionSet',
                    attributes: ['id', 'title']
                }
            ],
            limit: limitNum,
            offset,
            order: [[sortField, sortOrder]]
        });
        const totalPages = Math.ceil(count / limitNum);
        return (0, responseUtils_1.sendResponse)(res, 200, '获取用户进度成功', {
            data: rows,
            pagination: {
                total: count,
                page: pageNum,
                limit: limitNum,
                totalPages
            }
        });
    }
    catch (error) {
        console.error('获取用户进度失败:', error);
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
        const { page = 1, limit = 10, sort = 'lastAccessed', order = 'desc', recordType } = req.query;
        // Validate params
        if (!userId || !questionSetId) {
            return (0, responseUtils_1.sendError)(res, 400, '缺少必要参数');
        }
        // Permission check
        if (!checkPermission(req, userId)) {
            return (0, responseUtils_1.sendError)(res, 403, '无权访问此用户的进度');
        }
        // Calculate pagination params
        const pageNum = parseInt(page, 10);
        const limitNum = parseInt(limit, 10);
        const offset = (pageNum - 1) * limitNum;
        // Define sorting options
        const sortFields = ['lastAccessed', 'createdAt', 'updatedAt', 'timeSpent', 'isCorrect'];
        const sortField = sortFields.includes(sort) ? sort : 'lastAccessed';
        const sortOrder = order?.toLowerCase() === 'asc' ? 'ASC' : 'DESC';
        // Build where clause
        const whereClause = { userId, questionSetId };
        if (recordType) {
            whereClause.recordType = recordType;
        }
        // Get paginated progress records
        const { count, rows } = await UserProgress_1.default.findAndCountAll({
            where: whereClause,
            include: [
                {
                    model: QuestionSet_1.default,
                    as: 'progressQuestionSet'
                },
                {
                    model: Question_1.default,
                    as: 'question'
                }
            ],
            limit: limitNum,
            offset,
            order: [[sortField, sortOrder]]
        });
        const totalPages = Math.ceil(count / limitNum);
        if (count === 0) {
            return (0, responseUtils_1.sendError)(res, 404, '找不到进度记录');
        }
        return (0, responseUtils_1.sendResponse)(res, 200, '获取进度成功', {
            data: rows,
            pagination: {
                total: count,
                page: pageNum,
                limit: limitNum,
                totalPages
            }
        });
    }
    catch (error) {
        console.error('获取题库进度失败:', error);
        return (0, responseUtils_1.sendError)(res, 500, '获取题库进度失败', error);
    }
};
exports.getProgressByQuestionSetId = getProgressByQuestionSetId;
/**
 * @desc    更新用户进度
 * @route   POST /api/user-progress/update
 * @access  Private
 */
const updateProgress = async (req, res) => {
    // Start transaction for atomic operations
    const transaction = await database_1.default.transaction();
    try {
        // 修复认证问题：允许提供userId作为请求参数，如果没有认证(401情况)
        const userId = req.user?.id || req.body.userId;
        // 检查是否有userId
        if (!userId) {
            await transaction.rollback();
            return (0, responseUtils_1.sendError)(res, 400, '未提供用户ID，请确保已登录或在请求中提供userId');
        }
        const { questionSetId, questionId, isCorrect, timeSpent, answerDetails, completedQuestions, correctAnswers } = req.body;
        // 支持多种数据格式，增强兼容性
        let effectiveQuestionSetId = questionSetId || req.body.question_set_id;
        let effectiveIsCorrect = isCorrect;
        let effectiveTimeSpent = timeSpent || req.body.time_spent || 0;
        // 从不同格式的字段中提取数据
        if (req.body.answers && Array.isArray(req.body.answers)) {
            // 处理批量提交的答案
            // 创建或更新每个答案的进度记录
            for (const answer of req.body.answers) {
                const answerId = answer.questionId || answer.question_id;
                const answerIsCorrect = answer.isCorrect || answer.is_correct;
                const answerTimeSpent = answer.timeSpent || answer.time_spent || 0;
                if (answerId && typeof answerIsCorrect === 'boolean') {
                    await createOrUpdateProgressRecord(userId, effectiveQuestionSetId, answerId, answerIsCorrect, answerTimeSpent, answer, transaction);
                }
            }
        }
        else if (questionId || req.body.question_id) {
            // 处理单个答案
            const effectiveQuestionId = questionId || req.body.question_id;
            if (!effectiveQuestionSetId || !effectiveQuestionId) {
                await transaction.rollback();
                return (0, responseUtils_1.sendError)(res, 400, '缺少必要参数: questionSetId和questionId');
            }
            if (typeof effectiveIsCorrect !== 'boolean' && req.body.result !== undefined) {
                effectiveIsCorrect = !!req.body.result;
            }
            if (typeof effectiveIsCorrect !== 'boolean') {
                // 如果仍然没有isCorrect值，尝试从其他可能的字段获取
                if (req.body.is_correct !== undefined) {
                    effectiveIsCorrect = !!req.body.is_correct;
                }
                else {
                    await transaction.rollback();
                    return (0, responseUtils_1.sendError)(res, 400, '缺少必要参数: isCorrect');
                }
            }
            await createOrUpdateProgressRecord(userId, effectiveQuestionSetId, effectiveQuestionId, effectiveIsCorrect, effectiveTimeSpent, answerDetails, transaction);
        }
        else if (effectiveQuestionSetId && (completedQuestions !== undefined || correctAnswers !== undefined)) {
            // 处理测验完成摘要，不记录具体题目
            const summary = {
                completedQuestions: completedQuestions || req.body.completed_questions || 0,
                correctAnswers: correctAnswers || req.body.correct_answers || req.body.correct_count || 0,
                timeSpent: effectiveTimeSpent,
                metadata: {
                    source: 'quiz_completion',
                    timestamp: new Date().toISOString(),
                    totalQuestions: req.body.totalQuestions || req.body.total_questions || completedQuestions || 0
                }
            };
            // 创建整体测验摘要记录
            await createQuizSummaryRecord(userId, effectiveQuestionSetId, summary, transaction);
        }
        else {
            await transaction.rollback();
            return (0, responseUtils_1.sendError)(res, 400, '请求格式无效，缺少必要参数');
        }
        // 计算更新后的统计数据
        const stats = await calculateProgressStats(userId, effectiveQuestionSetId, transaction);
        // 提交事务
        await transaction.commit();
        // 发送实时更新通过Socket.IO
        try {
            const socketIo = (0, socket_1.getSocketIO)();
            if (socketIo) {
                const updateEvent = {
                    type: 'progressUpdate',
                    userId,
                    questionSetId: effectiveQuestionSetId,
                    stats,
                    timestamp: new Date().toISOString(),
                    source: 'api'
                };
                socketIo.to(`user_${userId}`).emit('progressUpdate', updateEvent);
            }
        }
        catch (socketError) {
            console.error('发送socket更新失败:', socketError);
            // 不中断响应流程
        }
        return (0, responseUtils_1.sendResponse)(res, 200, '更新进度成功', { stats });
    }
    catch (error) {
        // 回滚事务
        await transaction.rollback();
        console.error('更新进度失败:', error);
        return (0, responseUtils_1.sendError)(res, 500, '更新进度失败', error);
    }
};
exports.updateProgress = updateProgress;
/**
 * 创建或更新进度记录的辅助函数
 */
async function createOrUpdateProgressRecord(userId, questionSetId, questionId, isCorrect, timeSpent, metadata, transaction) {
    // 创建或更新进度记录
    const [progress, created] = await UserProgress_1.default.findOrCreate({
        where: {
            userId,
            questionSetId,
            questionId,
            recordType: PROGRESS_RECORD_TYPES.INDIVIDUAL_ANSWER
        },
        defaults: {
            id: (0, uuid_1.v4)(), // 为新记录生成UUID
            userId,
            questionSetId,
            questionId,
            isCorrect,
            timeSpent: timeSpent || 0,
            lastAccessed: new Date(),
            recordType: PROGRESS_RECORD_TYPES.INDIVIDUAL_ANSWER,
            metadata: JSON.stringify({
                source: 'api_direct_update',
                created: new Date().toISOString(),
                details: metadata
            })
        },
        transaction
    });
    // 如果记录已存在，更新它
    if (!created) {
        await progress.update({
            isCorrect,
            timeSpent: timeSpent || progress.timeSpent,
            lastAccessed: new Date(),
            metadata: JSON.stringify({
                source: 'api_direct_update',
                updated: new Date().toISOString(),
                previousIsCorrect: progress.isCorrect,
                previousTimeSpent: progress.timeSpent,
                details: metadata
            })
        }, { transaction });
    }
    return progress;
}
/**
 * 创建测验完成摘要记录
 */
async function createQuizSummaryRecord(userId, questionSetId, summary, transaction) {
    const summaryId = (0, uuid_1.v4)();
    // 创建一个摘要记录，标记为SESSION_SUMMARY类型
    await UserProgress_1.default.create({
        id: summaryId,
        userId,
        questionSetId,
        questionId: summaryId, // 使用生成的UUID作为虚拟questionId
        isCorrect: false, // 对于摘要记录使用false而不是null
        timeSpent: summary.timeSpent,
        lastAccessed: new Date(),
        recordType: PROGRESS_RECORD_TYPES.SESSION_SUMMARY,
        metadata: JSON.stringify(summary.metadata),
        completedQuestions: summary.completedQuestions,
        correctAnswers: summary.correctAnswers,
        totalQuestions: summary.metadata.totalQuestions || summary.completedQuestions
    }, { transaction });
    return summaryId;
}
/**
 * @desc    重置用户进度
 * @route   DELETE /api/user-progress/reset/:userId/:questionSetId
 * @access  Private
 */
const resetProgress = async (req, res) => {
    // Start transaction for atomic operations
    const transaction = await database_1.default.transaction();
    try {
        const { userId, questionSetId } = req.params;
        // Validate params
        if (!userId || !questionSetId) {
            await transaction.rollback();
            return (0, responseUtils_1.sendError)(res, 400, '缺少必要参数');
        }
        // Permission check
        if (!checkPermission(req, userId)) {
            await transaction.rollback();
            return (0, responseUtils_1.sendError)(res, 403, '无权重置此用户的进度');
        }
        // Count records to be deleted for logging
        const countToDelete = await UserProgress_1.default.count({
            where: { userId, questionSetId },
            transaction
        });
        // Delete all progress records for this user and question set
        await UserProgress_1.default.destroy({
            where: { userId, questionSetId },
            transaction
        });
        // Commit transaction
        await transaction.commit();
        // Send real-time update via Socket.IO
        try {
            const socketIo = (0, socket_1.getSocketIO)();
            if (socketIo) {
                const updateEvent = {
                    type: 'progressReset',
                    userId,
                    questionSetId,
                    timestamp: new Date().toISOString(),
                    source: 'api'
                };
                socketIo.to(`user_${userId}`).emit('progressUpdate', updateEvent);
            }
        }
        catch (socketError) {
            console.error('发送socket重置通知失败:', socketError);
            // Don't interrupt response flow
        }
        console.log(`[UserProgressController] 已重置用户 ${userId} 在题库 ${questionSetId} 的进度，删除了 ${countToDelete} 条记录`);
        return (0, responseUtils_1.sendResponse)(res, 200, '进度重置成功', { deletedCount: countToDelete });
    }
    catch (error) {
        // Rollback transaction on error
        await transaction.rollback();
        console.error('重置进度失败:', error);
        return (0, responseUtils_1.sendError)(res, 500, '重置进度失败', error);
    }
};
exports.resetProgress = resetProgress;
/**
 * @desc    记录详细的进度信息
 * @route   POST /api/user-progress/detailed
 * @access  Private
 */
const createDetailedProgress = async (req, res) => {
    // Start transaction for atomic operations
    const transaction = await database_1.default.transaction();
    try {
        const userId = req.user.id;
        // Process request data with robust error handling
        let { questionSetId, questionId, isCorrect, timeSpent, metadata = {} } = req.body;
        // Extract data from nested objects if present
        if (req.body.questionSet?.id) {
            questionSetId = req.body.questionSet.id;
        }
        if (req.body.question) {
            questionId = req.body.question.id || questionId;
            questionSetId = req.body.question.questionSetId || questionSetId;
        }
        if (req.body.answer) {
            isCorrect = req.body.answer.isCorrect !== undefined ? req.body.answer.isCorrect : isCorrect;
            timeSpent = req.body.answer.timeSpent || req.body.answer.time || timeSpent || 0;
        }
        if (req.body.result !== undefined) {
            isCorrect = !!req.body.result;
        }
        // Validate required params
        if (!questionSetId || !questionId || typeof isCorrect !== 'boolean') {
            await transaction.rollback();
            return (0, responseUtils_1.sendError)(res, 400, '缺少必要参数或参数类型错误');
        }
        // Prepare metadata
        const metadataObj = {
            source: 'detailed_progress_api',
            timestamp: new Date().toISOString(),
            userAgent: req.headers['user-agent'],
            ...metadata
        };
        // Create detailed progress record with record type
        const progressRecord = await UserProgress_1.default.create({
            id: (0, uuid_1.v4)(),
            userId,
            questionSetId,
            questionId,
            isCorrect,
            timeSpent: timeSpent || 0,
            lastAccessed: new Date(),
            recordType: PROGRESS_RECORD_TYPES.DETAILED_PROGRESS,
            metadata: JSON.stringify(metadataObj)
        }, { transaction });
        // Calculate statistics AFTER creating the record
        const stats = await calculateProgressStats(userId, questionSetId, transaction);
        // Commit transaction
        await transaction.commit();
        // Send real-time update via Socket.IO
        try {
            const socketIo = (0, socket_1.getSocketIO)();
            if (socketIo) {
                const updateEvent = {
                    type: 'detailedProgressCreated',
                    userId,
                    questionSetId,
                    questionId,
                    progressId: progressRecord.id,
                    isCorrect,
                    stats,
                    timestamp: new Date().toISOString(),
                    source: 'api'
                };
                socketIo.to(`user_${userId}`).emit('progressUpdate', updateEvent);
            }
        }
        catch (socketError) {
            console.error('发送socket更新失败:', socketError);
            // Don't interrupt response flow
        }
        return (0, responseUtils_1.sendResponse)(res, 201, '进度记录创建成功', { progress: progressRecord, stats });
    }
    catch (error) {
        // Rollback transaction on error
        await transaction.rollback();
        console.error('创建详细进度失败:', error);
        return (0, responseUtils_1.sendError)(res, 500, '创建详细进度失败', error);
    }
};
exports.createDetailedProgress = createDetailedProgress;
/**
 * @desc    获取详细的进度记录
 * @route   GET /api/user-progress/detailed/:userId/:questionSetId
 * @access  Private
 */
const getDetailedProgress = async (req, res) => {
    try {
        const { userId, questionSetId } = req.params;
        const { page = 1, limit = 10, sort = 'lastAccessed', order = 'desc' } = req.query;
        // Validate params
        if (!userId || !questionSetId) {
            return (0, responseUtils_1.sendError)(res, 400, '缺少必要参数');
        }
        // Permission check
        if (!checkPermission(req, userId)) {
            return (0, responseUtils_1.sendError)(res, 403, '无权访问此用户的详细进度');
        }
        // Calculate pagination params
        const pageNum = parseInt(page, 10);
        const limitNum = parseInt(limit, 10);
        const offset = (pageNum - 1) * limitNum;
        // Define sorting options
        const sortFields = ['lastAccessed', 'createdAt', 'updatedAt', 'timeSpent'];
        const sortField = sortFields.includes(sort) ? sort : 'lastAccessed';
        const sortOrder = order?.toLowerCase() === 'asc' ? 'ASC' : 'DESC';
        // Get paginated detailed progress records
        const { count, rows } = await UserProgress_1.default.findAndCountAll({
            where: {
                userId,
                questionSetId,
                recordType: PROGRESS_RECORD_TYPES.DETAILED_PROGRESS
            },
            include: [
                {
                    model: Question_1.default,
                    as: 'question',
                    attributes: ['id', 'content', 'type']
                },
                {
                    model: QuestionSet_1.default,
                    as: 'progressQuestionSet',
                    attributes: ['id', 'title']
                }
            ],
            limit: limitNum,
            offset,
            order: [[sortField, sortOrder]]
        });
        const totalPages = Math.ceil(count / limitNum);
        if (count === 0) {
            return (0, responseUtils_1.sendError)(res, 404, '未找到进度记录');
        }
        return (0, responseUtils_1.sendResponse)(res, 200, '获取详细进度成功', {
            data: rows,
            pagination: {
                total: count,
                page: pageNum,
                limit: limitNum,
                totalPages
            }
        });
    }
    catch (error) {
        console.error('获取详细进度失败:', error);
        return (0, responseUtils_1.sendError)(res, 500, '获取详细进度失败', error);
    }
};
exports.getDetailedProgress = getDetailedProgress;
/**
 * @desc    获取学习统计
 * @route   GET /api/user-progress/stats/:userId/:questionSetId
 * @access  Private
 */
const getProgressStats = async (req, res) => {
    try {
        const { userId, questionSetId } = req.params;
        // Validate params
        if (!userId || !questionSetId) {
            return (0, responseUtils_1.sendError)(res, 400, '缺少必要参数');
        }
        // Permission check
        if (!checkPermission(req, userId)) {
            return (0, responseUtils_1.sendError)(res, 403, '无权访问此用户的进度统计');
        }
        // Get user and question set to validate they exist
        const [user, questionSet] = await Promise.all([
            User_1.default.findByPk(userId),
            QuestionSet_1.default.findByPk(questionSetId)
        ]);
        if (!user) {
            return (0, responseUtils_1.sendError)(res, 404, '用户不存在');
        }
        if (!questionSet) {
            return (0, responseUtils_1.sendError)(res, 404, '题库不存在');
        }
        // Calculate statistics directly in the database
        const stats = await calculateProgressStats(userId, questionSetId);
        return (0, responseUtils_1.sendResponse)(res, 200, '获取进度统计成功', stats);
    }
    catch (error) {
        console.error('获取进度统计失败:', error);
        return (0, responseUtils_1.sendError)(res, 500, '获取进度统计失败', error);
    }
};
exports.getProgressStats = getProgressStats;
/**
 * @desc    获取用户进度统计数据
 * @route   GET /api/user-progress/stats/:userId
 * @access  Private
 */
const getUserProgressStats = async (req, res) => {
    try {
        const { userId } = req.params;
        // Validate params
        if (!userId) {
            return (0, responseUtils_1.sendError)(res, 400, '用户ID不能为空');
        }
        // Permission check
        if (!checkPermission(req, userId)) {
            return (0, responseUtils_1.sendError)(res, 403, '无权访问此用户的进度统计');
        }
        // Use SQL query to efficiently aggregate data by question set
        const query = `
      SELECT 
        up."questionSetId", 
        qs.title as "questionSetTitle",
        qs.description as "questionSetDescription",
        COUNT(DISTINCT up."questionId") as "answeredQuestions",
        COUNT(DISTINCT CASE WHEN up."isCorrect" = true THEN up."questionId" END) as "correctAnswers",
        SUM(up."timeSpent") as "totalTimeSpent",
        AVG(up."timeSpent") as "avgTimeSpent",
        MAX(up."lastAccessed") as "lastActivity"
      FROM "UserProgress" as up
      JOIN "QuestionSets" as qs ON up."questionSetId" = qs.id
      WHERE up."userId" = :userId AND up."recordType" = :recordType
      GROUP BY up."questionSetId", qs.title, qs.description
    `;
        const stats = await database_1.default.query(query, {
            replacements: {
                userId,
                recordType: PROGRESS_RECORD_TYPES.INDIVIDUAL_ANSWER
            },
            type: sequelize_1.QueryTypes.SELECT
        });
        // Get total questions for each question set
        const questionSets = await QuestionSet_1.default.findAll({
            include: [
                {
                    model: Question_1.default,
                    as: 'questions',
                    attributes: ['id']
                }
            ],
            where: {
                id: {
                    [sequelize_1.Op.in]: stats.map((stat) => stat.questionSetId)
                }
            }
        });
        // Create a map of question set ID to question count
        const questionCountMap = {};
        questionSets.forEach(set => {
            questionCountMap[set.id] = set.questions?.length || set.questionSetQuestions?.length || 0;
        });
        // Enrich statistics with additional calculated data
        const enrichedStats = stats.map((stat) => {
            const totalQuestions = questionCountMap[stat.questionSetId] || 0;
            const answeredQuestions = parseInt(stat.answeredQuestions) || 0;
            const correctAnswers = parseInt(stat.correctAnswers) || 0;
            // Calculate percentages
            const progressPercentage = totalQuestions > 0
                ? parseFloat(((answeredQuestions / totalQuestions) * 100).toFixed(2))
                : 0;
            const accuracy = answeredQuestions > 0
                ? parseFloat(((correctAnswers / answeredQuestions) * 100).toFixed(2))
                : 0;
            return {
                ...stat,
                totalQuestions,
                accuracy,
                progressPercentage,
                totalTimeSpent: parseInt(stat.totalTimeSpent) || 0,
                avgTimeSpent: parseFloat(stat.avgTimeSpent) || 0,
                lastActivity: stat.lastActivity ? new Date(stat.lastActivity).toISOString() : null
            };
        });
        return (0, responseUtils_1.sendResponse)(res, 200, '获取用户进度统计成功', enrichedStats);
    }
    catch (error) {
        console.error('获取用户统计数据失败:', error);
        return (0, responseUtils_1.sendError)(res, 500, '获取用户统计数据失败', error);
    }
};
exports.getUserProgressStats = getUserProgressStats;
/**
 * @desc    获取进度摘要
 * @route   GET /api/user-progress/summary/:userId
 * @access  Private
 */
const getProgressSummary = async (req, res) => {
    try {
        const { userId } = req.params;
        // Validate params
        if (!userId) {
            return (0, responseUtils_1.sendError)(res, 400, '用户ID不能为空');
        }
        // Permission check
        if (!checkPermission(req, userId)) {
            return (0, responseUtils_1.sendError)(res, 403, '无权访问此用户的进度摘要');
        }
        // Use efficient native SQL query to aggregate data in the database
        const query = `
      SELECT 
        "QuestionSets".id AS "questionSetId",
        "QuestionSets".title AS "questionSetTitle",
        (
          SELECT COUNT(*)
          FROM "Questions"
          WHERE "Questions"."questionSetId" = "QuestionSets".id
        ) AS "totalQuestions",
        COUNT(DISTINCT "UserProgress"."questionId") AS "completedQuestions",
        SUM(CASE WHEN "UserProgress"."isCorrect" = true THEN 1 ELSE 0 END) AS "correctAnswers",
        SUM("UserProgress"."timeSpent") AS "totalTimeSpent",
        AVG("UserProgress"."timeSpent") AS "avgTimeSpent",
        MAX("UserProgress"."lastAccessed") AS "lastActivity"
      FROM 
        "QuestionSets"
      LEFT JOIN 
        "UserProgress" ON "QuestionSets".id = "UserProgress"."questionSetId" 
        AND "UserProgress"."userId" = :userId
        AND "UserProgress"."recordType" = :recordType
      GROUP BY 
        "QuestionSets".id, "QuestionSets".title
      ORDER BY 
        "QuestionSets".title
    `;
        const summaries = await database_1.default.query(query, {
            replacements: {
                userId,
                recordType: PROGRESS_RECORD_TYPES.INDIVIDUAL_ANSWER
            },
            type: sequelize_1.QueryTypes.SELECT
        });
        // Calculate additional statistics
        const enrichedSummaries = summaries.map((summary) => {
            const totalQuestions = parseInt(summary.totalQuestions) || 0;
            const completedQuestions = parseInt(summary.completedQuestions) || 0;
            const correctAnswers = parseInt(summary.correctAnswers) || 0;
            const progress = totalQuestions > 0
                ? parseFloat(((completedQuestions / totalQuestions) * 100).toFixed(2))
                : 0;
            const accuracy = completedQuestions > 0
                ? parseFloat(((correctAnswers / completedQuestions) * 100).toFixed(2))
                : 0;
            return {
                ...summary,
                totalQuestions,
                completedQuestions,
                correctAnswers,
                progress,
                accuracy,
                totalTimeSpent: parseInt(summary.totalTimeSpent) || 0,
                avgTimeSpent: parseFloat(summary.avgTimeSpent) || 0,
                lastActivity: summary.lastActivity ? new Date(summary.lastActivity).toISOString() : null
            };
        });
        return (0, responseUtils_1.sendResponse)(res, 200, '获取进度摘要成功', enrichedSummaries);
    }
    catch (error) {
        console.error('获取进度摘要失败:', error);
        return (0, responseUtils_1.sendError)(res, 500, '获取进度摘要失败', error);
    }
};
exports.getProgressSummary = getProgressSummary;
/**
 * @desc    通过Beacon API同步用户进度
 * @route   POST /api/user-progress/beacon
 * @access  Public
 */
const syncProgressViaBeacon = async (req, res) => {
    // Note: Since this is a beacon request, we should always return 200
    // even for errors, as the browser doesn't process the response
    try {
        let data;
        const contentType = req.headers['content-type'] || '';
        // Parse request data based on content type
        if (contentType.includes('application/json')) {
            data = req.body;
        }
        else if (contentType.includes('application/x-www-form-urlencoded')) {
            data = req.body.data ? JSON.parse(req.body.data) : req.body;
        }
        else {
            // Try to parse as JSON as a fallback
            try {
                data = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
            }
            catch (e) {
                console.error('Invalid data format in beacon request:', e);
                return res.status(200).json({ success: false, message: 'Invalid data format' });
            }
        }
        // Log received data in development environment
        if (process.env.NODE_ENV === 'development') {
            console.log('[UserProgressController] Beacon data received:', JSON.stringify(data, null, 2));
        }
        // Validate required fields
        if (!data || !data.userId || !data.questionSetId || !data.progress) {
            console.error('[UserProgressController] Missing required fields in beacon data');
            return res.status(200).json({ success: false, message: 'Missing required fields' });
        }
        const { userId, questionSetId, progress, sessionId } = data;
        // Start transaction
        const transaction = await database_1.default.transaction();
        try {
            // Verify user (optional for beacon)
            let user = null;
            if (userId) {
                user = await User_1.default.findByPk(userId, { transaction });
                if (!user) {
                    console.warn(`[UserProgressController] User not found: ${userId}`);
                }
            }
            // Get question set with questions for total count
            const questionSet = await QuestionSet_1.default.findByPk(questionSetId, {
                include: [
                    {
                        model: Question_1.default,
                        as: 'questions', // Ensure this matches your model association
                        attributes: ['id']
                    }
                ],
                transaction
            });
            if (!questionSet) {
                await transaction.rollback();
                console.error(`[UserProgressController] Question set not found: ${questionSetId}`);
                return res.status(200).json({ success: false, message: 'Question set not found' });
            }
            // Calculate total questions from the association
            const totalQuestions = questionSet.questions?.length || (questionSet.questionSetQuestions?.length || 0);
            // Calculate progress statistics
            const completedQuestions = progress.length;
            const correctAnswers = progress.filter((p) => p.isCorrect).length;
            // Create or update summary record
            const summaryId = (0, uuid_1.v4)();
            const [summaryRecord, created] = await UserProgress_1.default.findOrCreate({
                where: {
                    userId,
                    questionSetId,
                    recordType: PROGRESS_RECORD_TYPES.SESSION_SUMMARY
                },
                defaults: {
                    id: summaryId,
                    userId,
                    questionSetId,
                    questionId: summaryId, // Use generated UUID as virtual questionId
                    isCorrect: false, // Use false instead of null for summary records
                    timeSpent: progress.reduce((sum, p) => sum + (p.timeSpent || 0), 0),
                    lastAccessed: new Date(),
                    recordType: PROGRESS_RECORD_TYPES.SESSION_SUMMARY,
                    metadata: JSON.stringify({
                        sessionId,
                        timestamp: new Date().toISOString(),
                        progressDetails: progress
                    }),
                    completedQuestions,
                    totalQuestions,
                    correctAnswers
                },
                transaction
            });
            // Update existing summary record if found
            if (!created) {
                // Parse existing metadata
                let metadata = {};
                try {
                    metadata = JSON.parse(summaryRecord.metadata || '{}');
                }
                catch (e) {
                    metadata = {};
                }
                // Update metadata with new progress
                const progressDetails = metadata.progressDetails || [];
                progressDetails.push(...progress);
                // Update summary record
                await summaryRecord.update({
                    timeSpent: (summaryRecord.timeSpent || 0) + progress.reduce((sum, p) => sum + (p.timeSpent || 0), 0),
                    lastAccessed: new Date(),
                    metadata: JSON.stringify({
                        ...metadata,
                        progressDetails,
                        sessionId,
                        timestamp: new Date().toISOString()
                    }),
                    completedQuestions: Math.max(completedQuestions, summaryRecord.completedQuestions || 0),
                    totalQuestions,
                    correctAnswers: Math.max(correctAnswers, summaryRecord.correctAnswers || 0)
                }, { transaction });
            }
            // Create individual progress records
            for (const item of progress) {
                const progressId = (0, uuid_1.v4)();
                await UserProgress_1.default.create({
                    id: progressId,
                    userId,
                    questionSetId,
                    questionId: item.questionId,
                    isCorrect: item.isCorrect,
                    timeSpent: item.timeSpent || 0,
                    lastAccessed: new Date(),
                    recordType: PROGRESS_RECORD_TYPES.INDIVIDUAL_ANSWER,
                    metadata: JSON.stringify({
                        sessionId,
                        timestamp: new Date().toISOString(),
                        answerDetails: item.answerDetails || {},
                        selectedOptions: item.selectedOptions || []
                    })
                }, { transaction });
            }
            // Commit transaction
            await transaction.commit();
            // Send socket notification
            try {
                const socketIo = (0, socket_1.getSocketIO)();
                if (socketIo) {
                    const updateEvent = {
                        type: 'beaconSync',
                        userId,
                        questionSetId,
                        completedQuestions,
                        totalQuestions,
                        correctAnswers,
                        timestamp: new Date().toISOString(),
                        source: 'beacon'
                    };
                    socketIo.to(`user_${userId}`).emit('progressUpdate', updateEvent);
                }
            }
            catch (socketError) {
                console.error('[UserProgressController] Socket notification failed:', socketError);
                // Don't fail the request
            }
            // Return success response (even though beacon doesn't use it)
            return res.status(200).json({ success: true });
        }
        catch (error) {
            // Rollback transaction on error
            await transaction.rollback();
            console.error('[UserProgressController] Beacon sync failed:', error);
            // Still return 200 to avoid browser warnings
            return res.status(200).json({
                success: false,
                message: 'Error processing update, but request received'
            });
        }
    }
    catch (error) {
        console.error('[UserProgressController] Beacon request processing failed:', error);
        // Still return 200 to avoid browser warnings
        return res.status(200).json({
            success: false,
            message: 'Error processing request, but request received'
        });
    }
};
exports.syncProgressViaBeacon = syncProgressViaBeacon;
/**
 * Calculate progress statistics directly in the database for better performance
 * @param userId User ID
 * @param questionSetId Question set ID
 * @param transaction Optional transaction
 * @returns Progress statistics
 */
const calculateProgressStats = async (userId, questionSetId, transaction) => {
    try {
        // Get question count from question set
        const questionSet = await QuestionSet_1.default.findByPk(questionSetId, {
            include: [{
                    model: Question_1.default,
                    as: 'questions', // Make sure this matches your model association
                    attributes: ['id']
                }],
            transaction
        });
        if (!questionSet) {
            throw new Error(`Question set not found: ${questionSetId}`);
        }
        const totalQuestions = questionSet.questions?.length || (questionSet.questionSetQuestions?.length || 0);
        // Use aggregation in database to calculate statistics
        const [progressStats] = await UserProgress_1.default.findAll({
            attributes: [
                [database_1.default.fn('COUNT', database_1.default.fn('DISTINCT', database_1.default.col('questionId'))), 'completedQuestions'],
                [database_1.default.fn('SUM', database_1.default.literal('CASE WHEN "isCorrect" = true THEN 1 ELSE 0 END')), 'correctAnswers'],
                [database_1.default.fn('COUNT', database_1.default.col('id')), 'totalAnswers'],
                [database_1.default.fn('SUM', database_1.default.col('timeSpent')), 'totalTimeSpent'],
                [database_1.default.fn('MAX', database_1.default.col('lastAccessed')), 'lastActivity']
            ],
            where: {
                userId,
                questionSetId,
                recordType: PROGRESS_RECORD_TYPES.INDIVIDUAL_ANSWER
            },
            raw: true,
            transaction
        });
        // Parse and format statistics
        const completedQuestions = parseInt(String(progressStats.completedQuestions || '0'));
        const correctAnswers = parseInt(String(progressStats.correctAnswers || '0'));
        const totalAnswers = parseInt(String(progressStats.totalAnswers || '0'));
        const totalTimeSpent = parseInt(String(progressStats.totalTimeSpent || '0'));
        const accuracy = totalAnswers > 0 ? (correctAnswers / totalAnswers) * 100 : 0;
        const averageTimeSpent = completedQuestions > 0 ? totalTimeSpent / completedQuestions : 0;
        return {
            totalQuestions,
            completedQuestions,
            correctAnswers,
            totalTimeSpent,
            averageTimeSpent,
            accuracy,
            lastActivity: progressStats.lastActivity ? new Date(progressStats.lastActivity).toISOString() : undefined
        };
    }
    catch (error) {
        console.error('Error calculating progress stats:', error);
        throw error;
    }
};
/**
 * @desc    获取用户原始进度记录
 * @route   GET /api/user-progress/records/:userId
 * @access  Private
 */
const getUserProgressRecords = async (req, res) => {
    try {
        // 优先从URL参数获取userId，如果没有则使用当前登录用户的ID
        const userId = req.params.userId || req.user?.id;
        const { page = 1, limit = 10, sort = 'lastAccessed', order = 'desc', questionSetId, isCorrect, recordType } = req.query;
        // Validate params
        if (!userId) {
            return (0, responseUtils_1.sendError)(res, 400, '缺少用户ID参数');
        }
        // Permission check
        if (!checkPermission(req, userId)) {
            return (0, responseUtils_1.sendError)(res, 403, '无权访问此用户的进度记录');
        }
        // Calculate pagination params
        const pageNum = parseInt(page, 10);
        const limitNum = parseInt(limit, 10);
        const offset = (pageNum - 1) * limitNum;
        // Define sorting options
        const sortFields = ['lastAccessed', 'createdAt', 'updatedAt', 'timeSpent', 'isCorrect'];
        const sortField = sortFields.includes(sort) ? sort : 'lastAccessed';
        const sortOrder = order?.toLowerCase() === 'asc' ? 'ASC' : 'DESC';
        // Build where clause
        const whereClause = { userId };
        if (questionSetId) {
            whereClause.questionSetId = questionSetId;
        }
        if (isCorrect !== undefined) {
            whereClause.isCorrect = isCorrect === 'true';
        }
        if (recordType) {
            whereClause.recordType = recordType;
        }
        // 修复：使用正确的列名 (text 和 questionType) 替代 (content 和 type)
        const { count, rows } = await UserProgress_1.default.findAndCountAll({
            where: whereClause,
            include: [
                {
                    model: QuestionSet_1.default,
                    as: 'progressQuestionSet',
                    attributes: ['id', 'title']
                },
                {
                    model: Question_1.default,
                    as: 'question',
                    // 更新列名，使用正确的字段名
                    attributes: ['id', ['text', 'content'], ['questionType', 'type']]
                }
            ],
            limit: limitNum,
            offset,
            order: [[sortField, sortOrder]]
        });
        const totalPages = Math.ceil(count / limitNum);
        return (0, responseUtils_1.sendResponse)(res, 200, '获取进度记录成功', {
            data: rows,
            pagination: {
                total: count,
                page: pageNum,
                limit: limitNum,
                totalPages
            }
        });
    }
    catch (error) {
        console.error('获取用户进度记录失败:', error);
        return (0, responseUtils_1.sendError)(res, 500, '获取用户进度记录失败', error);
    }
};
exports.getUserProgressRecords = getUserProgressRecords;
/**
 * @desc    删除进度记录
 * @route   DELETE /api/user-progress/:userId/:progressId
 * @access  Private
 */
const deleteProgressRecord = async (req, res) => {
    // Start transaction for atomic operations
    const transaction = await database_1.default.transaction();
    try {
        const { userId, progressId } = req.params;
        // Validate params
        if (!userId || !progressId) {
            await transaction.rollback();
            return (0, responseUtils_1.sendError)(res, 400, '缺少必要参数');
        }
        // Permission check
        if (!checkPermission(req, userId)) {
            await transaction.rollback();
            return (0, responseUtils_1.sendError)(res, 403, '无权删除此用户的进度记录');
        }
        // Find the progress record
        const progress = await UserProgress_1.default.findOne({
            where: { id: progressId, userId },
            transaction
        });
        if (!progress) {
            await transaction.rollback();
            return (0, responseUtils_1.sendError)(res, 404, '进度记录不存在');
        }
        const questionSetId = progress.questionSetId;
        // Delete the progress record
        await progress.destroy({ transaction });
        // Calculate updated statistics
        const stats = await calculateProgressStats(userId, questionSetId, transaction);
        // Commit transaction
        await transaction.commit();
        // Send real-time update via Socket.IO
        try {
            const socketIo = (0, socket_1.getSocketIO)();
            if (socketIo) {
                const updateEvent = {
                    type: 'progressDeleted',
                    userId,
                    questionSetId,
                    progressId,
                    stats,
                    timestamp: new Date().toISOString(),
                    source: 'api'
                };
                socketIo.to(`user_${userId}`).emit('progressUpdate', updateEvent);
            }
        }
        catch (socketError) {
            console.error('发送socket更新失败:', socketError);
            // Don't interrupt response flow
        }
        return (0, responseUtils_1.sendResponse)(res, 200, '进度记录删除成功', { stats });
    }
    catch (error) {
        // Rollback transaction on error
        await transaction.rollback();
        console.error('删除进度记录失败:', error);
        return (0, responseUtils_1.sendError)(res, 500, '删除进度记录失败', error);
    }
};
exports.deleteProgressRecord = deleteProgressRecord;
/**
 * @desc    提交测验结果（替代接口，针对没有updateProgress权限的情况）
 * @route   POST /api/quiz/submit
 * @access  Public
 */
const quizSubmit = async (req, res) => {
    // 开始事务
    const transaction = await database_1.default.transaction();
    try {
        // 从请求体中获取数据，支持多种格式
        const userId = req.user?.id || req.body.userId || req.body.user_id;
        const questionSetId = req.body.questionSetId || req.body.question_set_id || req.body.quizId;
        const completedQuestions = req.body.completedQuestions || req.body.completed_questions || req.body.total_questions || 0;
        const correctAnswers = req.body.correctAnswers || req.body.correct_answers || req.body.correct_count || 0;
        const timeSpent = req.body.timeSpent || req.body.time_spent || 0;
        const answerDetails = req.body.answerDetails || req.body.answers || [];
        // 验证必要参数
        if (!userId || !questionSetId) {
            await transaction.rollback();
            return (0, responseUtils_1.sendError)(res, 400, '缺少必要参数：userId和questionSetId');
        }
        // 获取用户和题库信息（如果存在）
        let user = null;
        let questionSet = null;
        try {
            user = await User_1.default.findByPk(userId, { transaction });
            questionSet = await QuestionSet_1.default.findByPk(questionSetId, { transaction });
        }
        catch (e) {
            console.warn(`[quizSubmit] 无法验证用户或题库: ${e.message}`);
            // 继续处理，即使用户或题库不存在
        }
        // 记录测验摘要信息
        const summaryId = await createQuizSummaryRecord(userId, questionSetId, {
            completedQuestions,
            correctAnswers,
            timeSpent,
            metadata: {
                source: 'quiz_submit_endpoint',
                timestamp: new Date().toISOString(),
                details: req.body,
                userAgent: req.headers['user-agent'],
                totalQuestions: req.body.totalQuestions || completedQuestions
            }
        }, transaction);
        // 如果提供了详细的答题记录，也保存每道题的答题情况
        if (Array.isArray(answerDetails) && answerDetails.length > 0) {
            for (const answer of answerDetails) {
                const questionId = answer.questionId || answer.question_id;
                const isCorrect = answer.isCorrect || answer.is_correct;
                const answerTimeSpent = answer.timeSpent || answer.time_spent || 0;
                if (questionId && typeof isCorrect === 'boolean') {
                    await createOrUpdateProgressRecord(userId, questionSetId, questionId, isCorrect, answerTimeSpent, answer, transaction);
                }
            }
        }
        // 计算更新后的统计数据
        let stats = undefined;
        try {
            stats = await calculateProgressStats(userId, questionSetId, transaction);
        }
        catch (e) {
            console.warn(`[quizSubmit] 计算统计数据失败: ${e.message}`);
            // 继续处理，即使计算统计数据失败
        }
        // 创建购买记录或更新其他相关系统状态
        // (这里可以添加其他必要的业务逻辑)
        // 提交事务
        await transaction.commit();
        // 发送实时更新通过Socket.IO
        try {
            const socketIo = (0, socket_1.getSocketIO)();
            if (socketIo) {
                const updateEvent = {
                    type: 'quizSubmitted',
                    userId,
                    questionSetId,
                    stats,
                    completedQuestions,
                    totalQuestions: req.body.totalQuestions || completedQuestions,
                    correctAnswers,
                    timestamp: new Date().toISOString(),
                    source: 'quiz_submit'
                };
                socketIo.to(`user_${userId}`).emit('quizSubmitted', updateEvent);
            }
        }
        catch (socketError) {
            console.error('发送socket更新失败:', socketError);
            // 不中断响应流程
        }
        return (0, responseUtils_1.sendResponse)(res, 200, '测验提交成功', {
            summaryId,
            stats,
            message: '测验结果已保存，感谢您的参与'
        });
    }
    catch (error) {
        // 回滚事务
        await transaction.rollback();
        console.error('提交测验失败:', error);
        return (0, responseUtils_1.sendError)(res, 500, '提交测验失败', error);
    }
};
exports.quizSubmit = quizSubmit;
// 修改导出，确保包含所有必要的函数
exports.default = {
    PROGRESS_RECORD_TYPES,
    checkPermission,
    calculateProgressStats,
    getUserProgress: exports.getUserProgress,
    getProgressByQuestionSetId: exports.getProgressByQuestionSetId,
    getDetailedProgress: exports.getDetailedProgress,
    updateProgress: exports.updateProgress,
    resetProgress: exports.resetProgress,
    createDetailedProgress: exports.createDetailedProgress,
    getUserProgressRecords: exports.getUserProgressRecords,
    getUserProgressStats: exports.getUserProgressStats,
    getProgressStats: exports.getProgressStats,
    getProgressSummary: exports.getProgressSummary,
    syncProgressViaBeacon: exports.syncProgressViaBeacon,
    deleteProgressRecord: exports.deleteProgressRecord,
    quizSubmit: exports.quizSubmit // 添加新的quizSubmit函数
};
