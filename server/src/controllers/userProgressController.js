const UserProgress = require('../models/UserProgress');
const QuestionSet = require('../models/QuestionSet');
const User = require('../models/User');
const Question = require('../models/Question');
const { Op } = require('sequelize');
const sequelize = require('../config/database');
const { v4: uuidv4 } = require('uuid');
const { getSocketIO } = require('../socket');

/**
 * UserProgress 表结构说明
 * 
 * 字段:
 * - id: UUID, 主键
 * - userId: UUID, 用户ID，外键关联到用户表
 * - questionSetId: UUID, 题库ID，外键关联到题库表
 * - questionId: UUID, 题目ID，外键关联到题目表 (对于汇总记录可能是生成的ID)
 * - isCorrect: boolean, 是否正确回答
 * - timeSpent: integer, 花费时间(毫秒)
 * - lastAccessed: Date, 最后访问时间
 * - recordType: string, 记录类型，通过PROGRESS_RECORD_TYPES枚举定义
 * - metadata: text/json, 存储额外信息如答题详情等
 * - completedQuestions: integer, 完成的题目数量 (对于汇总记录)
 * - totalQuestions: integer, 总题目数量 (对于汇总记录)
 * - correctAnswers: integer, 正确答题数量 (对于汇总记录)
 * - createdAt: Date, 创建时间
 * - updatedAt: Date, 更新时间
 * 
 * 注: 如果表结构与上述不符，请相应调整代码实现
 */

/**
 * Progress record types - helps distinguish between different recording strategies
 */
const PROGRESS_RECORD_TYPES = {
  INDIVIDUAL_ANSWER: 'individual_answer', // Individual question answer
  DETAILED_PROGRESS: 'detailed_progress', // Detailed progress with metadata
  SESSION_SUMMARY: 'session_summary',     // Summary of a session (beacon API)
  AGGREGATED: 'aggregated'                // Aggregated stats
};

/**
 * 检查用户权限
 * @param {Object} req - 请求对象
 * @param {string} targetUserId - 目标用户ID
 * @returns {boolean} - 是否有权限
 */
const checkPermission = (req, targetUserId) => {
  // 确保用户已登录
  if (!req.user || !req.user.id) {
    return false;
  }
  
  // 管理员可以访问所有用户的数据
  if (req.user.isAdmin || req.user.role === 'admin') {
    return true;
  }
  
  // 普通用户只能访问自己的数据
  return req.user.id === targetUserId;
};

/**
 * @desc    重置用户特定题库的进度
 * @route   DELETE /api/user-progress/reset/:userId/:questionSetId
 * @access  Private
 */
const resetProgress = async (req, res) => {
  const transaction = await sequelize.transaction();
  
  try {
    const { userId, questionSetId } = req.params;
    
    // 校验参数
    if (!userId || !questionSetId) {
      return res.status(400).json({ success: false, message: '缺少必要参数' });
    }
    
    // 权限检查
    if (!checkPermission(req, userId)) {
      return res.status(403).json({ success: false, message: '无权重置此用户的进度' });
    }
    
    // 删除该用户该题库的所有进度记录
    const deletedCount = await UserProgress.destroy({
      where: {
        userId,
        questionSetId
      },
      transaction
    });
    
    await transaction.commit();
    
    // 通过Socket.IO发送更新通知
    const io = getSocketIO();
    if (io) {
      io.to(`user_${userId}`).emit('progressUpdate', {
        type: 'progressReset',
        userId,
        questionSetId,
        timestamp: new Date().toISOString(),
        source: 'api'
      });
    }
    
    console.log(`[UserProgressController] 已重置用户 ${userId} 在题库 ${questionSetId} 的进度，删除了 ${deletedCount} 条记录`);
    
    return res.json({
      success: true,
      message: `成功重置进度，共删除${deletedCount}条记录`,
      deletedCount
    });
  } catch (error) {
    await transaction.rollback();
    console.error('[UserProgressController] 重置进度失败:', error.stack);
    return res.status(500).json({ 
      success: false, 
      message: '重置进度失败', 
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

/**
 * @desc    获取用户所有进度
 * @route   GET /api/user-progress/:userId
 * @access  Private
 */
const getUserProgress = async (req, res) => {
  try {
    const { userId } = req.params;
    
    // 校验参数
    if (!userId) {
      return res.status(400).json({ success: false, message: '缺少用户ID参数' });
    }
    
    // 权限检查
    if (!checkPermission(req, userId)) {
      return res.status(403).json({ success: false, message: '无权访问此用户的进度' });
    }
    
    // 查询用户进度
    const progress = await UserProgress.findAll({
      where: { userId },
      include: [
        {
          model: QuestionSet,
          as: 'progressQuestionSet',
          attributes: ['id', 'title']
        }
      ]
    });
    
    return res.json({
      success: true,
      data: progress
    });
  } catch (error) {
    console.error('[UserProgressController] 获取用户进度失败:', error.stack);
    return res.status(500).json({ 
      success: false, 
      message: '获取用户进度失败', 
      error: error.message 
    });
  }
};

/**
 * @desc    获取特定题库的用户进度
 * @route   GET /api/user-progress/:userId/:questionSetId
 * @access  Private
 */
const getProgressByQuestionSetId = async (req, res) => {
  try {
    const { userId, questionSetId } = req.params;
    
    // 校验参数
    if (!userId || !questionSetId) {
      return res.status(400).json({ success: false, message: '缺少必要参数' });
    }
    
    // 权限检查
    if (!checkPermission(req, userId)) {
      return res.status(403).json({ success: false, message: '无权访问此用户的进度' });
    }
    
    // 查询用户在指定题库的进度
    const progress = await UserProgress.findAll({
      where: { userId, questionSetId },
      include: [
        { 
          model: QuestionSet, 
          as: 'progressQuestionSet' 
        },
        { 
          model: Question, 
          as: 'question' 
        }
      ]
    });
    
    if (!progress || progress.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: '找不到进度记录' 
      });
    }
    
    return res.json({
      success: true,
      data: progress
    });
  } catch (error) {
    console.error('[UserProgressController] 获取题库进度失败:', error.stack);
    return res.status(500).json({ 
      success: false, 
      message: '获取题库进度失败', 
      error: error.message 
    });
  }
};

/**
 * @desc    更新用户进度
 * @route   POST /api/user-progress/update
 * @access  Private
 */
const updateUserProgress = async (req, res) => {
  const transaction = await sequelize.transaction();
  
  try {
    const userId = req.user?.id;
    const { questionSetId, questionId, isCorrect, timeSpent } = req.body;
    
    // 验证必要参数
    if (!userId || !questionSetId || !questionId || typeof isCorrect !== 'boolean') {
      return res.status(400).json({ 
        success: false, 
        message: '缺少必要参数或参数类型错误' 
      });
    }
    
    // 检查用户权限
    if (!checkPermission(req, userId)) {
      return res.status(403).json({ success: false, message: '无权更新此用户的进度' });
    }
    
    // 创建或更新进度记录
    const [progress, created] = await UserProgress.findOrCreate({
      where: {
        userId,
        questionSetId,
        questionId,
        recordType: PROGRESS_RECORD_TYPES.INDIVIDUAL_ANSWER
      },
      defaults: {
        id: uuidv4(),
        userId,
        questionSetId,
        questionId,
        isCorrect,
        timeSpent: timeSpent || 0,
        lastAccessed: new Date(),
        recordType: PROGRESS_RECORD_TYPES.INDIVIDUAL_ANSWER,
        metadata: JSON.stringify({ 
          source: 'api_direct_update',
          created: new Date().toISOString()
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
          previousTimeSpent: progress.timeSpent
        })
      }, { transaction });
    }
    
    // 在更新记录后计算最新的统计数据
    const stats = await calculateProgressStats(userId, questionSetId, transaction);
    
    await transaction.commit();
    
    // 发送socket更新
    try {
      const io = getSocketIO();
      if (io) {
        const progressUpdateEvent = {
          type: 'progressUpdate',
          userId,
          questionSetId,
          questionId,
          isCorrect,
          timeSpent: timeSpent || 0,
          stats,
          timestamp: new Date().toISOString(),
          source: 'api'
        };
        
        io.to(`user_${userId}`).emit('progressUpdate', progressUpdateEvent);
      }
    } catch (socketError) {
      console.error('[UserProgressController] 发送socket更新失败:', socketError.stack);
      // 不中断响应流程
    }
    
    return res.json({
      success: true,
      message: '进度更新成功',
      data: progress,
      stats
    });
  } catch (error) {
    await transaction.rollback();
    console.error('[UserProgressController] 更新进度失败:', error.stack);
    return res.status(500).json({ 
      success: false, 
      message: '进度更新失败', 
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

/**
 * @desc    更新特定进度记录
 * @route   PUT /api/user-progress/:id
 * @access  Private
 */
const updateProgress = async (req, res) => {
  const transaction = await sequelize.transaction();
  
  try {
    const { id } = req.params;
    const { isCorrect, timeSpent, metadata, lastAccessed } = req.body;
    
    // 校验参数
    if (!id) {
      return res.status(400).json({ success: false, message: '缺少记录ID参数' });
    }
    
    // 查找记录
    const record = await UserProgress.findByPk(id);
    
    if (!record) {
      return res.status(404).json({ success: false, message: '记录不存在' });
    }
    
    // 权限检查
    if (!checkPermission(req, record.userId)) {
      return res.status(403).json({ success: false, message: '无权更新此记录' });
    }
    
    // 准备更新数据
    const updateData = {};
    
    if (isCorrect !== undefined) updateData.isCorrect = isCorrect;
    if (timeSpent !== undefined) updateData.timeSpent = timeSpent;
    if (lastAccessed !== undefined) updateData.lastAccessed = lastAccessed;
    
    // 处理元数据
    if (metadata !== undefined) {
      // 如果元数据是对象，将其转换为字符串
      updateData.metadata = typeof metadata === 'string' ? metadata : JSON.stringify(metadata);
    }
    
    // 更新记录
    await record.update(updateData, { transaction });
    
    // 更新后计算统计数据
    const stats = await calculateProgressStats(record.userId, record.questionSetId, transaction);
    
    await transaction.commit();
    
    // 通过Socket.IO发送更新通知
    const io = getSocketIO();
    if (io) {
      io.to(`user_${record.userId}`).emit('progressUpdate', {
        type: 'progressUpdated',
        userId: record.userId,
        questionSetId: record.questionSetId,
        questionId: record.questionId,
        progressId: id,
        isCorrect: record.isCorrect,
        stats,
        timestamp: new Date().toISOString(),
        source: 'api'
      });
    }
    
    return res.json({
      success: true,
      message: '记录更新成功',
      data: await UserProgress.findByPk(id),
      stats
    });
  } catch (error) {
    await transaction.rollback();
    console.error('[UserProgressController] 更新进度记录失败:', error.stack);
    return res.status(500).json({ 
      success: false, 
      message: '更新进度记录失败', 
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

/**
 * 计算进度统计数据
 * @param {string} userId 用户ID
 * @param {string} questionSetId 题库ID
 * @param {Transaction} transaction Sequelize事务对象
 * @returns {Object} 统计数据
 */
const calculateProgressStats = async (userId, questionSetId, transaction) => {
  try {
    // 使用聚合查询计算统计数据，而不是加载所有记录
    const [totalStats] = await UserProgress.findAll({
      attributes: [
        [sequelize.fn('COUNT', sequelize.col('id')), 'totalAnswered'],
        [sequelize.fn('SUM', sequelize.literal('CASE WHEN "isCorrect" = true THEN 1 ELSE 0 END')), 'correctAnswers'],
        [sequelize.fn('SUM', sequelize.col('timeSpent')), 'totalTimeSpent']
      ],
      where: {
        userId,
        questionSetId
      },
      raw: true,
      transaction
    });
    
    // 获取题库中的题目总数
    const questionSet = await QuestionSet.findByPk(questionSetId, {
      attributes: ['id', 'title'],
      include: [{
        model: Question,
        as: 'questionSetQuestions',
        attributes: ['id'],
      }],
      transaction
    });
    
    const totalQuestions = questionSet?.questionSetQuestions?.length || 0;
    const totalAnswered = parseInt(totalStats.totalAnswered) || 0;
    const correctAnswers = parseInt(totalStats.correctAnswers) || 0;
    const totalTimeSpent = parseInt(totalStats.totalTimeSpent) || 0;
    
    // 计算统计指标
    const averageTimeSpent = totalAnswered > 0 ? totalTimeSpent / totalAnswered : 0;
    const accuracy = totalAnswered > 0 ? (correctAnswers / totalAnswered) * 100 : 0;
    
    return {
      totalQuestions,
      totalAnswered,
      completedQuestions: totalAnswered, // 为保持后向兼容
      correctAnswers,
      totalTimeSpent,
      averageTimeSpent,
      accuracy
    };
  } catch (error) {
    console.error('[UserProgressController] 计算进度统计数据失败:', error.stack);
    throw error; // 向上抛出错误，让调用者处理
  }
};

/**
 * @desc    创建详细进度记录
 * @route   POST /api/user-progress/detailed
 * @access  Private
 */
const createDetailedProgress = async (req, res) => {
  const transaction = await sequelize.transaction();
  
  try {
    const { userId, questionSetId, questionId, isCorrect, timeSpent, metadata } = req.body;
    
    // 校验参数
    if (!userId || !questionSetId || !questionId) {
      return res.status(400).json({ success: false, message: '缺少必要参数' });
    }
    
    // 权限检查
    if (!checkPermission(req, userId)) {
      return res.status(403).json({ success: false, message: '无权为此用户创建进度' });
    }
    
    // 验证用户和题库是否存在
    const [user, questionSet] = await Promise.all([
      User.findByPk(userId),
      QuestionSet.findByPk(questionSetId)
    ]);
    
    if (!user) {
      return res.status(404).json({ success: false, message: '用户不存在' });
    }
    
    if (!questionSet) {
      return res.status(404).json({ success: false, message: '题库不存在' });
    }
    
    // 创建详细进度记录
    const progressId = uuidv4();
    const progress = await UserProgress.create({
      id: progressId,
      userId,
      questionSetId,
      questionId,
      isCorrect,
      timeSpent,
      lastAccessed: new Date(),
      recordType: PROGRESS_RECORD_TYPES.DETAILED_PROGRESS,
      metadata: typeof metadata === 'string' ? metadata : JSON.stringify(metadata || {})
    }, { transaction });
    
    await transaction.commit();
    
    // 通过Socket.IO发送更新通知
    const io = getSocketIO();
    if (io) {
      io.to(`user_${userId}`).emit('progressUpdate', {
        type: 'detailedProgressCreated',
        userId,
        questionSetId,
        questionId,
        progressId: progress.id,
        isCorrect,
        timestamp: new Date().toISOString(),
        source: 'api'
      });
    }
    
    return res.status(201).json({
      success: true,
      message: '进度记录创建成功',
      data: progress
    });
  } catch (error) {
    await transaction.rollback();
    console.error('[UserProgressController] 创建详细进度失败:', error.stack);
    return res.status(500).json({ 
      success: false, 
      message: '创建详细进度失败', 
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

/**
 * @desc    获取用户详细进度记录
 * @route   GET /api/user-progress/detailed/:userId/:questionSetId
 * @access  Private
 */
const getDetailedProgress = async (req, res) => {
  try {
    const { userId, questionSetId } = req.params;
    const { page = 1, limit = 10 } = req.query;
    
    // 校验参数
    if (!userId || !questionSetId) {
      return res.status(400).json({ success: false, message: '缺少必要参数' });
    }
    
    // 权限检查
    if (!checkPermission(req, userId)) {
      return res.status(403).json({ success: false, message: '无权访问此用户的详细进度' });
    }
    
    // 计算分页参数
    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);
    const offset = (pageNum - 1) * limitNum;
    
    // 查询详细进度记录
    const { count, rows } = await UserProgress.findAndCountAll({
      where: {
        userId,
        questionSetId,
        recordType: PROGRESS_RECORD_TYPES.DETAILED_PROGRESS
      },
      include: [
        {
          model: Question,
          as: 'question',
          attributes: ['id', 'content', 'type']
        },
        {
          model: QuestionSet,
          as: 'progressQuestionSet',
          attributes: ['id', 'title']
        }
      ],
      limit: limitNum,
      offset,
      order: [['lastAccessed', 'DESC']]
    });
    
    const totalPages = Math.ceil(count / limitNum);
    
    return res.json({
      success: true,
      data: rows,
      pagination: {
        total: count,
        page: pageNum,
        limit: limitNum,
        totalPages
      }
    });
  } catch (error) {
    console.error('[UserProgressController] 获取详细进度失败:', error.stack);
    return res.status(500).json({ 
      success: false, 
      message: '获取详细进度失败', 
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

/**
 * @desc    获取用户进度统计
 * @route   GET /api/user-progress/statistics/:userId/:questionSetId
 * @access  Private
 */
const getProgressStats = async (req, res) => {
  try {
    const { userId, questionSetId } = req.params;
    
    // 校验参数
    if (!userId || !questionSetId) {
      return res.status(400).json({ success: false, message: '缺少必要参数' });
    }
    
    // 权限检查
    if (!checkPermission(req, userId)) {
      return res.status(403).json({ success: false, message: '无权访问此用户的进度统计' });
    }
    
    // 查询用户和题库是否存在
    const [user, questionSet] = await Promise.all([
      User.findByPk(userId),
      QuestionSet.findByPk(questionSetId, {
        include: [{ model: Question, as: 'questions', attributes: ['id'] }]
      })
    ]);
    
    if (!user) {
      return res.status(404).json({ success: false, message: '用户不存在' });
    }
    
    if (!questionSet) {
      return res.status(404).json({ success: false, message: '题库不存在' });
    }
    
    // 题库总题目数
    const totalQuestions = questionSet.questions ? questionSet.questions.length : 0;
    
    // 使用Sequelize进行聚合查询
    const stats = await UserProgress.findAll({
      attributes: [
        [sequelize.fn('COUNT', sequelize.col('id')), 'totalAnswers'],
        [sequelize.fn('COUNT', sequelize.fn('DISTINCT', sequelize.col('questionId'))), 'uniqueQuestionsAnswered'],
        [sequelize.fn('SUM', sequelize.literal('CASE WHEN "isCorrect" = true THEN 1 ELSE 0 END')), 'correctAnswers'],
        [sequelize.fn('SUM', sequelize.col('timeSpent')), 'totalTimeSpent'],
        [sequelize.fn('MAX', sequelize.col('lastAccessed')), 'lastActivity']
      ],
      where: {
        userId,
        questionSetId,
        recordType: PROGRESS_RECORD_TYPES.INDIVIDUAL_ANSWER
      }
    });
    
    // 格式化结果
    const statsData = stats[0].get({ plain: true });
    
    // 计算额外统计指标
    const uniqueQuestionsAnswered = parseInt(statsData.uniqueQuestionsAnswered) || 0;
    const correctAnswers = parseInt(statsData.correctAnswers) || 0;
    const totalAnswers = parseInt(statsData.totalAnswers) || 0;
    
    const progressPercentage = totalQuestions > 0 
      ? parseFloat(((uniqueQuestionsAnswered / totalQuestions) * 100).toFixed(2)) 
      : 0;
      
    const accuracy = totalAnswers > 0 
      ? parseFloat(((correctAnswers / totalAnswers) * 100).toFixed(2)) 
      : 0;
    
    const averageTimePerQuestion = uniqueQuestionsAnswered > 0 
      ? Math.round(statsData.totalTimeSpent / uniqueQuestionsAnswered) 
      : 0;
    
    // 返回完整统计信息
    return res.json({
      success: true,
      data: {
        totalQuestions,
        uniqueQuestionsAnswered,
        correctAnswers,
        totalAnswers,
        progressPercentage,
        accuracy,
        totalTimeSpent: statsData.totalTimeSpent || 0,
        averageTimePerQuestion,
        lastActivity: statsData.lastActivity,
        questionSetTitle: questionSet.title
      }
    });
  } catch (error) {
    console.error('[UserProgressController] 获取进度统计失败:', error.stack);
    return res.status(500).json({ 
      success: false, 
      message: '获取进度统计失败', 
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

/**
 * @desc    删除进度记录
 * @route   DELETE /api/user-progress/:id
 * @access  Private
 */
const deleteProgressRecord = async (req, res) => {
  const transaction = await sequelize.transaction();
  
  try {
    const { id } = req.params;
    
    // 校验参数
    if (!id) {
      return res.status(400).json({ success: false, message: '缺少记录ID参数' });
    }
    
    // 查找记录
    const record = await UserProgress.findByPk(id);
    
    if (!record) {
      return res.status(404).json({ success: false, message: '记录不存在' });
    }
    
    // 权限检查
    if (!checkPermission(req, record.userId)) {
      return res.status(403).json({ success: false, message: '无权删除此记录' });
    }
    
    // 删除记录
    await record.destroy({ transaction });
    
    await transaction.commit();
    
    // 通过Socket.IO发送更新通知
    const io = getSocketIO();
    if (io) {
      io.to(`user_${record.userId}`).emit('progressUpdate', {
        type: 'progressDeleted',
        userId: record.userId,
        questionSetId: record.questionSetId,
        progressId: id,
        timestamp: new Date().toISOString(),
        source: 'api'
      });
    }
    
    return res.json({
      success: true,
      message: '记录删除成功',
      deletedId: id
    });
  } catch (error) {
    await transaction.rollback();
    console.error('[UserProgressController] 删除进度记录失败:', error.stack);
    return res.status(500).json({ 
      success: false, 
      message: '删除进度记录失败', 
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

/**
 * @desc    获取进度摘要
 * @route   GET /api/user-progress/summary/:userId
 * @access  Private
 */
const getProgressSummary = async (req, res) => {
  try {
    const { userId } = req.params;
    
    // 校验参数
    if (!userId) {
      return res.status(400).json({ success: false, message: '缺少用户ID参数' });
    }
    
    // 权限检查
    if (!checkPermission(req, userId)) {
      return res.status(403).json({ success: false, message: '无权访问此用户的进度摘要' });
    }
    
    // 使用Sequelize模型名称和字段名进行查询，确保与数据库结构一致
    // 注意：请确认以下表名和字段名与实际数据库模型定义匹配
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
        "UserProgress" ON "QuestionSets".id = "UserProgress"."questionSetId" AND "UserProgress"."userId" = :userId
      GROUP BY 
        "QuestionSets".id, "QuestionSets".title
      ORDER BY 
        "QuestionSets".title
    `;
    
    const summaries = await sequelize.query(query, {
      replacements: { userId },
      type: sequelize.QueryTypes.SELECT
    });
    
    // 计算额外统计指标
    const enrichedSummaries = summaries.map(summary => {
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
        avgTimeSpent: parseInt(summary.avgTimeSpent) || 0
      };
    });
    
    return res.json({
      success: true,
      data: enrichedSummaries
    });
  } catch (error) {
    console.error('[UserProgressController] 获取进度摘要失败:', error.stack);
    return res.status(500).json({ 
      success: false, 
      message: '获取进度摘要失败', 
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

/**
 * @desc    获取用户原始进度记录
 * @route   GET /api/user-progress/records/:userId
 * @access  Private
 */
const getUserProgressRecords = async (req, res) => {
  try {
    const { userId } = req.params;
    const { 
      page = 1, 
      limit = 10, 
      sort = 'lastAccessed', 
      order = 'desc',
      questionSetId 
    } = req.query;
    
    // 校验参数
    if (!userId) {
      return res.status(400).json({ success: false, message: '缺少用户ID参数' });
    }
    
    // 权限检查
    if (!checkPermission(req, userId)) {
      return res.status(403).json({ success: false, message: '无权访问此用户的进度记录' });
    }
    
    // 构建查询条件
    const whereClause = { userId };
    if (questionSetId) {
      whereClause.questionSetId = questionSetId;
    }
    
    // 计算分页参数
    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);
    const offset = (pageNum - 1) * limitNum;
    
    // 安全的排序映射
    const sortFieldMap = {
      'lastAccessed': 'lastAccessed',
      'createdAt': 'createdAt',
      'updatedAt': 'updatedAt',
      'timeSpent': 'timeSpent',
      'isCorrect': 'isCorrect'
    };
    
    // 使用映射获取排序字段，提供默认值
    const sortField = sortFieldMap[sort] || 'lastAccessed';
    const sortOrder = order.toLowerCase() === 'asc' ? 'ASC' : 'DESC';
    
    // 查询进度记录
    const { count, rows } = await UserProgress.findAndCountAll({
      where: whereClause,
      include: [
        {
          model: QuestionSet,
          as: 'progressQuestionSet',
          attributes: ['id', 'title']
        },
        {
          model: Question,
          as: 'question',
          attributes: ['id', 'content', 'type']
        }
      ],
      limit: limitNum,
      offset,
      order: [[sortField, sortOrder]]
    });
    
    const totalPages = Math.ceil(count / limitNum);
    
    return res.json({
      success: true,
      data: rows,
      pagination: {
        total: count,
        page: pageNum,
        limit: limitNum,
        totalPages
      }
    });
  } catch (error) {
    console.error('[UserProgressController] 获取用户进度记录失败:', error.stack);
    return res.status(500).json({ 
      success: false, 
      message: '获取用户进度记录失败', 
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

/**
 * @desc    通过Beacon API同步用户进度
 * @route   POST /api/user-progress/beacon
 * @access  Public
 */
const syncProgressViaBeacon = async (req, res) => {
  // 由于这是通过Navigator.sendBeacon发送的请求，我们可能不能标准响应
  // Beacon API是单向通信，浏览器不期望响应
  try {
    let data;
    const contentType = req.headers['content-type'] || '';
    
    // 根据内容类型解析数据
    if (contentType.includes('application/json')) {
      data = req.body;
    } else if (contentType.includes('application/x-www-form-urlencoded')) {
      data = req.body.data ? JSON.parse(req.body.data) : req.body;
    } else {
      // 尝试解析为JSON，如果失败则使用原始body
      try {
        data = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      } catch (e) {
        data = req.body;
      }
    }
    
    // 记录接收到的数据（开发环境）
    if (process.env.NODE_ENV === 'development') {
      console.log('[UserProgressController] 收到beacon数据:', JSON.stringify(data, null, 2));
    }
    
    // 校验必要字段
    if (!data || !data.userId || !data.questionSetId || !data.progress) {
      console.error('[UserProgressController] Beacon数据缺少必要字段');
      return res.status(400).end();
    }
    
    const { userId, questionSetId, progress, sessionId } = data;
    
    // 验证用户是否存在（可选，Beacon可能允许匿名）
    let user = null;
    if (userId) {
      user = await User.findByPk(userId);
      if (!user) {
        console.warn(`[UserProgressController] 用户ID不存在: ${userId}`);
      }
    }
    
    // 获取题库信息以及计算总题目数
    const questionSet = await QuestionSet.findByPk(questionSetId, {
      include: [
        {
          model: Question,
          as: 'questions', // 确保这里的关联名称与Sequelize模型定义一致
          attributes: ['id']
        }
      ]
    });
    
    if (!questionSet) {
      console.error(`[UserProgressController] 题库不存在: ${questionSetId}`);
      return res.status(404).end();
    }
    
    // 获取题库中的总题目数 - 从关联中计算，而不是依赖questionSet.totalQuestions字段
    const totalQuestions = questionSet.questions ? questionSet.questions.length : 0;
    
    // 获取已完成的题目数量和正确的题目数量
    const completedQuestions = progress.length;
    const correctAnswers = progress.filter(p => p.isCorrect).length;
    
    // 事务处理
    const transaction = await sequelize.transaction();
    
    try {
      // 创建或更新进度汇总记录
      const recordId = uuidv4();
      const summaryRecord = await UserProgress.findOrCreate({
        where: {
          userId,
          questionSetId,
          recordType: PROGRESS_RECORD_TYPES.SESSION_SUMMARY
        },
        defaults: {
          id: recordId,
          userId,
          questionSetId,
          questionId: recordId, // 使用生成的UUID作为虚拟questionId
          isCorrect: null, // 不适用于汇总记录
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
      
      // 如果记录已存在，则更新它
      if (!summaryRecord[1]) {
        const [existingRecord] = summaryRecord;
        
        // 解析现有元数据
        let metadata = {};
        try {
          metadata = JSON.parse(existingRecord.metadata || '{}');
        } catch (e) {
          metadata = {};
        }
        
        // 更新元数据
        metadata.progressDetails = metadata.progressDetails || [];
        metadata.progressDetails.push(...progress);
        metadata.timestamp = new Date().toISOString();
        metadata.sessionId = sessionId;
        
        // 更新记录
        await existingRecord.update({
          timeSpent: (existingRecord.timeSpent || 0) + progress.reduce((sum, p) => sum + (p.timeSpent || 0), 0),
          lastAccessed: new Date(),
          metadata: JSON.stringify(metadata),
          completedQuestions: Math.max(completedQuestions, existingRecord.completedQuestions || 0),
          totalQuestions,
          correctAnswers: Math.max(correctAnswers, existingRecord.correctAnswers || 0)
        }, { transaction });
      }
      
      // 保存详细的进度记录
      for (const item of progress) {
        // 生成唯一ID
        const progressId = uuidv4();
        
        await UserProgress.create({
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
      
      await transaction.commit();
      
      // 通过Socket.IO发送更新通知 - 使用标准格式
      const io = getSocketIO();
      if (io) {
        io.to(`user_${userId}`).emit('progressUpdate', {
          type: 'beaconSync',
          userId,
          questionSetId,
          completedQuestions,
          totalQuestions,
          correctAnswers,
          timestamp: new Date().toISOString(),
          source: 'beacon'
        });
      }
      
      // 由于是Beacon请求，我们简单地结束响应
      return res.status(200).end();
      
    } catch (error) {
      await transaction.rollback();
      console.error('[UserProgressController] Beacon同步失败:', error.stack);
      return res.status(500).end();
    }
  } catch (error) {
    console.error('[UserProgressController] Beacon处理失败:', error.stack);
    return res.status(500).end();
  }
};

module.exports = {
  getUserProgress,
  getProgressByQuestionSetId,
  updateUserProgress,
  updateProgress,
  resetProgress,
  createDetailedProgress,
  getDetailedProgress,
  getProgressStats,
  deleteProgressRecord,
  getUserProgressRecords,
  getProgressSummary,
  syncProgressViaBeacon,
  // 导出常量供其他模块使用
  PROGRESS_RECORD_TYPES,
  // 导出工具函数供其他控制器使用
  checkPermission,
  // 工具函数
  calculateProgressStats
}; 