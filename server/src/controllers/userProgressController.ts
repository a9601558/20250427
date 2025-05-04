import { Request, Response } from 'express';
import User from '../models/User';
import QuestionSet from '../models/QuestionSet';
import UserProgress, { UserProgressAttributes } from '../models/UserProgress';
import Question from '../models/Question';
import { sendResponse, sendError } from '../utils/responseUtils';
import { IUserProgress } from '../types';
import { Op, Transaction, QueryTypes } from 'sequelize';
import sequelize from '../config/database';
import { getSocketIO } from '../socket';
import { v4 as uuidv4 } from 'uuid';
import Purchase from '../models/Purchase';

/**
 * Progress record types - helps distinguish between different recording strategies
 */
const PROGRESS_RECORD_TYPES = {
  INDIVIDUAL_ANSWER: 'individual_answer', // Individual question answer
  DETAILED_PROGRESS: 'detailed_progress', // Detailed progress with metadata
  SESSION_SUMMARY: 'session_summary',     // Summary of a session (beacon API)
  AGGREGATED: 'aggregated'                // Aggregated stats
};

interface ProgressStats {
  totalQuestions: number;
  completedQuestions: number;
  correctAnswers: number;
  totalTimeSpent: number;
  averageTimeSpent: number;
  accuracy: number;
  lastActivity?: string;
}

interface ProgressUpdateEvent {
  type: string;
  userId: string;
  questionSetId: string;
  questionId?: string;
  progressId?: string;
  isCorrect?: boolean;
  stats?: ProgressStats;
  completedQuestions?: number;
  totalQuestions?: number;
  correctAnswers?: number;
  timestamp: string;
  source: string;
}

/**
 * Check if the user has permission to access/modify the requested user's data
 * @param req Express request
 * @param targetUserId Target user ID
 * @returns Boolean indicating if access is permitted
 */
const checkPermission = (req: Request, targetUserId: string): boolean => {
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
export const getUserProgress = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { userId } = req.params;
    const { 
      page = 1, 
      limit = 10, 
      sort = 'lastAccessed',
      order = 'desc',
      recordType
    } = req.query;
    
    // Validate params
    if (!userId) {
      return sendError(res, 400, '缺少用户ID参数');
    }
    
    // Permission check
    if (!checkPermission(req, userId)) {
      return sendError(res, 403, '无权访问此用户的进度');
    }

    // Calculate pagination params
    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);
    const offset = (pageNum - 1) * limitNum;
    
    // Define sorting options
    const sortFields = ['lastAccessed', 'createdAt', 'updatedAt', 'timeSpent', 'isCorrect'];
    const sortField = sortFields.includes(sort as string) ? sort : 'lastAccessed';
    const sortOrder = (order as string)?.toLowerCase() === 'asc' ? 'ASC' : 'DESC';
    
    // Build where clause
    const whereClause: any = { userId };
    if (recordType) {
      whereClause.recordType = recordType;
    }

    // Get paginated progress records
    const { count, rows } = await UserProgress.findAndCountAll({
      where: whereClause,
      include: [
        {
          model: QuestionSet,
          as: 'progressQuestionSet',
          attributes: ['id', 'title']
        }
      ],
      limit: limitNum,
      offset,
      order: [[sortField as string, sortOrder]]
    });

    const totalPages = Math.ceil(count / limitNum);
    
    return sendResponse(res, 200, '获取用户进度成功', {
      data: rows,
      pagination: {
        total: count,
        page: pageNum,
        limit: limitNum,
        totalPages
      }
    });
  } catch (error) {
    console.error('获取用户进度失败:', error);
    return sendError(res, 500, '获取用户进度失败', error);
  }
};

/**
 * @desc    获取特定题库的用户进度
 * @route   GET /api/user-progress/:userId/:questionSetId
 * @access  Private
 */
export const getProgressByQuestionSetId = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { userId, questionSetId } = req.params;
    const { 
      page = 1, 
      limit = 10, 
      sort = 'lastAccessed',
      order = 'desc',
      recordType
    } = req.query;
    
    // Validate params
    if (!userId || !questionSetId) {
      return sendError(res, 400, '缺少必要参数');
    }
    
    // Permission check
    if (!checkPermission(req, userId)) {
      return sendError(res, 403, '无权访问此用户的进度');
    }

    // Calculate pagination params
    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);
    const offset = (pageNum - 1) * limitNum;
    
    // Define sorting options
    const sortFields = ['lastAccessed', 'createdAt', 'updatedAt', 'timeSpent', 'isCorrect'];
    const sortField = sortFields.includes(sort as string) ? sort : 'lastAccessed';
    const sortOrder = (order as string)?.toLowerCase() === 'asc' ? 'ASC' : 'DESC';

    // Build where clause
    const whereClause: any = { userId, questionSetId };
    if (recordType) {
      whereClause.recordType = recordType;
    }

    // Get paginated progress records
    const { count, rows } = await UserProgress.findAndCountAll({
      where: whereClause,
      include: [
        { 
          model: QuestionSet, 
          as: 'progressQuestionSet' 
        },
        { 
          model: Question, 
          as: 'question' 
        }
      ],
      limit: limitNum,
      offset,
      order: [[sortField as string, sortOrder]]
    });

    const totalPages = Math.ceil(count / limitNum);

    if (count === 0) {
      return sendError(res, 404, '找不到进度记录');
    }
    
    return sendResponse(res, 200, '获取进度成功', {
      data: rows,
      pagination: {
        total: count,
        page: pageNum,
        limit: limitNum,
        totalPages
      }
    });
  } catch (error) {
    console.error('获取题库进度失败:', error);
    return sendError(res, 500, '获取题库进度失败', error);
  }
};

/**
 * @desc    更新用户进度
 * @route   POST /api/user-progress/update
 * @access  Private
 */
export const updateProgress = async (req: Request, res: Response): Promise<Response> => {
  // Start transaction for atomic operations
  const transaction = await sequelize.transaction();
  
  try {
    const userId = req.user.id;
    const { questionSetId, questionId, isCorrect, timeSpent } = req.body;

    // Validate required params
    if (!questionSetId || !questionId || typeof isCorrect !== 'boolean') {
      await transaction.rollback();
      return sendError(res, 400, '缺少必要参数或参数类型错误');
    }

    // Create or update progress record
    const [progress, created] = await UserProgress.findOrCreate({
      where: {
        userId,
        questionSetId,
        questionId,
        recordType: PROGRESS_RECORD_TYPES.INDIVIDUAL_ANSWER
      },
      defaults: {
        id: uuidv4(), // Generate a UUID for new records
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

    // If record already exists, update it
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

    // Calculate statistics AFTER updating the record
    const stats = await calculateProgressStats(userId, questionSetId, transaction);

    // Commit transaction
    await transaction.commit();

    // Send real-time update via Socket.IO
    try {
      const socketIo = getSocketIO();
      if (socketIo) {
        const updateEvent: ProgressUpdateEvent = {
          type: 'progressUpdate',
          userId,
          questionSetId,
          questionId,
          isCorrect,
          stats,
          timestamp: new Date().toISOString(),
          source: 'api'
        };
        
        socketIo.to(`user_${userId}`).emit('progressUpdate', updateEvent);
      }
    } catch (socketError) {
      console.error('发送socket更新失败:', socketError);
      // Don't interrupt response flow
    }

    return sendResponse(res, 200, '更新进度成功', { progress, stats });
  } catch (error) {
    // Rollback transaction on error
    await transaction.rollback();
    console.error('更新进度失败:', error);
    return sendError(res, 500, '更新进度失败', error);
  }
};

/**
 * @desc    重置用户进度
 * @route   DELETE /api/user-progress/reset/:userId/:questionSetId
 * @access  Private
 */
export const resetProgress = async (req: Request, res: Response): Promise<Response> => {
  // Start transaction for atomic operations
  const transaction = await sequelize.transaction();
  
  try {
    const { userId, questionSetId } = req.params;
    
    // Validate params
    if (!userId || !questionSetId) {
      await transaction.rollback();
      return sendError(res, 400, '缺少必要参数');
    }
    
    // Permission check
    if (!checkPermission(req, userId)) {
      await transaction.rollback();
      return sendError(res, 403, '无权重置此用户的进度');
    }

    // Count records to be deleted for logging
    const countToDelete = await UserProgress.count({
      where: { userId, questionSetId },
      transaction
    });

    // Delete all progress records for this user and question set
    await UserProgress.destroy({
      where: { userId, questionSetId },
      transaction
    });

    // Commit transaction
    await transaction.commit();

    // Send real-time update via Socket.IO
    try {
      const socketIo = getSocketIO();
      if (socketIo) {
        const updateEvent: ProgressUpdateEvent = {
          type: 'progressReset',
          userId,
          questionSetId,
          timestamp: new Date().toISOString(),
          source: 'api'
        };
        
        socketIo.to(`user_${userId}`).emit('progressUpdate', updateEvent);
      }
    } catch (socketError) {
      console.error('发送socket重置通知失败:', socketError);
      // Don't interrupt response flow
    }

    console.log(`[UserProgressController] 已重置用户 ${userId} 在题库 ${questionSetId} 的进度，删除了 ${countToDelete} 条记录`);

    return sendResponse(res, 200, '进度重置成功', { deletedCount: countToDelete });
  } catch (error) {
    // Rollback transaction on error
    await transaction.rollback();
    console.error('重置进度失败:', error);
    return sendError(res, 500, '重置进度失败', error);
  }
};

/**
 * @desc    记录详细的进度信息
 * @route   POST /api/user-progress/detailed
 * @access  Private
 */
export const createDetailedProgress = async (req: Request, res: Response): Promise<Response> => {
  // Start transaction for atomic operations
  const transaction = await sequelize.transaction();
  
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
      return sendError(res, 400, '缺少必要参数或参数类型错误');
    }

    // Prepare metadata
    const metadataObj = {
      source: 'detailed_progress_api',
      timestamp: new Date().toISOString(),
      userAgent: req.headers['user-agent'],
      ...metadata
    };

    // Create detailed progress record with record type
    const progressRecord = await UserProgress.create({
      id: uuidv4(),
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
      const socketIo = getSocketIO();
      if (socketIo) {
        const updateEvent: ProgressUpdateEvent = {
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
    } catch (socketError) {
      console.error('发送socket更新失败:', socketError);
      // Don't interrupt response flow
    }

    return sendResponse(res, 201, '进度记录创建成功', { progress: progressRecord, stats });
  } catch (error) {
    // Rollback transaction on error
    await transaction.rollback();
    console.error('创建详细进度失败:', error);
    return sendError(res, 500, '创建详细进度失败', error);
  }
};

/**
 * @desc    获取详细的进度记录
 * @route   GET /api/user-progress/detailed/:userId/:questionSetId
 * @access  Private
 */
export const getDetailedProgress = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { userId, questionSetId } = req.params;
    const { 
      page = 1, 
      limit = 10, 
      sort = 'lastAccessed',
      order = 'desc' 
    } = req.query;
    
    // Validate params
    if (!userId || !questionSetId) {
      return sendError(res, 400, '缺少必要参数');
    }
    
    // Permission check
    if (!checkPermission(req, userId)) {
      return sendError(res, 403, '无权访问此用户的详细进度');
    }

    // Calculate pagination params
    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);
    const offset = (pageNum - 1) * limitNum;
    
    // Define sorting options
    const sortFields = ['lastAccessed', 'createdAt', 'updatedAt', 'timeSpent'];
    const sortField = sortFields.includes(sort as string) ? sort : 'lastAccessed';
    const sortOrder = (order as string)?.toLowerCase() === 'asc' ? 'ASC' : 'DESC';

    // Get paginated detailed progress records
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
      order: [[sortField as string, sortOrder]]
    });

    const totalPages = Math.ceil(count / limitNum);

    if (count === 0) {
      return sendError(res, 404, '未找到进度记录');
    }
    
    return sendResponse(res, 200, '获取详细进度成功', {
      data: rows,
      pagination: {
        total: count,
        page: pageNum,
        limit: limitNum,
        totalPages
      }
    });
  } catch (error) {
    console.error('获取详细进度失败:', error);
    return sendError(res, 500, '获取详细进度失败', error);
  }
};

/**
 * @desc    获取学习统计
 * @route   GET /api/user-progress/stats/:userId/:questionSetId
 * @access  Private
 */
export const getProgressStats = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { userId, questionSetId } = req.params;
    
    // Validate params
    if (!userId || !questionSetId) {
      return sendError(res, 400, '缺少必要参数');
    }
    
    // Permission check
    if (!checkPermission(req, userId)) {
      return sendError(res, 403, '无权访问此用户的进度统计');
    }

    // Get user and question set to validate they exist
    const [user, questionSet] = await Promise.all([
      User.findByPk(userId),
      QuestionSet.findByPk(questionSetId)
    ]);

    if (!user) {
      return sendError(res, 404, '用户不存在');
    }

    if (!questionSet) {
      return sendError(res, 404, '题库不存在');
    }

    // Calculate statistics directly in the database
    const stats = await calculateProgressStats(userId, questionSetId);
    
    return sendResponse(res, 200, '获取进度统计成功', stats);
  } catch (error) {
    console.error('获取进度统计失败:', error);
    return sendError(res, 500, '获取进度统计失败', error);
  }
};

/**
 * @desc    获取用户进度统计数据
 * @route   GET /api/user-progress/stats/:userId
 * @access  Private
 */
export const getUserProgressStats = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { userId } = req.params;
    
    // Validate params
    if (!userId) {
      return sendError(res, 400, '用户ID不能为空');
    }
    
    // Permission check
    if (!checkPermission(req, userId)) {
      return sendError(res, 403, '无权访问此用户的进度统计');
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
    
    const stats = await sequelize.query(query, {
      replacements: { 
        userId,
        recordType: PROGRESS_RECORD_TYPES.INDIVIDUAL_ANSWER
      },
      type: QueryTypes.SELECT
    });
    
    // Get total questions for each question set
    const questionSets = await QuestionSet.findAll({
      include: [
        {
          model: Question,
          as: 'questions',
          attributes: ['id']
        }
      ],
      where: {
        id: {
          [Op.in]: stats.map((stat: any) => stat.questionSetId)
        }
      }
    });
    
    // Create a map of question set ID to question count
    const questionCountMap: {[key: string]: number} = {};
    questionSets.forEach(set => {
      questionCountMap[set.id] = (set as any).questions?.length || set.questionSetQuestions?.length || 0;
    });
    
    // Enrich statistics with additional calculated data
    const enrichedStats = stats.map((stat: any) => {
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
    
    return sendResponse(res, 200, '获取用户进度统计成功', enrichedStats);
  } catch (error) {
    console.error('获取用户统计数据失败:', error);
    return sendError(res, 500, '获取用户统计数据失败', error);
  }
};

/**
 * @desc    获取进度摘要
 * @route   GET /api/user-progress/summary/:userId
 * @access  Private
 */
export const getProgressSummary = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { userId } = req.params;
    
    // Validate params
    if (!userId) {
      return sendError(res, 400, '用户ID不能为空');
    }
    
    // Permission check
    if (!checkPermission(req, userId)) {
      return sendError(res, 403, '无权访问此用户的进度摘要');
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
    
    const summaries = await sequelize.query(query, {
      replacements: { 
        userId,
        recordType: PROGRESS_RECORD_TYPES.INDIVIDUAL_ANSWER
      },
      type: QueryTypes.SELECT
    });
    
    // Calculate additional statistics
    const enrichedSummaries = summaries.map((summary: any) => {
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
    
    return sendResponse(res, 200, '获取进度摘要成功', enrichedSummaries);
  } catch (error) {
    console.error('获取进度摘要失败:', error);
    return sendError(res, 500, '获取进度摘要失败', error);
  }
};

/**
 * @desc    通过Beacon API同步用户进度
 * @route   POST /api/user-progress/beacon
 * @access  Public
 */
export const syncProgressViaBeacon = async (req: Request, res: Response): Promise<Response> => {
  // Note: Since this is a beacon request, we should always return 200
  // even for errors, as the browser doesn't process the response
  
  try {
    let data: any;
    const contentType = req.headers['content-type'] || '';
    
    // Parse request data based on content type
    if (contentType.includes('application/json')) {
      data = req.body;
    } else if (contentType.includes('application/x-www-form-urlencoded')) {
      data = req.body.data ? JSON.parse(req.body.data) : req.body;
    } else {
      // Try to parse as JSON as a fallback
      try {
        data = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      } catch (e) {
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
    const transaction = await sequelize.transaction();
    
    try {
      // Verify user (optional for beacon)
      let user = null;
      if (userId) {
        user = await User.findByPk(userId, { transaction });
        if (!user) {
          console.warn(`[UserProgressController] User not found: ${userId}`);
        }
      }
      
      // Get question set with questions for total count
      const questionSet = await QuestionSet.findByPk(questionSetId, {
        include: [
          {
            model: Question,
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
      const totalQuestions = (questionSet as any).questions?.length || (questionSet.questionSetQuestions?.length || 0);
      
      // Calculate progress statistics
      const completedQuestions = progress.length;
      const correctAnswers = progress.filter((p: any) => p.isCorrect).length;
      
      // Create or update summary record
      const summaryId = uuidv4();
      const [summaryRecord, created] = await UserProgress.findOrCreate({
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
          timeSpent: progress.reduce((sum: number, p: any) => sum + (p.timeSpent || 0), 0),
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
        } catch (e) {
          metadata = {};
        }
        
        // Update metadata with new progress
        const progressDetails = (metadata as any).progressDetails || [];
        progressDetails.push(...progress);
        
        // Update summary record
        await summaryRecord.update({
          timeSpent: (summaryRecord.timeSpent || 0) + progress.reduce((sum: number, p: any) => sum + (p.timeSpent || 0), 0),
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
      
      // Commit transaction
      await transaction.commit();
      
      // Send socket notification
      try {
        const socketIo = getSocketIO();
        if (socketIo) {
          const updateEvent: ProgressUpdateEvent = {
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
      } catch (socketError) {
        console.error('[UserProgressController] Socket notification failed:', socketError);
        // Don't fail the request
      }
      
      // Return success response (even though beacon doesn't use it)
      return res.status(200).json({ success: true });
    } catch (error) {
      // Rollback transaction on error
      await transaction.rollback();
      console.error('[UserProgressController] Beacon sync failed:', error);
      // Still return 200 to avoid browser warnings
      return res.status(200).json({
        success: false,
        message: 'Error processing update, but request received'
      });
    }
  } catch (error) {
    console.error('[UserProgressController] Beacon request processing failed:', error);
    // Still return 200 to avoid browser warnings
    return res.status(200).json({
      success: false,
      message: 'Error processing request, but request received'
    });
  }
};

/**
 * Calculate progress statistics directly in the database for better performance
 * @param userId User ID
 * @param questionSetId Question set ID
 * @param transaction Optional transaction
 * @returns Progress statistics
 */
const calculateProgressStats = async (
  userId: string, 
  questionSetId: string,
  transaction?: Transaction
): Promise<ProgressStats> => {
  try {
    // Get question count from question set
    const questionSet = await QuestionSet.findByPk(questionSetId, {
      include: [{
        model: Question,
        as: 'questions', // Make sure this matches your model association
        attributes: ['id']
      }],
      transaction
    });

    if (!questionSet) {
      throw new Error(`Question set not found: ${questionSetId}`);
    }

    const totalQuestions = (questionSet as any).questions?.length || (questionSet.questionSetQuestions?.length || 0);

    // Use aggregation in database to calculate statistics
    const [progressStats] = await UserProgress.findAll({
      attributes: [
        [sequelize.fn('COUNT', sequelize.fn('DISTINCT', sequelize.col('questionId'))), 'completedQuestions'],
        [sequelize.fn('SUM', sequelize.literal('CASE WHEN "isCorrect" = true THEN 1 ELSE 0 END')), 'correctAnswers'],
        [sequelize.fn('COUNT', sequelize.col('id')), 'totalAnswers'],
        [sequelize.fn('SUM', sequelize.col('timeSpent')), 'totalTimeSpent'],
        [sequelize.fn('MAX', sequelize.col('lastAccessed')), 'lastActivity']
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
    const totalAnswers = parseInt(String((progressStats as any).totalAnswers || '0'));
    const totalTimeSpent = parseInt(String((progressStats as any).totalTimeSpent || '0'));
    
    const accuracy = totalAnswers > 0 ? (correctAnswers / totalAnswers) * 100 : 0;
    const averageTimeSpent = completedQuestions > 0 ? totalTimeSpent / completedQuestions : 0;

    return {
      totalQuestions,
      completedQuestions,
      correctAnswers,
      totalTimeSpent,
      averageTimeSpent,
      accuracy,
      lastActivity: (progressStats as any).lastActivity ? new Date((progressStats as any).lastActivity).toISOString() : undefined
    };
  } catch (error) {
    console.error('Error calculating progress stats:', error);
    throw error;
  }
};

/**
 * @desc    获取用户原始进度记录
 * @route   GET /api/user-progress/records/:userId
 * @access  Private
 */
export const getUserProgressRecords = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { userId } = req.params;
    const { 
      page = 1, 
      limit = 10, 
      sort = 'lastAccessed',
      order = 'desc',
      questionSetId,
      isCorrect,
      recordType
    } = req.query;
    
    // Validate params
    if (!userId) {
      return sendError(res, 400, '缺少用户ID参数');
    }
    
    // Permission check
    if (!checkPermission(req, userId)) {
      return sendError(res, 403, '无权访问此用户的进度记录');
    }

    // Calculate pagination params
    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);
    const offset = (pageNum - 1) * limitNum;
    
    // Define sorting options
    const sortFields = ['lastAccessed', 'createdAt', 'updatedAt', 'timeSpent', 'isCorrect'];
    const sortField = sortFields.includes(sort as string) ? sort : 'lastAccessed';
    const sortOrder = (order as string)?.toLowerCase() === 'asc' ? 'ASC' : 'DESC';

    // Build where clause
    const whereClause: any = { userId };
    
    if (questionSetId) {
      whereClause.questionSetId = questionSetId;
    }
    
    if (isCorrect !== undefined) {
      whereClause.isCorrect = isCorrect === 'true';
    }
    
    if (recordType) {
      whereClause.recordType = recordType;
    }

    // Get paginated progress records
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
      order: [[sortField as string, sortOrder]]
    });

    const totalPages = Math.ceil(count / limitNum);
    
    return sendResponse(res, 200, '获取进度记录成功', {
      data: rows,
      pagination: {
        total: count,
        page: pageNum,
        limit: limitNum,
        totalPages
      }
    });
  } catch (error) {
    console.error('获取用户进度记录失败:', error);
    return sendError(res, 500, '获取用户进度记录失败', error);
  }
};

/**
 * @desc    删除进度记录
 * @route   DELETE /api/user-progress/:userId/:progressId
 * @access  Private
 */
export const deleteProgressRecord = async (req: Request, res: Response): Promise<Response> => {
  // Start transaction for atomic operations
  const transaction = await sequelize.transaction();
  
  try {
    const { userId, progressId } = req.params;
    
    // Validate params
    if (!userId || !progressId) {
      await transaction.rollback();
      return sendError(res, 400, '缺少必要参数');
    }
    
    // Permission check
    if (!checkPermission(req, userId)) {
      await transaction.rollback();
      return sendError(res, 403, '无权删除此用户的进度记录');
    }

    // Find the progress record
    const progress = await UserProgress.findOne({
      where: { id: progressId, userId },
      transaction
    });

    if (!progress) {
      await transaction.rollback();
      return sendError(res, 404, '进度记录不存在');
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
      const socketIo = getSocketIO();
      if (socketIo) {
        const updateEvent: ProgressUpdateEvent = {
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
    } catch (socketError) {
      console.error('发送socket更新失败:', socketError);
      // Don't interrupt response flow
    }

    return sendResponse(res, 200, '进度记录删除成功', { stats });
  } catch (error) {
    // Rollback transaction on error
    await transaction.rollback();
    console.error('删除进度记录失败:', error);
    return sendError(res, 500, '删除进度记录失败', error);
  }
};

// 修改导出，确保包含所有必要的函数
export default {
  PROGRESS_RECORD_TYPES,
  checkPermission,
  calculateProgressStats,
  getUserProgress,
  getProgressByQuestionSetId,
  getDetailedProgress,
  updateProgress,
  resetProgress,
  createDetailedProgress,
  getUserProgressRecords,
  getUserProgressStats,
  getProgressStats,
  getProgressSummary,
  syncProgressViaBeacon,
  deleteProgressRecord
}; 