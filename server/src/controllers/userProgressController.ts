import { Request, Response } from 'express';
import User from '../models/User';
import QuestionSet from '../models/QuestionSet';
import UserProgress, { UserProgressAttributes } from '../models/UserProgress';
import Question from '../models/Question';
import { sendResponse, sendError } from '../utils/responseUtils';
import { IUserProgress } from '../types';
import { Op } from 'sequelize';

interface ProgressStats {
  total: number;
  correct: number;
  timeSpent: number;
  accuracy?: number;
  averageTime?: number;
  title?: string;
}

/**
 * @desc    获取用户进度
 * @route   GET /api/user-progress
 * @access  Private
 */
export const getUserProgress = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { userId } = req.params;
    const progress = await UserProgress.findAll({
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
          attributes: ['id', 'type']
        }
      ]
    });
    return sendResponse<UserProgressAttributes[]>(res, 200, '获取用户进度成功', progress);
  } catch (error) {
    return sendError(res, 500, 'Error fetching user progress', error);
  }
};

/**
 * @desc    获取特定题库的用户进度
 * @route   GET /api/user-progress/:questionSetId
 * @access  Private
 */
export const getProgressByQuestionSetId = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { userId, questionSetId } = req.params;
    const progress = await UserProgress.findOne({
      where: { userId, questionSetId },
    });
    if (!progress) {
      return sendError(res, 404, 'Progress not found');
    }
    return sendResponse<UserProgressAttributes>(res, 200, '获取进度成功', progress);
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
    const { userId, questionSetId, questionId } = req.params;
    const { isCorrect, timeSpent } = req.body;

    const [updatedProgress] = await UserProgress.upsert({
      userId,
      questionSetId,
      questionId,
      isCorrect,
      timeSpent: timeSpent || 0,
    });

    return sendResponse<UserProgressAttributes>(res, 200, '更新进度成功', updatedProgress);
  } catch (error) {
    return sendError(res, 500, 'Error updating progress', error);
  }
};

/**
 * @desc    重置用户进度
 * @route   DELETE /api/user-progress/:questionSetId
 * @access  Private
 */
export const resetProgress = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { userId, questionSetId } = req.params;
    await UserProgress.destroy({
      where: { userId, questionSetId },
    });
    return sendResponse(res, 200, 'Progress reset successfully');
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
    const { questionSetId, questionId, isCorrect, timeSpent } = req.body;
    const userId = req.user.id;

    if (!questionSetId || !questionId || typeof isCorrect !== 'boolean') {
      return sendError(res, 400, '缺少必要参数');
    }

    const progress = await UserProgress.create({
      userId,
      questionSetId,
      questionId,
      isCorrect,
      timeSpent: timeSpent || 0,
    });

    return sendResponse(res, 201, '学习进度已记录', progress.toJSON());
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
    const { questionSetId } = req.query;

    const where: any = { userId };
    if (questionSetId) where.questionSetId = questionSetId;

    const progressRecords = await UserProgress.findAll({
      where,
      include: [
        { model: QuestionSet, as: 'questionSet' }
      ]
    });

    const statsMap = new Map();
    
    progressRecords.forEach(record => {
      const qsId = record.questionSetId;
      if (!statsMap.has(qsId)) {
        const questionSet = record.get('questionSet');
        statsMap.set(qsId, {
          questionSetId: qsId,
          questionSet: questionSet ? (questionSet as any).toJSON() : null,
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
    
    const stats = Array.from(statsMap.values()).map(stat => ({
      ...stat,
      averageTimeSpent: stat.totalQuestions > 0 ? stat.totalTimeSpent / stat.totalQuestions : 0
    }));

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
 * @route   GET /api/user-progress/stats
 * @access  Private
 */
export const getUserProgressStats = async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    
    // 获取用户的所有进度记录，包括关联的题目集和题目信息
    const progressRecords = await UserProgress.findAll({
      where: { userId },
      include: [
        {
          model: QuestionSet,
          attributes: ['id', 'title']
        },
        {
          model: Question,
          attributes: ['id', 'type']
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
      const questionSet = record.get('QuestionSet') as { id: string; title: string } | undefined;
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
      const question = record.get('Question') as { id: string; type: string } | undefined;
      const type = question?.type;
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

    res.json({
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
    res.status(500).json({ error: 'Failed to get user progress statistics' });
  }
}; 