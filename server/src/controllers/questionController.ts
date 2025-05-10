import { Request, Response } from 'express';
import Question from '../models/Question';
import { sendResponse, sendError } from '../utils/responseUtils';
import Option from '../models/Option';
import { QueryTypes } from 'sequelize';
import sequelize from '../config/database';
import { v4 as uuidv4 } from 'uuid';

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
    console.log('[API] Received request for question count:', req.params);
    const { questionSetId } = req.params;
    
    // 验证参数
    if (!questionSetId) {
      console.log('[API] Missing questionSetId in request params');
      return res.status(400).json({ 
        success: false, 
        message: '题库ID不能为空',
        count: 0
      });
    }
    
    // 使用原生SQL查询以确保准确性
    const [result] = await sequelize.query(
      'SELECT COUNT(*) as count FROM questions WHERE questionSetId = :questionSetId',
      {
        replacements: { questionSetId },
        type: QueryTypes.SELECT
      }
    );
    
    // 解析结果，确保返回有效的数字
    let count = 0;
    if (result && typeof (result as any).count !== 'undefined') {
      count = parseInt((result as any).count, 10);
    }
    
    console.log(`[API] Question count for questionSetId=${questionSetId}: ${count}`);
    
    // 返回标准格式的响应
    return res.status(200).json({
      success: true,
      count,
      message: '获取题目数量成功'
    });
  } catch (error) {
    console.error('[API] Error getting question count:', error);
    
    // 确保返回一个有效的响应，即使发生错误
    return res.status(500).json({
      success: false,
      count: 0,
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
    console.log(`[API] Received batch upload request for question set`);
    console.log(`[API] Request params:`, req.params);
    console.log(`[API] Request has file:`, !!req.file);
    
    const { questionSetId } = req.params;
    
    // 验证参数
    if (!questionSetId) {
      console.log(`[API] Missing questionSetId in request params`);
      return res.status(400).json({ 
        success: false, 
        message: '题库ID不能为空' 
      });
    }
    
    console.log(`[API] 使用题库ID: ${questionSetId}`);
    
    // 检查题库是否存在
    const QuestionSet = sequelize.models.QuestionSet;
    if (QuestionSet) {
      try {
        const questionSet = await QuestionSet.findByPk(questionSetId);
        if (!questionSet) {
          console.log(`[API] QuestionSet not found with ID: ${questionSetId}`);
          return res.status(404).json({
            success: false,
            message: '题库不存在'
          });
        }
        console.log(`[API] 确认题库存在: ${questionSetId}`);
      } catch (error) {
        console.error('[API] Error checking QuestionSet:', error);
        return res.status(500).json({
          success: false,
          message: '检查题库失败',
          error: (error as Error).message
        });
      }
    } else {
      console.log(`[API] 警告: 无法获取QuestionSet模型，跳过题库存在性验证`);
    }
    
    // 检查上传的文件 - 使用multer中间件处理后的req.file
    if (!req.file) {
      console.log(`[API] No file uploaded in request`);
      return res.status(400).json({ 
        success: false, 
        message: '没有上传文件' 
      });
    }
    
    console.log(`[API] Received file: ${req.file.originalname} size: ${req.file.size}`);
    
    // 读取文件内容
    const fs = require('fs');
    const path = require('path');
    const fileContent = fs.readFileSync(req.file.path, 'utf8');
    
    // 解析文件内容 - 假设是按行分隔的文本文件
    const lines = fileContent.split('\n').filter((line: string) => line.trim() !== '');
    console.log(`[API] 解析到 ${lines.length} 行数据`);
    
    // 导入成功的问题数量
    let successCount = 0;
    // 导入失败的问题数量
    let failedCount = 0;
    // 错误信息数组
    const errors: string[] = [];
    // 成功创建的问题ID集合
    const createdQuestionIds: string[] = [];
    
    // 处理每一行数据
    for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
      const line = lines[lineIndex];
      
      try {
        console.log(`[API] 处理第 ${lineIndex + 1} 行数据`);
        
        // 分割数据字段，使用|作为分隔符
        const fields = line.split('|').map((field: string) => field.trim());
        
        if (fields.length < 3) {
          failedCount++;
          errors.push(`行 ${lineIndex + 1}: 格式不正确: ${line.substring(0, 50)}...`);
          continue;
        }
        
        // 解析字段 - 正确解析我们的模板格式
        const questionText = fields[0];
        
        // 处理不同的字段数量情况
        let options: string[] = [];
        let explanation: string = '';
        
        if (fields.length >= 7) {
          // 标准格式: 问题|选项A|选项B|选项C|选项D|正确答案|解析
          options = fields.slice(1, 5);  // 四个选项A,B,C,D
          explanation = fields[6];       // 第7个元素是解析
        } else if (fields.length === 6) {
          // 少一个字段: 问题|选项A|选项B|选项C|选项D|正确答案
          options = fields.slice(1, 5);
          explanation = '';
        } else if (fields.length === 5) {
          // 三个选项: 问题|选项A|选项B|选项C|正确答案
          options = fields.slice(1, 4);
          explanation = '';
        } else if (fields.length === 4) {
          // 两个选项: 问题|选项A|选项B|正确答案
          options = fields.slice(1, 3);
          explanation = '';
        } else {
          // 不支持的格式
          failedCount++;
          errors.push(`行 ${lineIndex + 1}: 字段数量不足: ${line.substring(0, 50)}...`);
          continue;
        }
        
        // 获取正确答案字段位置（总是倒数第二个或倒数第一个字段）
        const correctAnswer = fields.length > 1 ? fields[fields.length - (fields.length > 5 ? 2 : 1)].trim() : '';
        
        // 检查答案是否包含英文逗号，真正用于多选题答案分割
        // 只有当答案中包含多个字母（如"A,B"）时才视为多选题
        const isMultipleChoice = correctAnswer.includes(',') && correctAnswer.split(',').length > 1;
        
        // 处理正确答案 - 修复单选题被识别为多选题的问题
        const correctAnswers = isMultipleChoice 
            ? correctAnswer.split(',').map((a: string) => a.trim().toUpperCase()) 
            : [correctAnswer.trim().toUpperCase()];
        
        // 验证正确答案格式 - 必须是有效的选项字母 (A, B, C, D...)
        const validAnswers = correctAnswers.filter((answer: string) => {
          const index = answer.charCodeAt(0) - 'A'.charCodeAt(0);
          return index >= 0 && index < options.length;
        });
        
        if (validAnswers.length === 0) {
          failedCount++;
          errors.push(`行 ${lineIndex + 1}: 无效的正确答案 "${correctAnswer}": ${line.substring(0, 50)}...`);
          console.log(`[API] Invalid correct answers: "${correctAnswer}" for question "${questionText.substring(0, 30)}..."`);
          continue;
        }
        
        console.log(`[API] Parsed question: "${questionText.substring(0, 30)}...", ${options.length} options, answers: ${correctAnswers.join(',')}, explanation: ${explanation.substring(0, 20)}...`);
        
        if (options.length < 2) {
          failedCount++;
          errors.push(`行 ${lineIndex + 1}: 选项不足: ${line.substring(0, 50)}...`);
          continue;
        }
        
        try {
          // 最简单的方式：直接使用原始SQL创建问题和选项
          // 1. 首先创建问题 - 使用SQL直接插入
          const newQuestionId = uuidv4();
          
          console.log(`[API] 正在创建问题, ID: ${newQuestionId}`);
          
          // 使用原始SQL插入问题
          await sequelize.query(
            `INSERT INTO questions (id, questionSetId, text, questionType, explanation, orderIndex, createdAt, updatedAt) 
             VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())`,
            {
              replacements: [
                newQuestionId,
                questionSetId,
                questionText,
                isMultipleChoice ? 'multiple' : 'single',
                explanation || '无解析',
                lineIndex
              ]
            }
          );
          
          console.log(`[API] 问题创建成功, ID: ${newQuestionId}`);
          
          // 2. 为每个选项创建记录 - 使用SQL直接插入
          const optionPromises = options.map(async (optionText, i) => {
            const optionId = uuidv4();
            const optionLetter = String.fromCharCode(65 + i); // A, B, C, D...
            const isCorrect = correctAnswers.includes(optionLetter);
            
            console.log(`[API] 正在创建选项 ${optionLetter}, ID: ${optionId}, 问题ID: ${newQuestionId}`);
            
            // 使用原始SQL插入选项
            await sequelize.query(
              `INSERT INTO options (id, questionId, text, isCorrect, optionIndex, createdAt, updatedAt) 
               VALUES (?, ?, ?, ?, ?, NOW(), NOW())`,
              {
                replacements: [
                  optionId,
                  newQuestionId,
                  optionText,
                  isCorrect ? 1 : 0,
                  optionLetter
                ]
              }
            );
            
            console.log(`[API] 选项 ${optionLetter} 创建成功, ID: ${optionId}`);
            
            return { id: optionId, optionIndex: optionLetter, isCorrect };
          });
          
          // 等待所有选项创建完成
          const createdOptions = await Promise.all(optionPromises);
          
          console.log(`[API] 问题 ${newQuestionId} 的所有选项创建成功, 共 ${createdOptions.length} 个`);
          
          // 添加到成功列表
          createdQuestionIds.push(newQuestionId);
          successCount++;
        } catch (error) {
          // 处理错误
          failedCount++;
          const errorMessage = error instanceof Error ? error.message : '未知错误';
          errors.push(`行 ${lineIndex + 1}: ${errorMessage}`);
          console.error(`[API] 第 ${lineIndex + 1} 行处理失败:`, error);
        }
      } catch (parseError) {
        // 解析失败
        failedCount++;
        const errorLine = line.substring(0, 50);
        const errorMessage = parseError instanceof Error ? parseError.message : '未知错误';
        errors.push(`行 ${lineIndex + 1}: 解析失败: ${errorLine}... - ${errorMessage}`);
        console.error(`[API] 解析行 ${lineIndex + 1} 失败:`, parseError);
      }
    }
    
    // 清理上传的临时文件
    try {
      fs.unlinkSync(req.file.path);
      console.log(`[API] 清理临时文件: ${req.file.path}`);
    } catch (cleanupError) {
      console.error(`[API] 清理临时文件失败:`, cleanupError);
    }
    
    console.log(`[API] 批量导入完成. 成功: ${successCount}, 失败: ${failedCount}`);
    if (createdQuestionIds.length > 0) {
      console.log(`[API] 创建的问题ID列表:`, createdQuestionIds);
    }
    
    // 导入完成后返回结果
    return res.status(200).json({ 
      success: true, 
      successCount,
      failedCount,
      errors: errors.length > 0 ? errors : undefined,
      message: `成功导入 ${successCount} 个问题，失败 ${failedCount} 个` 
    });
    
  } catch (error) {
    console.error('[API] 批量导入题目失败:', error);
    return res.status(500).json({ 
      success: false, 
      message: '批量导入题目失败',
      error: (error as Error).message
    });
  }
}; 