import { Request, Response } from 'express';
import { WrongAnswer, Question, QuestionSet, User } from '../models';
import { v4 as uuidv4 } from 'uuid';
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
          model: Question,
          as: 'wrongAnswerQuestion',
          attributes: ['id', 'text', 'questionType', 'explanation']
        },
        {
          model: QuestionSet,
          as: 'questionSet',
          attributes: ['id', 'title']
        }
      ],
      order: [['createdAt', 'DESC']]
    });

    return res.json({
      success: true,
      data: wrongAnswers
    });
  } catch (error) {
    console.error('获取错题记录失败:', error);
    return res.status(500).json({
      success: false,
      message: '服务器错误，获取错题记录失败'
    });
  }
};

/**
 * 保存错题记录
 */
export const saveWrongAnswer = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
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
      memo
    } = req.body;

    // 验证必要字段
    if (!questionId || !questionSetId || !question || !questionType || !options) {
      return res.status(400).json({
        success: false,
        message: '缺少必要的错题信息'
      });
    }

    // 检查错题是否已存在
    const existingWrongAnswer = await WrongAnswer.findOne({
      where: {
        userId,
        questionId,
        questionSetId
      }
    });

    let wrongAnswer;

    if (existingWrongAnswer) {
      // 更新现有错题
      wrongAnswer = await existingWrongAnswer.update({
        question,
        questionType,
        options,
        selectedOption,
        selectedOptions,
        correctOption,
        correctOptions,
        explanation,
        memo
      });
    } else {
      // 创建新错题记录
      wrongAnswer = await WrongAnswer.create({
        id: uuidv4(),
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
        memo
      });
    }

    res.status(201).json({
      success: true,
      message: existingWrongAnswer ? '错题已更新' : '错题已保存',
      data: wrongAnswer
    });
  } catch (error) {
    console.error('保存错题失败:', error);
    res.status(500).json({
      success: false,
      message: '服务器错误，无法保存错题'
    });
  }
};

/**
 * 删除错题记录
 */
export const deleteWrongAnswer = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;

    const wrongAnswer = await WrongAnswer.findOne({
      where: {
        id,
        userId
      }
    });

    if (!wrongAnswer) {
      return res.status(404).json({
        success: false,
        message: '错题不存在或无权访问'
      });
    }

    await wrongAnswer.destroy();

    res.json({
      success: true,
      message: '错题已删除'
    });
  } catch (error) {
    console.error('删除错题失败:', error);
    res.status(500).json({
      success: false,
      message: '服务器错误，无法删除错题'
    });
  }
};

/**
 * 更新错题备注
 */
export const updateWrongAnswerMemo = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { memo } = req.body;
    const userId = req.user?.id;

    const wrongAnswer = await WrongAnswer.findOne({
      where: {
        id,
        userId
      }
    });

    if (!wrongAnswer) {
      return res.status(404).json({
        success: false,
        message: '错题不存在或无权访问'
      });
    }

    await wrongAnswer.update({ memo });

    res.json({
      success: true,
      message: '错题备注已更新',
      data: wrongAnswer
    });
  } catch (error) {
    console.error('更新错题备注失败:', error);
    res.status(500).json({
      success: false,
      message: '服务器错误，无法更新错题备注'
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
        userId
      }
    });

    if (!wrongAnswer) {
      return res.status(404).json({
        success: false,
        message: '错题记录不存在'
      });
    }

    await wrongAnswer.destroy();

    return res.json({
      success: true,
      message: '已标记为掌握，该题已从错题集中移除'
    });
  } catch (error) {
    console.error('标记为已掌握失败:', error);
    return res.status(500).json({
      success: false,
      message: '服务器错误，标记为已掌握失败'
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
        message: '请提供要删除的错题ID列表'
      });
    }

    await WrongAnswer.destroy({
      where: {
        id: {
          [Op.in]: ids
        },
        userId
      }
    });

    return res.json({
      success: true,
      message: `成功删除${ids.length}条错题记录`
    });
  } catch (error) {
    console.error('批量删除错题失败:', error);
    return res.status(500).json({
      success: false,
      message: '服务器错误，批量删除错题失败'
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
        questionSetId
      },
      order: [['createdAt', 'DESC']]
    });

    return res.json({
      success: true,
      data: wrongAnswers
    });
  } catch (error) {
    console.error('获取题库错题失败:', error);
    return res.status(500).json({
      success: false,
      message: '服务器错误，获取题库错题失败'
    });
  }
};

/**
 * 获取错题详情
 */
export const getWrongAnswerById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;

    const wrongAnswer = await WrongAnswer.findOne({
      where: {
        id,
        userId
      },
      include: [
        {
          model: Question,
          as: 'wrongAnswerQuestion',
          attributes: ['id', 'text', 'questionType', 'explanation']
        },
        {
          model: QuestionSet,
          as: 'questionSet',
          attributes: ['id', 'title', 'description', 'category']
        }
      ]
    });

    if (!wrongAnswer) {
      return res.status(404).json({
        success: false,
        message: '错题不存在或无权访问'
      });
    }

    res.json({
      success: true,
      data: wrongAnswer
    });
  } catch (error) {
    console.error('获取错题详情失败:', error);
    res.status(500).json({
      success: false,
      message: '服务器错误，无法获取错题详情'
    });
  }
};

/**
 * 获取用户的错题列表
 */
export const getUserWrongAnswers = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    const { questionSetId } = req.query;

    const query: any = { userId };
    
    // 如果提供了题库ID，则按题库筛选
    if (questionSetId) {
      query.questionSetId = questionSetId;
    }

    const wrongAnswers = await WrongAnswer.findAll({
      where: query,
      include: [
        {
          model: Question,
          as: 'wrongAnswerQuestion',
          attributes: ['id', 'text', 'questionType', 'explanation']
        },
        {
          model: QuestionSet,
          as: 'questionSet',
          attributes: ['id', 'title', 'description', 'category']
        }
      ],
      order: [['createdAt', 'DESC']]
    });

    res.json({
      success: true,
      data: wrongAnswers
    });
  } catch (error) {
    console.error('获取错题列表失败:', error);
    res.status(500).json({
      success: false,
      message: '服务器错误，无法获取错题列表'
    });
  }
}; 