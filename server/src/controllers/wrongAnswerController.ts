import { Request, Response } from 'express';
import WrongAnswer from '../models/WrongAnswer';
import QuestionSet from '../models/QuestionSet';
import { Op } from 'sequelize';

/**
 * 获取用户所有错题记录
 */
export const getWrongAnswers = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: '未授权，请先登录' });
    }

    const wrongAnswers = await WrongAnswer.findAll({
      where: { userId },
      include: [
        {
          model: QuestionSet,
          as: 'questionSet',
          attributes: ['id', 'title'],
        },
      ],
      order: [['createdAt', 'DESC']],
    });

    return res.json({
      success: true,
      data: wrongAnswers,
    });
  } catch (error) {
    console.error('获取错题记录失败:', error);
    return res.status(500).json({
      success: false,
      message: '服务器错误，获取错题记录失败',
    });
  }
};

/**
 * 保存错题记录
 */
export const saveWrongAnswer = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: '未授权，请先登录' });
    }

    const {
      questionId,
      questionSetId,
      question,
      questionType,
      options,
      selectedOption,
      selectedOptions,
      correctOption,
      correctOptions,
      explanation,
    } = req.body;

    // 检查是否已存在相同的错题记录（防止重复添加）
    const existingWrongAnswer = await WrongAnswer.findOne({
      where: {
        userId,
        questionId,
        questionSetId,
      },
    });

    if (existingWrongAnswer) {
      // 更新已有记录
      await existingWrongAnswer.update({
        question,
        questionType,
        options,
        selectedOption,
        selectedOptions,
        correctOption,
        correctOptions,
        explanation,
      });

      return res.json({
        success: true,
        data: existingWrongAnswer,
        message: '错题记录已更新',
      });
    }

    // 创建新记录
    const wrongAnswer = await WrongAnswer.create({
      userId,
      questionId,
      questionSetId,
      question,
      questionType,
      options,
      selectedOption,
      selectedOptions,
      correctOption,
      correctOptions,
      explanation,
    });

    return res.status(201).json({
      success: true,
      data: wrongAnswer,
      message: '错题已保存',
    });
  } catch (error) {
    console.error('保存错题失败:', error);
    return res.status(500).json({
      success: false,
      message: '服务器错误，保存错题失败',
    });
  }
};

/**
 * 删除错题记录
 */
export const deleteWrongAnswer = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: '未授权，请先登录' });
    }

    const { id } = req.params;

    const wrongAnswer = await WrongAnswer.findOne({
      where: {
        id,
        userId,
      },
    });

    if (!wrongAnswer) {
      return res.status(404).json({
        success: false,
        message: '错题记录不存在',
      });
    }

    await wrongAnswer.destroy();

    return res.json({
      success: true,
      message: '错题已删除',
    });
  } catch (error) {
    console.error('删除错题失败:', error);
    return res.status(500).json({
      success: false,
      message: '服务器错误，删除错题失败',
    });
  }
};

/**
 * 更新错题备注
 */
export const updateMemo = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: '未授权，请先登录' });
    }

    const { id } = req.params;
    const { memo } = req.body;

    const wrongAnswer = await WrongAnswer.findOne({
      where: {
        id,
        userId,
      },
    });

    if (!wrongAnswer) {
      return res.status(404).json({
        success: false,
        message: '错题记录不存在',
      });
    }

    await wrongAnswer.update({ memo });

    return res.json({
      success: true,
      data: wrongAnswer,
      message: '备注已更新',
    });
  } catch (error) {
    console.error('更新备注失败:', error);
    return res.status(500).json({
      success: false,
      message: '服务器错误，更新备注失败',
    });
  }
};

/**
 * 标记错题为已掌握（删除）
 */
export const markAsMastered = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: '未授权，请先登录' });
    }

    const { id } = req.params;

    const wrongAnswer = await WrongAnswer.findOne({
      where: {
        id,
        userId,
      },
    });

    if (!wrongAnswer) {
      return res.status(404).json({
        success: false,
        message: '错题记录不存在',
      });
    }

    await wrongAnswer.destroy();

    return res.json({
      success: true,
      message: '已标记为掌握，该题已从错题集中移除',
    });
  } catch (error) {
    console.error('标记为已掌握失败:', error);
    return res.status(500).json({
      success: false,
      message: '服务器错误，标记为已掌握失败',
    });
  }
};

/**
 * 批量删除错题
 */
export const bulkDeleteWrongAnswers = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: '未授权，请先登录' });
    }

    const { ids } = req.body;

    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({
        success: false,
        message: '请提供要删除的错题ID列表',
      });
    }

    await WrongAnswer.destroy({
      where: {
        id: {
          [Op.in]: ids,
        },
        userId,
      },
    });

    return res.json({
      success: true,
      message: `成功删除${ids.length}条错题记录`,
    });
  } catch (error) {
    console.error('批量删除错题失败:', error);
    return res.status(500).json({
      success: false,
      message: '服务器错误，批量删除错题失败',
    });
  }
};

/**
 * 获取题库下的错题
 */
export const getWrongAnswersByQuestionSet = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: '未授权，请先登录' });
    }

    const { questionSetId } = req.params;

    const wrongAnswers = await WrongAnswer.findAll({
      where: {
        userId,
        questionSetId,
      },
      order: [['createdAt', 'DESC']],
    });

    return res.json({
      success: true,
      data: wrongAnswers,
    });
  } catch (error) {
    console.error('获取题库错题失败:', error);
    return res.status(500).json({
      success: false,
      message: '服务器错误，获取题库错题失败',
    });
  }
}; 
