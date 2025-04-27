import { Request, Response } from 'express';
import QuestionSet from '../models/QuestionSet';
import Question from '../models/Question';
import { Op } from 'sequelize';

// @desc    获取所有题库
// @route   GET /api/question-sets
// @access  Public
export const getAllQuestionSets = async (req: Request, res: Response) => {
  try {
    const questionSets = await QuestionSet.findAll({
      include: [{ model: Question, as: 'questions' }]
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
      include: [{ model: Question, as: 'questions' }]
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
      include: [{ model: Question, as: 'questions' }]
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
      include: [{ model: Question, as: 'questions' }]
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