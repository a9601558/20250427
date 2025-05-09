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
    
    // 检查上传的文件 - 使用multer中间件处理后的req.file
    if (!req.file) {
      return res.status(400).json({ 
        success: false, 
        message: '没有上传文件' 
      });
    }
    
    console.log('Received file:', req.file.originalname, 'size:', req.file.size);
    
    // 读取文件内容
    const fs = require('fs');
    const path = require('path');
    const fileContent = fs.readFileSync(req.file.path, 'utf8');
    
    // 解析文件内容 - 假设是按行分隔的文本文件
    const lines = fileContent.split('\n').filter((line: string) => line.trim() !== '');
    console.log(`解析到 ${lines.length} 行数据`);
    
    // 导入成功的问题数量
    let successCount = 0;
    // 导入失败的问题数量
    let failedCount = 0;
    // 错误信息数组
    const errors: string[] = [];
    
    // 处理每一行数据
    for (const line of lines) {
      try {
        // 分割数据字段，使用|作为分隔符
        const fields = line.split('|').map((field: string) => field.trim());
        
        if (fields.length < 3) {
          failedCount++;
          errors.push(`行格式不正确: ${line.substring(0, 50)}...`);
          continue;
        }
        
        // 解析字段
        const questionText = fields[0];
        const options = fields.slice(1, fields.length - 2);
        const correctAnswers = fields[fields.length - 2].split(',').map((a: string) => a.trim().toUpperCase());
        const explanation = fields[fields.length - 1] || '';
        
        if (options.length < 2) {
          failedCount++;
          errors.push(`选项不足: ${line.substring(0, 50)}...`);
          continue;
        }
        
        // 创建问题
        const question = await Question.create({
          questionSetId,
          text: questionText,
          questionType: options.length > 1 ? 'multiple' : 'single',
          explanation,
          orderIndex: successCount
        });
        
        // 创建选项
        let hasCorrectOption = false;
        for (let i = 0; i < options.length; i++) {
          const optionLetter = String.fromCharCode(65 + i); // A, B, C, D...
          const isCorrect = correctAnswers.includes(optionLetter);
          
          if (isCorrect) {
            hasCorrectOption = true;
          }
          
          await Option.create({
            questionId: question.id,
            text: options[i],
            isCorrect,
            optionIndex: optionLetter
          });
        }
        
        if (!hasCorrectOption) {
          await question.destroy();
          failedCount++;
          errors.push(`没有正确选项: ${line.substring(0, 50)}...`);
          continue;
        }
        
        successCount++;
      } catch (error) {
        failedCount++;
        errors.push(`处理失败: ${line.substring(0, 50)}... - ${(error as Error).message}`);
      }
    }
    
    // 清理上传的临时文件
    fs.unlinkSync(req.file.path);
    
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