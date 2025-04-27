import { Request, Response } from 'express';
import QuestionSet from '../models/QuestionSet';
import Question from '../models/Question';
import { Op } from 'sequelize';
import Option from '../models/Option';
import { sequelize } from '../config/db';

// @desc    获取所有题库
// @route   GET /api/question-sets
// @access  Public
export const getAllQuestionSets = async (req: Request, res: Response) => {
  try {
    const questionSets = await QuestionSet.findAll({
      include: [{ 
        model: Question, 
        as: 'questions',
        include: [{ model: Option, as: 'options' }]
      }]
    });
    
    res.json({
      success: true,
      data: questionSets
    });
  } catch (error: any) {
    console.error('获取题库错误:', error);
    res.status(500).json({
      success: false,
      message: error.message || '服务器错误'
    });
  }
};

// @desc    获取特定题库
// @route   GET /api/question-sets/:id
// @access  Public
export const getQuestionSetById = async (req: Request, res: Response) => {
  try {
    const questionSet = await QuestionSet.findByPk(req.params.id, {
      include: [{ 
        model: Question, 
        as: 'questions',
        include: [{ model: Option, as: 'options' }]
      }]
    });
    
    if (!questionSet) {
      return res.status(404).json({
        success: false,
        message: '题库不存在'
      });
    }
    
    res.json({
      success: true,
      data: questionSet
    });
  } catch (error: any) {
    console.error('获取题库详情错误:', error);
    res.status(500).json({
      success: false,
      message: error.message || '服务器错误'
    });
  }
};

// @desc    创建新题库
// @route   POST /api/question-sets
// @access  Private/Admin
export const createQuestionSet = async (req: Request, res: Response) => {
  try {
    const { id, title, description, category, icon, isPaid, price, trialQuestions, questions } = req.body;
    
    // 验证必填字段
    if (!id || !title || !category) {
      return res.status(400).json({
        success: false,
        message: '请提供所有必填字段'
      });
    }
    
    // 检查题库ID是否已存在
    const existingSet = await QuestionSet.findByPk(id);
    if (existingSet) {
      return res.status(400).json({
        success: false,
        message: 'ID已存在，请使用另一个ID'
      });
    }
    
    // 创建题库
    const questionSet = await QuestionSet.create({
      id,
      title,
      description,
      category,
      icon,
      isPaid: isPaid || false,
      price: isPaid ? price : null,
      trialQuestions: isPaid ? trialQuestions : null
    });
    
    // 如果提供了题目，则创建题目
    if (questions && questions.length > 0) {
      const createdQuestions = await Question.bulkCreate(
        questions.map((q: any) => ({
          ...q,
          questionSetId: questionSet.id
        }))
      );
    }
    
    // 获取带有题目的完整题库
    const fullQuestionSet = await QuestionSet.findByPk(questionSet.id, {
      include: [{ 
        model: Question, 
        as: 'questions',
        include: [{ model: Option, as: 'options' }]
      }]
    });
    
    res.status(201).json({
      success: true,
      data: fullQuestionSet,
      message: '题库创建成功'
    });
  } catch (error: any) {
    console.error('创建题库错误:', error);
    res.status(500).json({
      success: false,
      message: error.message || '服务器错误'
    });
  }
};

// @desc    更新题库
// @route   PUT /api/question-sets/:id
// @access  Private/Admin
export const updateQuestionSet = async (req: Request, res: Response) => {
  try {
    const { title, description, category, icon, isPaid, price, trialQuestions, questions } = req.body;
    
    // 查找题库
    const questionSet = await QuestionSet.findByPk(req.params.id);
    if (!questionSet) {
      return res.status(404).json({
        success: false,
        message: '题库不存在'
      });
    }
    
    // 更新题库信息
    await questionSet.update({
      title: title || questionSet.title,
      description: description || questionSet.description,
      category: category || questionSet.category,
      icon: icon || questionSet.icon,
      isPaid: isPaid !== undefined ? isPaid : questionSet.isPaid,
      price: isPaid ? price : null,
      trialQuestions: isPaid ? trialQuestions : null
    });
    
    // 如果提供了题目，则更新题目
    if (questions && questions.length > 0) {
      // 先删除所有旧题目
      await Question.destroy({
        where: { questionSetId: questionSet.id }
      });
      
      // 添加新题目
      await Question.bulkCreate(
        questions.map((q: any) => ({
          ...q,
          questionSetId: questionSet.id
        }))
      );
    }
    
    // 获取更新后的完整题库
    const updatedQuestionSet = await QuestionSet.findByPk(questionSet.id, {
      include: [{ 
        model: Question, 
        as: 'questions',
        include: [{ model: Option, as: 'options' }]
      }]
    });
    
    res.json({
      success: true,
      data: updatedQuestionSet,
      message: '题库更新成功'
    });
  } catch (error: any) {
    console.error('更新题库错误:', error);
    res.status(500).json({
      success: false,
      message: error.message || '服务器错误'
    });
  }
};

// @desc    删除题库
// @route   DELETE /api/question-sets/:id
// @access  Private/Admin
export const deleteQuestionSet = async (req: Request, res: Response) => {
  try {
    const questionSet = await QuestionSet.findByPk(req.params.id);
    if (!questionSet) {
      return res.status(404).json({
        success: false,
        message: '题库不存在'
      });
    }
    
    // 删除题库 (关联的题目会通过外键约束自动删除)
    await questionSet.destroy();
    
    res.json({
      success: true,
      message: '题库删除成功'
    });
  } catch (error: any) {
    console.error('删除题库错误:', error);
    res.status(500).json({
      success: false,
      message: error.message || '服务器错误'
    });
  }
};

/**
 * @desc    添加新题目
 * @route   POST /api/questions
 * @access  Admin
 */
export const createQuestion = async (req: Request, res: Response) => {
  try {
    const { 
      questionSetId, 
      text, 
      explanation, 
      questionType,
      options,
      orderIndex 
    } = req.body;

    if (!questionSetId) {
      return res.status(400).json({
        success: false,
        message: '题库ID不能为空'
      });
    }

    if (!text) {
      return res.status(400).json({
        success: false,
        message: '题目内容不能为空'
      });
    }

    if (!Array.isArray(options) || options.length < 2) {
      return res.status(400).json({
        success: false,
        message: '请提供至少两个选项'
      });
    }

    // 使用事务确保题目和选项一起创建成功
    const result = await sequelize.transaction(async (t) => {
      // 创建题目
      const question = await Question.create({
        questionSetId,
        text,
        explanation: explanation || '暂无解析',
        questionType: questionType || 'single',
        orderIndex: orderIndex !== undefined ? orderIndex : 0
      }, { transaction: t });

      // 创建选项
      const optionPromises = options.map((option, index) => {
        return Option.create({
          questionId: question.id,
          text: option.text || `选项 ${index + 1}`,
          isCorrect: !!option.isCorrect,
          optionIndex: option.optionIndex || option.id || String.fromCharCode(65 + index) // A, B, C...
        }, { transaction: t });
      });

      await Promise.all(optionPromises);

      // 返回创建的题目（包含选项）
      return Question.findByPk(question.id, {
        include: [{ model: Option, as: 'options' }],
        transaction: t
      });
    });

    res.status(201).json({
      success: true,
      message: '题目创建成功',
      data: result
    });
  } catch (error: any) {
    console.error('创建题目失败:', error);
    res.status(500).json({
      success: false,
      message: '创建题目失败',
      error: error.message
    });
  }
};

/**
 * @desc    更新题目
 * @route   PUT /api/questions/:id
 * @access  Admin
 */
export const updateQuestion = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { 
      text, 
      explanation, 
      questionType,
      options,
      orderIndex 
    } = req.body;

    // 查找现有题目
    const question = await Question.findByPk(id);
    
    if (!question) {
      return res.status(404).json({
        success: false,
        message: '题目不存在'
      });
    }

    // 使用事务确保题目和选项一起更新成功
    const result = await sequelize.transaction(async (t) => {
      // 更新题目
      await question.update({
        text: text || question.text,
        explanation: explanation || question.explanation,
        questionType: questionType || question.questionType,
        orderIndex: orderIndex !== undefined ? orderIndex : question.orderIndex
      }, { transaction: t });

      // 如果提供了选项，则更新选项
      if (Array.isArray(options)) {
        // 先删除现有选项
        await Option.destroy({
          where: { questionId: id },
          transaction: t
        });

        // 创建新选项
        const optionPromises = options.map((option, index) => {
          return Option.create({
            questionId: id,
            text: option.text || `选项 ${index + 1}`,
            isCorrect: !!option.isCorrect,
            optionIndex: option.optionIndex || option.id || String.fromCharCode(65 + index) // A, B, C...
          }, { transaction: t });
        });

        await Promise.all(optionPromises);
      }

      // 返回更新后的题目（包含选项）
      return Question.findByPk(id, {
        include: [{ model: Option, as: 'options' }],
        transaction: t
      });
    });

    res.status(200).json({
      success: true,
      message: '题目更新成功',
      data: result
    });
  } catch (error: any) {
    console.error('更新题目失败:', error);
    res.status(500).json({
      success: false,
      message: '更新题目失败',
      error: error.message
    });
  }
};

/**
 * @desc    获取题目详情
 * @route   GET /api/questions/:id
 * @access  Public
 */
export const getQuestionById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    const question = await Question.findByPk(id, {
      include: [{ model: Option, as: 'options' }]
    });
    
    if (!question) {
      return res.status(404).json({
        success: false,
        message: '题目不存在'
      });
    }
    
    res.status(200).json({
      success: true,
      data: question
    });
  } catch (error: any) {
    console.error('获取题目失败:', error);
    res.status(500).json({
      success: false,
      message: '获取题目失败',
      error: error.message
    });
  }
};

/**
 * @desc    删除题目
 * @route   DELETE /api/questions/:id
 * @access  Admin
 */
export const deleteQuestion = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    const question = await Question.findByPk(id);
    
    if (!question) {
      return res.status(404).json({
        success: false,
        message: '题目不存在'
      });
    }
    
    // 删除题目（关联的选项会通过外键级联删除）
    await question.destroy();
    
    res.status(200).json({
      success: true,
      message: '题目删除成功'
    });
  } catch (error: any) {
    console.error('删除题目失败:', error);
    res.status(500).json({
      success: false,
      message: '删除题目失败',
      error: error.message
    });
  }
}; 