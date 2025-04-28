import { Request, Response } from 'express';
import QuestionSet from '../models/QuestionSet';
import User from '../models/User';
import sequelize from '../config/database';
import Question from '../models/Question';
import { RowDataPacket, ResultSetHeader, OkPacket } from 'mysql2';
import Option from '../models/Option';
import { Op, QueryTypes } from 'sequelize';
import { v1 as uuidv1 } from 'uuid';

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
  questions?: Question[];
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

// 添加一个预处理函数来标准化前端传来的数据格式
function normalizeQuestionData(questions: any[]) {
  if (!Array.isArray(questions)) {
    console.warn('questions is not an array:', questions);
    return [];
  }
  
  console.log('正在标准化问题数据，数量:', questions.length);
  console.log('原始问题数据:', JSON.stringify(questions));
  
  return questions.map((q, index) => {
    // Handle potential null question object
    if (!q) {
      console.warn(`Question at index ${index} is null or undefined`);
      return null;
    }
    
    // 记录原始问题数据以帮助调试
    console.log(`处理原始问题 ${index}:`, JSON.stringify(q));
    
    // 处理请求中不同的数据格式
    // 如果是 {id: 1, question: "text"} 格式但没有text字段
    if (q.question !== undefined && q.text === undefined) {
      console.log(`问题 ${index}: 使用 'question' 字段 "${q.question}" 设置为 'text'`);
      q.text = q.question; // 确保text字段存在
    }
    
    // 确保text字段不为null，如果是null或空字符串则提供默认值
    let questionText = '';
    if (q.text !== undefined && q.text !== null) {
      questionText = String(q.text);
    } else if (q.question !== undefined && q.question !== null) {
      questionText = String(q.question);
      // 同时设置q.text，防止后续处理丢失
      q.text = questionText;
    } else {
      questionText = `问题 #${index + 1}`;  // 默认文本
      // 同时设置q.text
      q.text = questionText;
    }
    
    console.log(`问题 ${index} 标准化后的text:`, questionText);
    
    // 确保其他字段不为null
    const explanation = q.explanation !== undefined && q.explanation !== null 
      ? String(q.explanation) 
      : '暂无解析';
      
    const questionType = q.questionType || 'single';
    const orderIndex = q.orderIndex !== undefined ? q.orderIndex : index;
    
    // 标准化问题数据
    const normalizedQuestion = {
      text: questionText.trim(),
      explanation: explanation.trim(),
      questionType,
      orderIndex,
      options: [] as Array<{text: string, isCorrect: boolean, optionIndex: string}>
    };
    
    // 处理选项
    if (Array.isArray(q.options)) {
      console.log(`处理问题 ${index} 的选项数组:`, JSON.stringify(q.options));
      normalizedQuestion.options = q.options
        .filter((opt: any) => opt) // 移除null或undefined选项
        .map((opt: any, j: number) => {
          // 确保选项文本不为null
          let optionText = '';
          if (opt.text !== undefined && opt.text !== null) {
            optionText = String(opt.text);
          } else if (typeof opt === 'object') {
            // 特殊处理可能的格式 {"id":"D", "text":"3333"} 或 {"D":"3333"}
            if (opt.id && typeof opt.id === 'string') {
              // 如果是 {"id":"D"} 格式，尝试找到文本
              if (opt.text) {
                optionText = String(opt.text);
              } else {
                // 检查是否有键与id相同
                const idKey = opt.id;
                if (opt[idKey]) {
                  optionText = String(opt[idKey]);
                  console.log(`从键 ${idKey} 获取选项文本: ${optionText}`);
                }
              }
            } else {
              // 检查是否是 {A: "text"} 格式
              const keys = Object.keys(opt);
              if (keys.length === 1 && keys[0].length === 1) {
                optionText = String(opt[keys[0]]);
                console.log(`从键值对 {${keys[0]}: "${optionText}"} 获取选项文本`);
              }
            }
          }
          
          // 如果还是没有文本，使用默认值
          if (!optionText) {
            optionText = `选项 ${String.fromCharCode(65 + j)}`; // A, B, C...
            console.log(`选项 ${j} 没有找到有效文本，使用默认值: ${optionText}`);
          }
          
          // 选项ID处理
          let optionIndex = '';
          if (typeof opt.optionIndex === 'string') {
            optionIndex = opt.optionIndex;
          } else if (typeof opt.id === 'string') {
            optionIndex = opt.id;
          } else {
            optionIndex = String.fromCharCode(65 + j); // A, B, C...
          }
          
          // 判断是否为正确选项
          let isCorrect = false;
          if (opt.isCorrect === true) {
            isCorrect = true;
          } else if (q.questionType === 'single' && q.correctAnswer === optionIndex) {
            isCorrect = true;
          } else if (q.questionType === 'multiple' && Array.isArray(q.correctAnswer) && q.correctAnswer.includes(optionIndex)) {
            isCorrect = true;
          }
          
          return {
            text: optionText.trim(),
            isCorrect,
            optionIndex
          };
        });
    } else {
      console.warn(`Question ${index+1} has no options array, creating default options`);
      // 创建默认选项
      normalizedQuestion.options = [
        { text: '选项 A', isCorrect: true, optionIndex: 'A' },
        { text: '选项 B', isCorrect: false, optionIndex: 'B' }
      ];
    }
    
    return normalizedQuestion;
  }).filter(q => q !== null); // 移除null的问题
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
    const { page = 1, limit = 10, category, search } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    const where: any = {};
    if (category) {
      where.category = category;
    }
    if (search) {
      where[Op.or] = [
        { title: { [Op.like]: `%${search}%` } },
        { description: { [Op.like]: `%${search}%` } }
      ];
    }

    const { count, rows } = await QuestionSet.findAndCountAll({
      where,
      limit: Number(limit),
      offset,
      order: [['createdAt', 'DESC']]
    });

    sendResponse(res, 200, rows);
  } catch (error) {
    console.error('Get question sets error:', error);
    sendError(res, 500, '获取题库列表失败', error);
  }
};

// @desc    Get question set by ID
// @route   GET /api/v1/question-sets/:id
// @access  Public
export const getQuestionSetById = async (req: Request, res: Response) => {
  try {
    const questionSet = await QuestionSet.findOne({
      where: { id: req.params.id },
      include: [{
        model: Question,
        as: 'questions',
        include: [{
          model: Option,
          as: 'options'
        }]
      }]
    });

    if (questionSet) {
      sendResponse(res, 200, questionSet);
    } else {
      sendError(res, 404, '题库不存在');
    }
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
    const { title, description, category, isFeatured, featuredCategory } = req.body;

    // 验证必填字段
    if (!title || !description || !category) {
      return sendError(res, 400, '请提供标题、描述和分类');
    }

      const questionSet = await QuestionSet.create({
        title,
        description,
        category,
      icon: 'default',
      isPaid: false,
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
      const { title, description, category, isFeatured, featuredCategory } = req.body;

      questionSet.title = title || questionSet.title;
      questionSet.description = description || questionSet.description;
      questionSet.category = category || questionSet.category;
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
    const { category } = req.query;
    const where: any = { isFeatured: true };
    
    if (category) {
      where.category = category;
    }

    const questionSets = await QuestionSet.findAll({
      where,
      order: [['createdAt', 'DESC']]
    });

    sendResponse(res, 200, questionSets);
  } catch (error) {
    console.error('Get featured question sets error:', error);
    sendError(res, 500, '获取精选题库失败', error);
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
    const decodedCategory = decodeURIComponent(category);
    
    const questionSets = await QuestionSet.findAll({
      where: { category: decodedCategory },
      include: [{
        model: Question,
        as: 'questions',
        include: [{
          model: Option,
          as: 'options'
        }]
      }],
      order: [['createdAt', 'DESC']]
    });

    const formattedQuestionSets = questionSets.map(set => ({
      id: set.id,
      title: set.title,
      description: set.description,
      category: set.category,
      icon: set.icon,
      isPaid: set.isPaid,
      price: set.price,
      trialQuestions: set.trialQuestions,
      isFeatured: set.isFeatured,
      questionCount: set.questions?.length || 0,
      questions: set.questions,
      createdAt: set.createdAt,
      updatedAt: set.updatedAt
    }));

    sendResponse(res, 200, formattedQuestionSets);
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