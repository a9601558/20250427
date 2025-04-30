import { Request, Response } from 'express';
import User from '../models/User';
import QuestionSet from '../models/QuestionSet';
import UserProgress, { UserProgressAttributes } from '../models/UserProgress';
import Question from '../models/Question';
import { sendResponse, sendError } from '../utils/responseUtils';
import { IUserProgress } from '../types';
import { Op } from 'sequelize';
import { io } from '../config/socket';
import { getUserQuestionSetProgress, calculateProgressStats } from '../services/progressService';

interface ProgressStats {
  total: number;
  correct: number;
  timeSpent: number;
  accuracy?: number;
  averageTime?: number;
  title?: string;
}

interface ProgressSummary {
  questionSetId: string;
  questionSetName: string;
  stats: {
    totalAnswered: number;
    correctAnswers: number;
    totalTimeSpent: number;
    averageTimeSpent: number;
    accuracy: number;
  };
  lastAccessed: Date;
}

interface ProgressMap {
  [key: string]: ProgressSummary;
}

interface ProgressUpdateData {
  questionSetId: string;
  questionSet?: {
    id: string;
    title: string;
  };
  totalQuestions: number;
  correctAnswers: number;
  totalTimeSpent: number;
  averageTimeSpent: number;
}

interface ProgressUpdateEvent {
  questionSetId: string;
  questionSet?: {
    id: string;
    title: string;
  };
  stats: {
    totalQuestions: number;
    completedQuestions: number;
    correctAnswers: number;
    totalTimeSpent: number;
    averageTimeSpent: number;
    accuracy: number;
  };
}

interface ProgressRecord {
  questionSetId: string;
  isCorrect: boolean;
  timeSpent: number;
  progressQuestionSet: {
    id: string;
    title: string;
    questions: { id: string }[];
  };
}

interface QuestionSetWithQuestions {
  id: string;
  title: string;
  questions: { id: string }[];
}

/**
 * @desc    获取用户进度
 * @route   GET /api/user-progress/:userId
 * @access  Private
 */
export const getUserProgress = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { userId } = req.params;
    // 验证用户权限：只能查询自己的或管理员有权限查询所有人的
    const currentUserId = req.user.id;
    if (userId !== currentUserId && !req.user.isAdmin) {
      return sendError(res, 403, '无权访问此用户的进度');
    }

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
    return sendResponse(res, 200, '获取用户进度成功', progress);
  } catch (error) {
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
    // 验证用户权限：只能查询自己的或管理员有权限查询所有人的
    const currentUserId = req.user.id;
    if (userId !== currentUserId && req.user.role !== 'admin') {
      return sendError(res, 403, '无权访问此用户的进度');
    }

    const progress = await UserProgress.findAll({
      where: { userId, questionSetId },
      include: [
        { model: QuestionSet, as: 'questionSet' },
        { model: Question, as: 'question' }
      ]
    });
    if (!progress || progress.length === 0) {
      return sendError(res, 404, 'Progress not found');
    }
    return sendResponse<UserProgress[]>(res, 200, '获取进度成功', progress);
  } catch (error) {
    return sendError(res, 500, 'Error fetching progress', error);
  }
};

/**
 * @desc    更新用户进度
 * @route   POST /api/user-progress
 * @access  Private
 */
export const updateProgress = async (req: Request, res: Response): Promise<Response> => {
  try {
    const userId = req.user.id;
    const { questionSetId, questionId, isCorrect, timeSpent } = req.body;

    // 验证必要参数
    if (!questionSetId || !questionId || typeof isCorrect !== 'boolean') {
      return sendError(res, 400, '缺少必要参数');
    }

    // 创建或更新进度记录
    const [progress, created] = await UserProgress.findOrCreate({
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
    const stats = await calculateProgressStats(userId, questionSetId);

    // 发送实时更新
    const updateEvent: ProgressUpdateEvent = {
      questionSetId,
      questionSet: progress.progressQuestionSet,
      stats
    };
    
    io.to(userId).emit('progress:update', updateEvent);

    return sendResponse<UserProgress>(res, 200, '更新进度成功', progress);
  } catch (error) {
    console.error('更新进度失败:', error);
    return sendError(res, 500, 'Error updating progress', error);
  }
};

/**
 * @desc    重置用户进度
 * @route   DELETE /api/user-progress/:userId/:questionSetId
 * @access  Private
 */
export const resetProgress = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { userId, questionSetId } = req.params;
    // 验证用户权限：只能重置自己的或管理员有权限重置所有人的
    const currentUserId = req.user.id;
    if (userId !== currentUserId && req.user.role !== 'admin') {
      return sendError(res, 403, '无权重置此用户的进度');
    }

    await UserProgress.destroy({
      where: { userId, questionSetId },
    });
    return sendResponse(res, 200, '进度重置成功');
  } catch (error) {
    return sendError(res, 500, 'Error resetting progress', error);
  }
};

/**
 * @desc    记录详细的进度信息
 * @route   POST /api/user-progress/record
 * @access  Private
 */
export const createDetailedProgress = async (req: Request, res: Response) => {
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
    if (!questionSetId) missingParams.push('questionSetId');
    if (!questionId) missingParams.push('questionId');
    if (typeof isCorrect !== 'boolean') {
      // 尝试转换可能是字符串的布尔值
      if (isCorrect === 'true') isCorrect = true;
      else if (isCorrect === 'false') isCorrect = false;
      else missingParams.push('isCorrect');
    }

    console.log('Processed parameters:', {
      questionSetId,
      questionId,
      isCorrect,
      timeSpent
    });

    if (missingParams.length > 0) {
      return sendError(res, 400, `缺少必要参数: ${missingParams.join(', ')}`);
    }

    // 创建新的进度记录
    const newProgress = await UserProgress.create({
      userId,
      questionSetId,
      questionId,
      isCorrect,
      timeSpent,
      lastAccessed: new Date()
    });

    // 获取最新的统计数据
    const stats = await calculateProgressStats(userId, questionSetId);

    // 发送实时更新
    const updateEvent: ProgressUpdateEvent = {
      questionSetId,
      questionSet: newProgress.progressQuestionSet,
      stats
    };
    
    io.to(userId).emit('progress:update', updateEvent);
    
    return sendResponse(res, 201, '学习进度已记录', newProgress.toJSON());
  } catch (error) {
    console.error('创建学习进度失败:', error);
    return sendError(res, 500, '创建学习进度失败', error);
  }
};

/**
 * @desc    获取详细的进度记录
 * @route   GET /api/user-progress/detailed
 * @access  Private
 */
export const getDetailedProgress = async (req: Request, res: Response) => {
  try {
    const userId = req.user.id;
    const { questionSetId, startDate, endDate } = req.query;

    const where: any = { userId };
    if (questionSetId) where.questionSetId = questionSetId;
    if (startDate && endDate) {
      where.createdAt = {
        [Op.between]: [new Date(startDate as string), new Date(endDate as string)]
      };
    }

    const progress = await UserProgress.findAll({
      where,
      order: [['createdAt', 'DESC']],
      include: [
        { model: QuestionSet, as: 'questionSet' },
        { model: Question, as: 'question' }
      ]
    });

    return sendResponse(res, 200, '获取学习进度成功', progress.map(p => p.toJSON()));
  } catch (error) {
    console.error('获取学习进度失败:', error);
    return sendError(res, 500, '获取学习进度失败', error);
  }
};

/**
 * @desc    获取学习统计
 * @route   GET /api/user-progress/stats
 * @access  Private
 */
export const getProgressStats = async (req: Request, res: Response) => {
  try {
    const userId = req.user.id;

    // 1. 查所有题库 + 题目
    const questionSets = await QuestionSet.findAll({
      attributes: ['id', 'title'],
      include: [{
        model: Question,
        as: 'questions',
        attributes: ['id']
      }]
    });

    // 2. 查所有答题记录
    const userProgressRecords = await UserProgress.findAll({
      where: { userId },
    });

    // 3. 整理成 Map
    const progressMap = new Map<string, { completed: number, correct: number, totalTime: number }>();
    userProgressRecords.forEach(record => {
      const qsId = record.questionSetId;
      if (!progressMap.has(qsId)) {
        progressMap.set(qsId, { completed: 0, correct: 0, totalTime: 0 });
      }
      const stats = progressMap.get(qsId)!;
      stats.completed++;
      if (record.isCorrect) stats.correct++;
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
        total: totalQuestions,       // 兼容字段
        correct: correctAnswers,
        timeSpent: totalTimeSpent
      };
    });

    return sendResponse(res, 200, '获取学习统计成功', stats);
  } catch (error) {
    console.error('获取学习统计失败:', error);
    return sendError(res, 500, '获取学习统计失败', error);
  }
};

/**
 * @desc    删除进度记录
 * @route   DELETE /api/user-progress/record/:id
 * @access  Private
 */
export const deleteProgressRecord = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const progress = await UserProgress.findOne({
      where: { id, userId }
    });

    if (!progress) {
      return sendError(res, 404, '进度记录不存在');
    }

    await progress.destroy();
    return sendResponse(res, 200, '进度记录已删除');
  } catch (error) {
    console.error('删除进度记录失败:', error);
    return sendError(res, 500, '删除进度记录失败', error);
  }
};

/**
 * @desc    获取用户进度统计
 * @route   GET /api/user-progress/stats/:userId
 * @access  Private
 */
export const getUserProgressStats = async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    // 验证用户权限：只能查询自己的或管理员有权限查询所有人的
    const currentUserId = req.user.id;
    if (userId !== currentUserId && req.user.role !== 'admin') {
      return sendError(res, 403, '无权访问此用户的进度统计');
    }
    
    // 获取用户的所有进度记录，包括关联的题目集和题目信息
    const progressRecords = await UserProgress.findAll({
      where: { userId },
      include: [
        {
          model: QuestionSet,
          as: 'questionSet',
          attributes: ['id', 'title']
        },
        {
          model: Question,
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
    const setStats = progressRecords.reduce<Record<string, ProgressStats>>((acc, record) => {
      const setId = record.questionSetId.toString();
      const questionSet = record.get('questionSet') as { id: string; title: string } | undefined;
      if (!acc[setId]) {
        acc[setId] = {
          title: questionSet?.title,
          total: 0,
          correct: 0,
          timeSpent: 0
        };
      }
      acc[setId].total++;
      if (record.isCorrect) acc[setId].correct++;
      acc[setId].timeSpent += record.timeSpent;
      return acc;
    }, {});

    // 按题目类型统计
    const typeStats = progressRecords.reduce<Record<string, ProgressStats>>((acc, record) => {
      const question = record.get('question') as { id: string; questionType: string } | undefined;
      const type = question?.questionType;
      if (!type) return acc;
      if (!acc[type]) {
        acc[type] = {
          total: 0,
          correct: 0,
          timeSpent: 0
        };
      }
      acc[type].total++;
      if (record.isCorrect) acc[type].correct++;
      acc[type].timeSpent += record.timeSpent;
      return acc;
    }, {});

    // 计算每个统计的准确率和平均时间
    Object.values(setStats).forEach((stat: ProgressStats) => {
      stat.accuracy = (stat.correct / stat.total) * 100;
      stat.averageTime = stat.timeSpent / stat.total;
    });

    Object.values(typeStats).forEach((stat: ProgressStats) => {
      stat.accuracy = (stat.correct / stat.total) * 100;
      stat.averageTime = stat.timeSpent / stat.total;
    });

    return sendResponse(res, 200, '获取用户进度统计成功', {
      overall: {
        totalQuestions,
        correctAnswers,
        accuracy,
        averageTimeSpent
      },
      bySet: setStats,
      byType: typeStats
    });
  } catch (error) {
    console.error('Error getting user progress stats:', error);
    return sendError(res, 500, 'Failed to get user progress statistics', error);
  }
};

/**
 * @desc    获取用户的原始进度记录
 * @route   GET /api/user-progress/records
 * @access  Private
 */
export const getUserProgressRecords = async (req: Request, res: Response) => {
  try {
    const userId = req.user.id;
    
    // 获取用户的所有进度记录
    const progressRecords = await UserProgress.findAll({
      where: { userId },
      attributes: ['id', 'questionSetId', 'questionId', 'isCorrect', 'timeSpent', 'createdAt', 'updatedAt'],
      include: [{
        model: QuestionSet,
        as: 'progressQuestionSet',
        attributes: ['id', 'title']
      }]
    });

    return sendResponse(res, 200, '获取进度记录成功', progressRecords);
  } catch (error) {
    console.error('获取进度记录失败:', error);
    return sendError(res, 500, '获取进度记录失败', error);
  }
};

// 获取用户进度汇总统计
export const getProgressSummary = async (req: Request, res: Response) => {
  try {
    const userId = req.user.id;
    
    // 获取所有题库
    const questionSets = await QuestionSet.findAll();
    
    // 获取用户的所有进度记录
    const userProgress = await UserProgress.findAll({
      where: { userId },
      include: [{
        model: Question,
        as: 'progressQuestion',
        attributes: ['id', 'questionSetId']
      }]
    });
    
    // 按题库分组计算统计信息
    const summary = questionSets.map(qs => {
      const progressRecords = userProgress.filter(p => 
        p.progressQuestion?.questionSetId === qs.id
      );
      
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
  } catch (error) {
    console.error('获取进度汇总统计失败:', error);
    res.status(500).json({
      success: false,
      error: '获取进度汇总统计失败'
    });
  }
}; 