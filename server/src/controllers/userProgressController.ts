import { Request, Response } from 'express';
import User from '../models/User';
import QuestionSet from '../models/QuestionSet';
import { UserProgress } from '../models/UserProgress';
import { sendResponse, sendError } from '../utils/responseUtils';
import { IUserProgress } from '../types';

/**
 * @desc    获取用户进度
 * @route   GET /api/v1/user-progress
 * @access  Private
 */
export const getUserProgress = async (req: Request, res: Response) => {
  try {
    const user = await User.findByPk(req.user.id);

    if (!user) {
      return sendError(res, 404, '用户不存在');
    }

    const progress: Record<string, IUserProgress> = user.progress || {};
    sendResponse(res, 200, '获取用户进度成功', progress);
  } catch (error) {
    console.error('Get user progress error:', error);
    sendError(res, 500, '获取用户进度失败', error);
  }
};

/**
 * @desc    获取特定题库的用户进度
 * @route   GET /api/v1/user-progress/:questionSetId
 * @access  Private
 */
export const getProgressByQuestionSetId = async (req: Request, res: Response) => {
  try {
    const user = await User.findByPk(req.user.id);
    const questionSetId = req.params.questionSetId;

    if (!user) {
      return sendError(res, 404, '用户不存在');
    }

    // 检查题库是否存在
    const questionSet = await QuestionSet.findByPk(questionSetId);
    if (!questionSet) {
      return sendError(res, 404, '题库不存在');
    }

    const progress: IUserProgress = user.progress?.[questionSetId] || {
      completedQuestions: 0,
      totalQuestions: 0,
      correctAnswers: 0,
      lastAccessed: null
    };

    sendResponse(res, 200, '获取题库进度成功', progress);
  } catch (error) {
    console.error('Get question set progress error:', error);
    sendError(res, 500, '获取题库进度失败', error);
  }
};

/**
 * @desc    更新用户进度
 * @route   POST /api/v1/user-progress
 * @access  Private
 */
export const updateProgress = async (req: Request, res: Response) => {
  try {
    const { questionSetId, completedQuestions, totalQuestions, correctAnswers } = req.body;

    // 验证必填字段
    if (!questionSetId || completedQuestions === undefined || totalQuestions === undefined) {
      return sendError(res, 400, '请提供题库ID、已完成题目数和总题目数');
    }

    const user = await User.findByPk(req.user.id);
    if (!user) {
      return sendError(res, 404, '用户不存在');
    }

    // 检查题库是否存在
    const questionSet = await QuestionSet.findByPk(questionSetId);
    if (!questionSet) {
      return sendError(res, 404, '题库不存在');
    }

    // 更新进度
    if (!user.progress) {
      user.progress = {};
    }

    const progress: IUserProgress = {
      completedQuestions,
      totalQuestions,
      correctAnswers: correctAnswers || 0,
      lastAccessed: new Date()
    };

    user.progress[questionSetId] = progress;
    await user.save();

    sendResponse(res, 200, '进度更新成功', progress);
  } catch (error) {
    console.error('Update progress error:', error);
    sendError(res, 500, '更新进度失败', error);
  }
};

/**
 * @desc    重置用户进度
 * @route   DELETE /api/v1/user-progress/:questionSetId
 * @access  Private
 */
export const resetProgress = async (req: Request, res: Response) => {
  try {
    const user = await User.findByPk(req.user.id);
    const questionSetId = req.params.questionSetId;

    if (!user) {
      return sendError(res, 404, '用户不存在');
    }

    // 检查题库是否存在
    const questionSet = await QuestionSet.findByPk(questionSetId);
    if (!questionSet) {
      return sendError(res, 404, '题库不存在');
    }

    // 重置进度
    if (user.progress && user.progress[questionSetId]) {
      delete user.progress[questionSetId];
      await user.save();
    }

    sendResponse(res, 200, '进度重置成功');
  } catch (error) {
    console.error('Reset progress error:', error);
    sendError(res, 500, '重置进度失败', error);
  }
};

export class UserProgressController {
  /**
   * @route POST /api/v1/progress
   * @access Private
   */
  static async createProgress(req: Request, res: Response) {
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

      return sendResponse(res, 201, '学习进度已记录', progress);
    } catch (error) {
      console.error('创建学习进度失败:', error);
      return sendError(res, 500, '创建学习进度失败');
    }
  }

  /**
   * @route GET /api/v1/progress
   * @access Private
   */
  static async getUserProgress(req: Request, res: Response) {
    try {
      const userId = req.user.id;
      const { questionSetId, startDate, endDate } = req.query;

      const where: any = { userId };
      if (questionSetId) where.questionSetId = questionSetId;
      if (startDate && endDate) {
        where.createdAt = {
          $gte: new Date(startDate as string),
          $lte: new Date(endDate as string),
        };
      }

      const progress = await UserProgress.find(where)
        .sort({ createdAt: -1 })
        .populate('questionSetId')
        .populate('questionId');

      return sendResponse(res, 200, '获取学习进度成功', progress);
    } catch (error) {
      console.error('获取学习进度失败:', error);
      return sendError(res, 500, '获取学习进度失败');
    }
  }

  /**
   * @route GET /api/v1/progress/stats
   * @access Private
   */
  static async getProgressStats(req: Request, res: Response) {
    try {
      const userId = req.user.id;
      const { questionSetId } = req.query;

      const where: any = { userId };
      if (questionSetId) where.questionSetId = questionSetId;

      const stats = await UserProgress.aggregate([
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

      return sendResponse(res, 200, '获取学习统计成功', stats);
    } catch (error) {
      console.error('获取学习统计失败:', error);
      return sendError(res, 500, '获取学习统计失败');
    }
  }

  /**
   * @route DELETE /api/v1/progress/:id
   * @access Private
   */
  static async deleteProgress(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const userId = req.user.id;

      const progress = await UserProgress.findOneAndDelete({
        _id: id,
        userId,
      });

      if (!progress) {
        return sendError(res, 404, '学习记录不存在');
      }

      return sendResponse(res, 200, '删除学习记录成功');
    } catch (error) {
      console.error('删除学习记录失败:', error);
      return sendError(res, 500, '删除学习记录失败');
    }
  }
} 