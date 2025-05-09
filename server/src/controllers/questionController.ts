import { Request, Response } from 'express';
import Question from '../models/Question';
import { sendResponse, sendError } from '../utils/responseUtils';
import Option from '../models/Option';

/**
 * @route GET /api/v1/questions
 * @access Public
 */
export const getQuestions = async (req: Request, res: Response) => {
  try {
    const { questionSetId, page = 1, limit = 10, include } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    const where = questionSetId ? { questionSetId: String(questionSetId) } : {};

    const includeOptions = include === 'options' ? [{
      model: Option,
      as: 'options',
      attributes: ['id', 'text', 'isCorrect', 'optionIndex']
    }] : [];

    const { count, rows: questions } = await Question.findAndCountAll({
      where,
      include: includeOptions,
      limit: Number(limit),
      offset,
      order: [['orderIndex', 'ASC']]
    });

    console.log(`Found ${questions.length} questions with options: ${include === 'options' ? 'yes' : 'no'}`);
    if (questions.length > 0 && include === 'options') {
      console.log(`First question options count: ${(questions[0] as any).options?.length || 0}`);
    }

    // Return response in the format expected by the frontend
    res.status(200).json({
      success: true,
      data: questions
    });
  } catch (error) {
    console.error('获取问题列表失败:', error);
    res.status(500).json({
      success: false,
      message: '获取问题列表失败',
      error: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined
    });
  }
};

/**
 * @route GET /api/v1/questions/:id
 * @access Public
 */
export const getQuestionById = async (req: Request, res: Response) => {
  try {
    const question = await Question.findByPk(req.params.id);
    if (!question) {
      return sendError(res, 404, '问题不存在');
    }
    sendResponse(res, 200, '获取问题成功', question);
  } catch (error) {
    sendError(res, 500, '获取问题失败', error);
  }
};

/**
 * @route POST /api/v1/questions
 * @access Admin
 */
export const createQuestion = async (req: Request, res: Response) => {
  try {
    const { questionSetId, text, questionType, explanation, orderIndex } = req.body;

    if (!questionSetId || !text || !questionType || !explanation) {
      return sendError(res, 400, '缺少必要字段');
    }

      const question = await Question.create({
        questionSetId,
        text,
      questionType,
      explanation,
      orderIndex: orderIndex || 0
    });

    sendResponse(res, 201, '创建问题成功', question);
  } catch (error) {
    sendError(res, 500, '创建问题失败', error);
  }
};

/**
 * @route PUT /api/v1/questions/:id
 * @access Admin
 */
export const updateQuestion = async (req: Request, res: Response) => {
  try {
    const question = await Question.findByPk(req.params.id);
    if (!question) {
      return sendError(res, 404, '问题不存在');
    }

    const { text, questionType, explanation, orderIndex } = req.body;
      await question.update({
      text,
      questionType,
      explanation,
      orderIndex
    });

    sendResponse(res, 200, '更新问题成功', question);
  } catch (error) {
    sendError(res, 500, '更新问题失败', error);
  }
};

/**
 * @route DELETE /api/v1/questions/:id
 * @access Admin
 */
export const deleteQuestion = async (req: Request, res: Response) => {
  try {
    const question = await Question.findByPk(req.params.id);
    if (!question) {
      return sendError(res, 404, '问题不存在');
    }

    await question.destroy();
    sendResponse(res, 200, '问题删除成功');
  } catch (error) {
    sendError(res, 500, '删除问题失败', error);
  }
};

/**
 * @route GET /api/v1/questions/random/:questionSetId
 * @access Public
 */
export const getRandomQuestion = async (req: Request, res: Response) => {
  try {
    const { questionSetId } = req.query;
    if (!questionSetId) {
      return sendError(res, 400, '缺少问题集ID');
    }

    const count = await Question.count({ where: { questionSetId: String(questionSetId) } });
    if (count === 0) {
      return sendError(res, 404, '该问题集没有可用的问题');
    }

    const randomOffset = Math.floor(Math.random() * count);
    const question = await Question.findOne({
      where: { questionSetId: String(questionSetId) },
      offset: randomOffset
    });

    sendResponse(res, 200, '获取随机问题成功', question);
  } catch (error) {
    sendError(res, 500, '获取随机问题失败', error);
  }
};

// @desc    Get count of questions for a question set
// @route   GET /api/questions/count/:questionSetId
// @access  Public
export const getQuestionCount = async (req: Request, res: Response) => {
  try {
    const { questionSetId } = req.params;
    
    // 验证参数
    if (!questionSetId) {
      return res.status(400).json({ success: false, message: '题库ID不能为空' });
    }
    
    // 查询该题库下的问题数量
    const count = await Question.count({ where: { questionSetId: String(questionSetId) } });
    
    return res.status(200).json({ 
      success: true, 
      count,
      message: `题库 ${questionSetId} 包含 ${count} 个问题`
    });
  } catch (error) {
    console.error('获取题目数量失败:', error);
    return res.status(500).json({ 
      success: false, 
      message: '获取题目数量失败',
      error: (error as Error).message
    });
  }
};

// @desc    Batch upload questions for a question set
// @route   POST /api/questions/batch-upload/:questionSetId
// @access  Admin
export const batchUploadQuestions = async (req: Request, res: Response) => {
  try {
    const { questionSetId } = req.params;
    
    // 验证参数
    if (!questionSetId) {
      return res.status(400).json({ 
        success: false, 
        message: '题库ID不能为空' 
      });
    }
    
    // 处理文件上传
    const files = req.files as any;
    if (!files || Object.keys(files).length === 0) {
      return res.status(400).json({ 
        success: false, 
        message: '没有上传文件' 
      });
    }
    
    // 获取上传的文件
    const file = files.file;
    if (!file) {
      return res.status(400).json({
        success: false,
        message: '文件字段名应为 "file"'
      });
    }
    
    // 分析文件内容，处理文件格式，导入问题
    // 这里应实现实际的处理逻辑，例如解析CSV、Excel等
    
    // 导入成功的问题数量
    let successCount = 0;
    // 导入失败的问题数量
    let failedCount = 0;
    // 错误信息数组
    const errors: string[] = [];
    
    // 导入完成后返回结果
    return res.status(200).json({ 
      success: true, 
      successCount,
      failedCount,
      errors,
      message: `成功导入 ${successCount} 个问题，失败 ${failedCount} 个` 
    });
    
  } catch (error) {
    console.error('批量导入题目失败:', error);
    return res.status(500).json({ 
      success: false, 
      message: '批量导入题目失败',
      error: (error as Error).message
    });
  }
}; 