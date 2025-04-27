import { Request, Response } from 'express';
import User from '../models/User';
import { Model } from 'sequelize';
import { emitToUser } from '../config/socket';

/**
 * @desc    获取用户进度
 * @route   GET /api/user-progress/:questionSetId
 * @access  Private
 */
export const getUserProgress = async (req: Request, res: Response) => {
  try {
    const userId = req.user.id;
    const questionSetId = req.params.questionSetId;

    const user = await User.findByPk(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: '用户不存在'
      });
    }

    const progress = user.progress[questionSetId] || null;

    res.json({
      success: true,
      data: progress
    });
  } catch (error: any) {
    console.error('获取用户进度失败:', error);
    res.status(500).json({
      success: false,
      message: error.message || '服务器错误'
    });
  }
};

/**
 * @desc    更新用户进度
 * @route   PUT /api/user-progress/:questionSetId
 * @access  Private
 */
export const updateUserProgress = async (req: Request, res: Response) => {
  try {
    const userId = req.user.id;
    const questionSetId = req.params.questionSetId;
    const { completedQuestions, totalQuestions, correctAnswers } = req.body;

    const user = await User.findByPk(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: '用户不存在'
      });
    }

    // 更新或创建进度记录
    if (!user.progress) {
      user.progress = {};
    }

    const updatedProgress = {
      completedQuestions,
      totalQuestions,
      correctAnswers,
      lastAccessed: new Date()
    };

    user.progress[questionSetId] = updatedProgress;
    await user.save();

    // 通过Socket.IO通知用户更新进度
    const io = req.app.get('io');
    emitToUser(io, userId, 'progress_updated', {
      questionSetId,
      progress: updatedProgress
    });

    res.json({
      success: true,
      message: '进度更新成功',
      data: updatedProgress
    });
  } catch (error: any) {
    console.error('更新用户进度失败:', error);
    res.status(500).json({
      success: false,
      message: error.message || '服务器错误'
    });
  }
}; 