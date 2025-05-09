import { Request, Response } from 'express';
import QuestionSet from '../models/QuestionSet';
import User from '../models/User';
import sequelize from '../config/database';
import Question from '../models/Question';
import { RowDataPacket, ResultSetHeader, OkPacket } from 'mysql2';
import Option from '../models/Option';
import { Op, QueryTypes } from 'sequelize';
import { v1 as uuidv1 } from 'uuid';
import { setupAssociations } from '../models/associations';
import { questionSetAttributes } from '../utils/sequelizeHelpers';
import { withQuestionSetAttributes } from '../utils/applyFieldMappings';

// 定义数据库查询结果的接口
interface QuestionSetRow extends RowDataPacket {
  id: string;
  title: string;
  description: string;
  category: string;
  icon: string;
  isPaid: boolean;
  price: number | null;
  trialQuestions: number | null;
  questionCount?: number;
  isFeatured: boolean;
  createdAt: Date;
  updatedAt: Date;
}

interface QuestionRow extends RowDataPacket {
  id: string;
  text: string;
  explanation: string;
  options?: OptionRow[];
}

interface OptionRow extends RowDataPacket {
  id: string;
  text: string;
  isCorrect: boolean;
}

// 新增关联类型接口
interface QuestionSetWithQuestions extends QuestionSet {
  questionSetQuestions?: Question[];
}

// 定义上传请求的数据结构
interface QuestionOption {
  text: string;
  isCorrect: boolean;
  optionIndex?: string;
  id?: string;
}

interface QuestionData {
  id?: string;
  text: string;
  explanation: string;
  questionType?: 'single' | 'multiple';
  orderIndex?: number;
  options: QuestionOption[];
  questionSetId?: string;
}

interface QuestionSetUploadData {
  id: string;
  title: string;
  description: string;
  category: string;
  icon: string;
  isPaid?: boolean;
  price?: number;
  trialQuestions?: number;
  questions?: QuestionData[];
}

// 统一响应格式
const sendResponse = <T>(res: Response, status: number, data: T, message?: string) => {
  res.status(status).json({
    success: status >= 200 && status < 300,
    data,
    message
  });
};

// 统一错误响应
const sendError = (res: Response, status: number, message: string, error?: any) => {
  res.status(status).json({
    success: false,
    message,
    error: process.env.NODE_ENV === 'development' ? error?.message : undefined
  });
};

// @desc    Get all question sets
// @route   GET /api/v1/question-sets
// @access  Public
export const getAllQuestionSets = async (req: Request, res: Response) => {
  try {
    // 获取包含问题数量的题库列表
    const questionSets = await QuestionSet.findAll();
    
    // 为每个题库获取准确的问题数量 - 使用更高效的批量查询
    const questionSetIds = questionSets.map(set => set.id);
    
    console.log(`[QuestionSetController] 正在为 ${questionSetIds.length} 个题库获取问题数量...`);
    
    let questionCountMap = new Map();
    
    if (questionSetIds.length > 0) {
      try {
        const questionCountsQuery = await sequelize.query(`
          SELECT questionSetId, COUNT(*) as count 
          FROM questions 
          WHERE questionSetId IN (:questionSetIds)
          GROUP BY questionSetId
        `, {
          replacements: { 
            questionSetIds: questionSetIds
          },
          type: QueryTypes.SELECT
        });
        
        // 转换为Map以便快速查找
        (questionCountsQuery as any[]).forEach(item => {
          const qsId = item.questionSetId;
          const count = parseInt(item.count) || 0;
          questionCountMap.set(qsId, count);
          console.log(`[QuestionSetController] 题库 ${qsId} 的问题数量: ${count}`);
        });
        
        console.log(`[QuestionSetController] 成功获取 ${questionCountsQuery.length} 个题库的问题数量`);
      } catch (countError) {
        console.error('[QuestionSetController] 获取题库问题数量失败:', countError);
      }
    }
    
    // 为每个题库添加问题数量
    const enhancedSets = questionSets.map(set => {
      const setJSON = set.toJSON();
      const questionCount = questionCountMap.get(set.id) || 0;
      
      return {
        ...setJSON,
        questionCount  // 使用查询结果或默认为0
      };
    });
    
    console.log(`[QuestionSetController] 成功获取${enhancedSets.length}个题库，包含问题数量信息`);
    
    // 记录一些题库的问题数量，用于调试
    if (enhancedSets.length > 0) {
      console.log(`[QuestionSetController] 题库问题数量示例:`);
      enhancedSets.slice(0, 5).forEach(set => {
        console.log(`  - ${set.title}: ${set.questionCount}题`);
      });
    }
    
    res.status(200).json({
      success: true,
      data: enhancedSets
    });
  } catch (error: any) {
    console.error('[QuestionSetController] 获取题库列表失败:', error);
    res.status(500).json({
      success: false,
      message: '获取题库列表失败',
      error: error.message
    });
  }
};

// @desc    Get question set by ID
// @route   GET /api/v1/question-sets/:id
// @access  Public
export const getQuestionSetById = async (req: Request, res: Response) => {
  try {
    console.log(`尝试获取题库，ID: ${req.params.id}`);
    
    const questionSet = await QuestionSet.findByPk(req.params.id, {
      include: [{
        model: Question,
        as: 'questionSetQuestions',
        include: [{
          model: Option,
          as: 'options'
        }]
      }]
    });
    
    if (!questionSet) {
      console.log(`未找到题库，ID: ${req.params.id}`);
      return sendError(res, 404, '题库不存在');
    }
    
    console.log(`题库获取成功，ID: ${questionSet.id}，包含 ${questionSet.questionSetQuestions?.length || 0} 个问题`);
    sendResponse(res, 200, questionSet);
  } catch (error) {
    console.error('Get question set error:', error);
    sendError(res, 500, '获取题库详情失败', error);
  }
};

// @desc    Create question set
// @route   POST /api/v1/question-sets
// @access  Private/Admin
export const createQuestionSet = async (req: Request, res: Response) => {
  try {
    const { 
      title, 
      description, 
      category, 
      isFeatured, 
      featuredCategory, 
      isPaid, 
      price, 
      trialQuestions 
    } = req.body;

    // 验证必填字段
    if (!title || !description || !category) {
      return sendError(res, 400, '请提供标题、描述和分类');
    }

    // 如果是付费题库，验证价格
    if (isPaid && (price === undefined || price <= 0)) {
      return sendError(res, 400, '付费题库必须设置有效的价格');
    }

    const questionSet = await QuestionSet.create({
      title,
      description,
      category,
      icon: 'default',
      isPaid: isPaid || false,
      price: isPaid ? price : null,
      trialQuestions: isPaid ? trialQuestions : null,
      isFeatured: isFeatured || false,
      featuredCategory
    });

    sendResponse(res, 201, questionSet, '题库创建成功');
  } catch (error) {
    console.error('Create question set error:', error);
    sendError(res, 500, '创建题库失败', error);
  }
};

// @desc    Update question set
// @route   PUT /api/v1/question-sets/:id
// @access  Private/Admin
export const updateQuestionSet = async (req: Request, res: Response) => {
  try {
    const questionSet = await QuestionSet.findByPk(req.params.id);

    if (questionSet) {
      const { 
        title, 
        description, 
        category, 
        isFeatured, 
        featuredCategory, 
        isPaid, 
        price, 
        trialQuestions 
      } = req.body;

      // 如果是付费题库，验证价格
      if (isPaid && (price === undefined || price <= 0)) {
        return sendError(res, 400, '付费题库必须设置有效的价格');
      }

      questionSet.title = title || questionSet.title;
      questionSet.description = description || questionSet.description;
      questionSet.category = category || questionSet.category;
      
      // 更新付费相关字段
      if (isPaid !== undefined) {
        questionSet.isPaid = isPaid;
        if (isPaid) {
          questionSet.price = price !== undefined ? price : questionSet.price;
          questionSet.trialQuestions = trialQuestions !== undefined ? trialQuestions : questionSet.trialQuestions;
        } else {
          questionSet.price = undefined;
          questionSet.trialQuestions = undefined;
        }
      }
      
      questionSet.isFeatured = isFeatured !== undefined ? isFeatured : questionSet.isFeatured;
      questionSet.featuredCategory = featuredCategory !== undefined ? featuredCategory : questionSet.featuredCategory;

      const updatedQuestionSet = await questionSet.save();
      sendResponse(res, 200, updatedQuestionSet, '题库更新成功');
    } else {
      sendError(res, 404, '题库不存在');
    }
  } catch (error) {
    console.error('Update question set error:', error);
    sendError(res, 500, '更新题库失败', error);
  }
};

// @desc    Delete question set
// @route   DELETE /api/v1/question-sets/:id
// @access  Private/Admin
export const deleteQuestionSet = async (req: Request, res: Response) => {
  try {
    const questionSet = await QuestionSet.findByPk(req.params.id);

    if (questionSet) {
      await questionSet.destroy();
      sendResponse(res, 200, null, '题库删除成功');
    } else {
      sendError(res, 404, '题库不存在');
    }
  } catch (error) {
    console.error('Delete question set error:', error);
    sendError(res, 500, '删除题库失败', error);
  }
};

// @desc    Get all categories
// @route   GET /api/v1/question-sets/categories
// @access  Public
export const getAllCategories = async (req: Request, res: Response) => {
  try {
    const categories = await QuestionSet.findAll({
      attributes: ['category'],
      group: ['category']
    });

    const categoryList = categories.map(row => row.category);
    
    sendResponse(res, 200, categoryList);
  } catch (error) {
    console.error('获取题库分类列表失败:', error);
    sendError(res, 500, '获取题库分类列表失败', error);
  }
};

// @desc    Get featured question sets
// @route   GET /api/v1/question-sets/featured
// @access  Public
export const getFeaturedQuestionSets = async (req: Request, res: Response) => {
  try {
    const questionSets = await QuestionSet.findAll(withQuestionSetAttributes({
      where: {
        isFeatured: true
      }
    }));

    res.status(200).json({
      success: true,
      data: questionSets
    });
  } catch (error: any) {
    console.error('获取推荐题集失败:', error);
    res.status(500).json({
      success: false,
      message: '获取推荐题集失败',
      error: error.message
    });
  }
};

// @desc    Set question set as featured
// @route   PUT /api/v1/question-sets/:id/featured
// @access  Private/Admin
export const setFeaturedQuestionSet = async (req: Request, res: Response) => {
  try {
    const questionSet = await QuestionSet.findByPk(req.params.id);

    if (questionSet) {
      const { isFeatured, featuredCategory } = req.body;
      
      questionSet.isFeatured = isFeatured;
      questionSet.featuredCategory = featuredCategory;

      const updatedQuestionSet = await questionSet.save();
      sendResponse(res, 200, updatedQuestionSet, '精选题库设置成功');
    } else {
      sendError(res, 404, '题库不存在');
    }
  } catch (error) {
    console.error('Set featured question set error:', error);
    sendError(res, 500, '设置精选题库失败', error);
  }
};

/**
 * @desc    批量上传题库和题目
 * @route   POST /api/question-sets/upload
 * @access  Private/Admin
 */
export const uploadQuestionSets = async (req: Request, res: Response) => {
  try {
    const { questionSets } = req.body as { questionSets: QuestionSetUploadData[] };
    
    if (!questionSets || !Array.isArray(questionSets) || questionSets.length === 0) {
      return res.status(400).json({
        success: false,
        message: '请提供有效的题库数据'
      });
    }
    
    console.log(`接收到 ${questionSets.length} 个题库的批量上传请求`);
    
    const results: Array<{id: string, status: string, message: string, questions: {added: number, updated: number}}> = [];
    
    // 使用事务处理批量上传
    for (const setData of questionSets) {
      // 检查题库ID是否已存在
      const existingSet = await QuestionSet.findByPk(setData.id);
      
      let questionsAdded = 0;
      let questionsUpdated = 0;
      
      if (existingSet) {
        // 如果存在则更新
        console.log(`正在更新题库 ${setData.id}: ${setData.title}`);
        await existingSet.update({
          title: setData.title || existingSet.title,
          description: setData.description || existingSet.description,
          category: setData.category || existingSet.category,
          icon: setData.icon || existingSet.icon,
          isPaid: setData.isPaid !== undefined ? setData.isPaid : existingSet.isPaid,
          price: setData.isPaid && setData.price !== undefined ? setData.price : undefined,
          trialQuestions: setData.isPaid && setData.trialQuestions !== undefined ? setData.trialQuestions : undefined
        });
        
        // 如果提供了题目，则更新题目
        if (Array.isArray(setData.questions) && setData.questions.length > 0) {
          console.log(`处理题库 ${setData.id} 的题目，数量: ${setData.questions.length}`);
          
          // 分类出有ID和无ID的题目
          const questionsWithId = setData.questions.filter(q => q.id);
          const questionsWithoutId = setData.questions.filter(q => !q.id);
          
          console.log(`题库 ${setData.id}: 有ID的题目: ${questionsWithId.length}, 无ID的题目（新增）: ${questionsWithoutId.length}`);
          
          // 获取当前题库的所有题目ID，用于检查哪些需要保留
          const existingQuestions = await Question.findAll({
            where: { questionSetId: setData.id },
            attributes: ['id']
          });
          
          const existingIds = existingQuestions.map(q => q.id);
          const idsToKeep = questionsWithId.map(q => q.id);
          
          // 删除不在更新列表中的题目
          const idsToDelete = existingIds.filter(id => !idsToKeep.includes(id));
          if (idsToDelete.length > 0) {
            console.log(`将删除题库 ${setData.id} 中的 ${idsToDelete.length} 个题目`);
            await Question.destroy({
              where: { 
                id: idsToDelete,
                questionSetId: setData.id 
              }
            });
          }
          
          // 更新有ID的题目
          for (const q of questionsWithId) {
            const existingQuestion = await Question.findOne({
              where: { id: q.id, questionSetId: setData.id }
            });
            
            if (existingQuestion) {
              // 更新现有题目
              console.log(`更新题目 ${q.id}: ${q.text?.substring(0, 30)}...`);
              await existingQuestion.update({
                text: q.text || '',
                explanation: q.explanation || '',
                questionType: q.questionType || 'single',
                orderIndex: q.orderIndex !== undefined ? q.orderIndex : existingQuestion.orderIndex
              });
              
              // 更新选项
              if (q.options && q.options.length > 0) {
                // 先删除现有选项
                await Option.destroy({
                  where: { questionId: q.id }
                });
                
                // 创建新选项
                for (const option of q.options) {
                  await Option.create({
                    questionId: q.id!,  // 使用非空断言，因为在这个上下文中我们已经确认q.id存在
                    text: option.text || '',
                    isCorrect: option.isCorrect,
                    optionIndex: option.optionIndex || option.id || ''
                  });
                }
              }
              questionsUpdated++;
            } else {
              // ID存在但题目不存在，创建新题目
              console.log(`创建指定ID的题目 ${q.id}: ${q.text?.substring(0, 30)}...`);
              const newQuestion = await Question.create({
                id: q.id,
                text: q.text,
                explanation: q.explanation,
                questionSetId: setData.id,
                questionType: q.questionType || 'single',
                orderIndex: q.orderIndex !== undefined ? q.orderIndex : 0
              });
              
              // 创建选项
              if (q.options && q.options.length > 0) {
                for (const option of q.options) {
                  await Option.create({
                    questionId: newQuestion.id,
                    text: option.text || '',
                    isCorrect: option.isCorrect,
                    optionIndex: option.optionIndex || option.id || ''
                  });
                }
              }
              questionsAdded++;
            }
          }
          
          // 创建没有ID的新题目
          for (let i = 0; i < questionsWithoutId.length; i++) {
            const q = questionsWithoutId[i];
            console.log(`创建新题目 ${i+1}: ${q.text?.substring(0, 30)}...`);
            
            const newQuestion = await Question.create({
              text: q.text,
              explanation: q.explanation,
              questionSetId: setData.id,
              questionType: q.questionType || 'single',
              orderIndex: q.orderIndex !== undefined ? q.orderIndex : i
            });
            
            // 创建选项
            if (q.options && q.options.length > 0) {
              for (const option of q.options) {
                await Option.create({
                  questionId: newQuestion.id,
                  text: option.text || '',
                  isCorrect: option.isCorrect,
                  optionIndex: option.optionIndex || option.id || ''
                });
              }
            }
            questionsAdded++;
          }
        }
        
        results.push({
          id: setData.id,
          status: 'updated',
          message: '题库更新成功',
          questions: {
            added: questionsAdded,
            updated: questionsUpdated
          }
        });
      } else {
        // 如果不存在则创建
        console.log(`创建新题库 ${setData.id}: ${setData.title}`);
        const newQuestionSet = await QuestionSet.create({
          id: setData.id,
          title: setData.title,
          description: setData.description,
          category: setData.category,
          icon: setData.icon,
          isPaid: setData.isPaid || false,
          price: setData.isPaid && setData.price !== undefined ? setData.price : 0,
          trialQuestions: setData.isPaid && setData.trialQuestions !== undefined ? setData.trialQuestions : 0
        });
        
        // 如果提供了题目，则创建题目
        if (setData.questions && setData.questions.length > 0) {
          for (let i = 0; i < setData.questions.length; i++) {
            const q = setData.questions[i];
            console.log(`创建新题库的题目 ${i+1}: ${q.text?.substring(0, 30)}...`);
            
            // 创建问题
            const questionObj = {
              questionSetId: setData.id,
              text: q.text,
              explanation: q.explanation,
              questionType: q.questionType || 'single',
              orderIndex: q.orderIndex !== undefined ? q.orderIndex : i
            };
            
            // 创建题目
            let question;
            try {
              question = await Question.create(questionObj);
              console.log('题目创建成功，ID:', question.id);
            } catch (error: unknown) {
              console.error('题目创建失败:', error);
              const errorMessage = error instanceof Error ? error.message : '未知错误';
              throw new Error(`题目创建失败: ${errorMessage}`);
            }
            
            // 创建问题的选项
            if (q.options && q.options.length > 0) {
              for (const option of q.options) {
                await Option.create({
                  questionId: question.id,
                  text: option.text || '',
                  isCorrect: option.isCorrect,
                  optionIndex: option.optionIndex || option.id || ''
                });
              }
            }
            questionsAdded++;
          }
        }
        
        results.push({
          id: setData.id,
          status: 'created',
          message: '题库创建成功',
          questions: {
            added: questionsAdded,
            updated: 0
          }
        });
      }
    }
    
    sendResponse(res, 201, results, '题库上传成功');
  } catch (error: any) {
    console.error('批量上传题库错误:', error);
    sendError(res, 500, error.message || '服务器错误', error);
  }
};

/**
 * @desc    获取所有题库分类
 * @route   GET /api/question-sets/categories
 * @access  Public
 */
export const getQuestionSetCategories = async (req: Request, res: Response) => {
  try {
    const categories = await QuestionSet.findAll({
      attributes: ['category'],
      group: ['category'],
      order: [['category', 'ASC']]
    });
    
    const categoryList = categories.map(row => row.category);
    
    sendResponse(res, 200, categoryList);
  } catch (error) {
    console.error('获取题库分类列表失败:', error);
    sendError(res, 500, '获取题库分类列表失败', error);
  }
};

/**
 * @desc    按分类获取题库
 * @route   GET /api/question-sets/by-category/:category
 * @access  Public
 */
export const getQuestionSetsByCategory = async (req: Request, res: Response) => {
  const { category } = req.params;
  
  try {
    // 记录日志，但不再显式调用关联设置
    console.log(`尝试获取分类题库，分类: ${category}`);
    
    const decodedCategory = decodeURIComponent(category);
    
    try {
      // 使用原始 SQL 查询获取分类题库
      const [results] = await sequelize.query(
        `SELECT * FROM question_sets WHERE category = ? ORDER BY created_at DESC LIMIT ? OFFSET ?`,
        {
          replacements: [decodedCategory, parseInt(req.query.limit as string) || 10, parseInt(req.query.page as string) || 1],
          type: QueryTypes.SELECT
        }
      ) as any[];
      
      const formattedQuestionSets = [];
      
      if (Array.isArray(results)) {
        for (const set of results) {
          // 获取题目数量
          const [questions] = await sequelize.query(
            `SELECT * FROM questions WHERE questionSetId = ?`,
            {
              replacements: [set.id],
              type: QueryTypes.SELECT
            }
          ) as any[];
          
          const questionsArray = Array.isArray(questions) ? questions : [questions].filter(Boolean);
          
          // 为每个题目获取选项
          const questionsWithOptions = [];
          
          for (const question of questionsArray) {
            if (question && question.id) {
              const [options] = await sequelize.query(
                `SELECT * FROM options WHERE questionId = ?`,
                {
                  replacements: [question.id],
                  type: QueryTypes.SELECT
                }
              ) as any[];
              
              questionsWithOptions.push({
                ...question,
                options: Array.isArray(options) ? options : [options].filter(Boolean)
              });
            }
          }
          
          formattedQuestionSets.push({
            ...set,
            questionCount: questionsArray.length,
            questions: questionsWithOptions
          });
        }
      }
      
      sendResponse(res, 200, formattedQuestionSets);
    } catch (sqlError) {
      console.error('SQL查询错误:', sqlError);
      sendError(res, 500, '获取分类题库SQL查询错误', sqlError);
    }
  } catch (error: any) {
    console.error('获取分类题库失败:', error);
    sendError(res, 500, '获取分类题库失败', error);
  }
};

// @desc    Add a question to a question set
// @route   POST /api/v1/question-sets/:id/questions
// @access  Private/Admin
export const addQuestionToQuestionSet = async (req: Request, res: Response) => {
  try {
    // 记录日志，但不再显式调用关联设置
    console.log(`尝试向题库添加题目，题库ID: ${req.params.id}`);
    
    const { id } = req.params;
    const questionData = req.body;
    
    // 验证必要的字段
    if (!questionData.text) {
      return sendError(res, 400, '题目文本是必填项');
    }
    
    if (!Array.isArray(questionData.options) || questionData.options.length === 0) {
      return sendError(res, 400, '题目至少需要包含一个选项');
    }
    
    // 查找题库
    const questionSet = await QuestionSet.findByPk(id);
    
    if (!questionSet) {
      return sendError(res, 404, '题库不存在');
    }
    
    // 生成一个基于时间的UUID (v1)
    const questionId = uuidv1();
    console.log('生成基于时间的UUID:', questionId);
    
    // 创建题目对象
    const questionObj = {
      id: questionId,
      questionSetId: id,
      text: questionData.text,
      explanation: questionData.explanation || '',
      questionType: questionData.questionType || 'single',
      orderIndex: questionData.orderIndex || 0
    };
    
    console.log('准备创建题目:', JSON.stringify(questionObj, null, 2));
    
    // 创建题目
    let question;
    try {
      // 直接使用原始SQL插入确保ID被正确设置
      const result = await sequelize.query(
        `INSERT INTO questions (id, questionSetId, text, explanation, questionType, orderIndex, createdAt, updatedAt) 
         VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())`,
        {
          replacements: [
            questionId,
            id,
            questionData.text,
            questionData.explanation || '',
            questionData.questionType || 'single',
            questionData.orderIndex || 0
          ],
          type: QueryTypes.INSERT
        }
      );
      
      console.log('SQL插入结果:', result);
      
      // 再次查询确认题目已创建
      question = await Question.findByPk(questionId);
      
      if (!question) {
        throw new Error(`题目插入成功但无法检索，ID: ${questionId}`);
      }
      
      console.log('题目创建成功，ID:', question.id);
    } catch (error: any) {
      console.error('题目创建SQL错误:', error);
      return sendError(res, 500, `创建题目SQL错误: ${error.message}`, error);
    }
    
    // 创建选项
    const createdOptions = [];
    try {
      for (let i = 0; i < questionData.options.length; i++) {
        const option = questionData.options[i];
        const optionIndex = option.optionIndex || String.fromCharCode(65 + i); // A, B, C...
        
        // 生成选项ID
        const optionId = uuidv1();
        
        // 使用原始SQL插入选项
        await sequelize.query(
          `INSERT INTO options (id, questionId, text, isCorrect, optionIndex, createdAt, updatedAt)
           VALUES (?, ?, ?, ?, ?, NOW(), NOW())`,
          {
            replacements: [
              optionId,
              questionId,
              option.text || '',
              option.isCorrect ? 1 : 0,
              optionIndex
            ],
            type: QueryTypes.INSERT
          }
        );
        
        console.log(`选项 ${optionIndex} 创建成功, ID: ${optionId}`);
        createdOptions.push({
          id: optionId,
          questionId,
          text: option.text || '',
          isCorrect: !!option.isCorrect,
          optionIndex
        });
      }
    } catch (error: any) {
      console.error('创建选项错误:', error);
      // 如果创建选项失败，删除已创建的题目
      if (question) {
        await sequelize.query(
          `DELETE FROM questions WHERE id = ?`,
          {
            replacements: [questionId],
            type: QueryTypes.DELETE
          }
        );
      }
      return sendError(res, 500, `创建选项失败: ${error.message}`, error);
    }
    
    if (createdOptions.length === 0) {
      // 如果没有创建任何选项，删除题目
      await sequelize.query(
        `DELETE FROM questions WHERE id = ?`,
        {
          replacements: [questionId],
          type: QueryTypes.DELETE
        }
      );
      return sendError(res, 500, '未能创建任何选项');
    }
    
    // 获取完整的题目和选项
    try {
      const completeQuestion = await Question.findByPk(questionId, {
        include: [{
          model: Option,
          as: 'options'
        }]
      });
      
      if (!completeQuestion) {
        throw new Error(`无法检索完整题目，ID: ${questionId}`);
      }
      
      // 不尝试直接访问options属性，直接使用简单日志
      console.log('成功检索完整题目:', {
        id: completeQuestion.id,
        text: completeQuestion.text
      });
      
      return sendResponse(res, 201, completeQuestion, '题目添加成功');
    } catch (error: any) {
      console.error('检索完整题目错误:', error);
      return sendError(res, 500, `检索完整题目失败: ${error.message}`, error);
    }
  } catch (error: any) {
    console.error('添加题目整体错误:', error);
    return sendError(res, 500, `添加题目失败: ${error.message}`, error);
  }
}; 