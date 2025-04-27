import { Request, Response } from 'express';
import QuestionSet from '../models/QuestionSet';
import User from '../models/User';
import db from '../config/db';
import Question from '../models/Question';
import { RowDataPacket, ResultSetHeader, OkPacket } from 'mysql2';
import Option from '../models/Option';
import { sequelize } from '../config/db';

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
  questions?: Array<{
    id: string;
    text: string;
    explanation: string;
    questionType: string;
    orderIndex: number;
    options: Array<{
      id: string;
      text: string;
      isCorrect: boolean;
      optionIndex: string;
    }>;
  }>;
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

/**
 * @desc    获取所有题库
 * @route   GET /api/question-sets
 * @access  Public
 */
export const getAllQuestionSets = async (req: Request, res: Response) => {
  try {
    // 执行SQL查询
    const [questionSets] = await db.execute<QuestionSetRow[]>(`
      SELECT 
        qs.id, 
        qs.title, 
        qs.description, 
        qs.category, 
        qs.icon, 
        qs.isPaid, 
        qs.price, 
        qs.trialQuestions,
        COUNT(q.id) AS questionCount
      FROM 
        question_sets qs
      LEFT JOIN 
        questions q ON qs.id = q.questionSetId
      GROUP BY 
        qs.id
      ORDER BY 
        qs.createdAt DESC
    `);

    res.status(200).json({
      success: true,
      data: questionSets
    });
  } catch (error: any) {
    console.error('获取题库列表失败:', error);
    res.status(500).json({
      success: false,
      message: '获取题库列表失败',
      error: error.message
    });
  }
};

/**
 * @desc    获取题库详情（包含问题和选项）
 * @route   GET /api/question-sets/:id
 * @access  Public/Private (部分内容需要购买)
 */
export const getQuestionSetById = async (req: Request, res: Response) => {
  const { id } = req.params;

  try {
    // 使用Sequelize的关联查询获取题库及其问题和选项
    const questionSet = await QuestionSet.findByPk(id, {
      include: [
        {
          model: Question,
          as: 'questions',
          include: [
            {
              model: Option,
              as: 'options',
            }
          ]
        }
      ]
    });

    if (!questionSet) {
      return res.status(404).json({
        success: false,
        message: '题库不存在'
      });
    }

    // 转换为前端期望的格式并使用类型断言
    const plainData = questionSet.get({ plain: true }) as unknown as QuestionSetWithQuestions;
    const result = {
      ...plainData,
      questions: plainData.questions?.map(q => ({
        id: q.id,
        text: q.text,
        explanation: q.explanation,
        questionType: q.questionType,
        orderIndex: q.orderIndex,
        options: q.options.map(o => ({
          id: o.id,
          text: o.text,
          isCorrect: o.isCorrect,
          optionIndex: o.optionIndex
        }))
      })) || []
    };

    res.status(200).json({
      success: true,
      data: result
    });
  } catch (error: any) {
    console.error('获取题库详情失败:', error);
    res.status(500).json({
      success: false,
      message: '获取题库详情失败',
      error: error.message
    });
  }
};

/**
 * @desc    创建题库
 * @route   POST /api/question-sets
 * @access  Admin
 */
export const createQuestionSet = async (req: Request, res: Response) => {
  try {
    const { 
      id,
      title, 
      description, 
      category, 
      icon, 
      isPaid, 
      price, 
      trialQuestions,
      questions
    } = req.body;

    // 验证基本信息
    if (!title) {
      return res.status(400).json({
        success: false,
        message: '题库标题不能为空'
      });
    }

    console.log('接收到的创建题库请求:', JSON.stringify({
      id, title, description, category, icon, isPaid,
      questionsCount: Array.isArray(questions) ? questions.length : 0
    }));

    // 使用Sequelize的事务处理
    const result = await sequelize.transaction(async (t) => {
      // 创建题库
      const questionSet = await QuestionSet.create({
        id: id, // 使用前端提供的ID或生成新的
        title,
        description,
        category,
        icon: icon || 'book',
        isPaid: isPaid || false,
        price: isPaid ? price : null,
        trialQuestions: isPaid ? trialQuestions : null,
        isFeatured: false
      }, { transaction: t });

      // 如果有问题数据，则创建问题和选项
      if (Array.isArray(questions) && questions.length > 0) {
        console.log(`处理 ${questions.length} 个问题`);
        
        for (let i = 0; i < questions.length; i++) {
          const q = questions[i];
          
          // 适配前端数据格式，处理question/text字段差异
          const questionText = q.text || q.question || '';
          if (!questionText) {
            console.warn(`问题 ${i+1} 缺少文本内容，跳过`);
            continue;
          }
          
          console.log(`创建问题 ${i+1}: ${questionText.substring(0, 30)}...`);
          
          // 创建问题
          const questionRecord = await Question.create({
            text: questionText,
            explanation: q.explanation || '暂无解析',
            questionSetId: questionSet.id,
            questionType: q.questionType || 'single',
            orderIndex: q.orderIndex !== undefined ? q.orderIndex : i
          }, { transaction: t });
          
          // 如果有选项数据，则创建选项
          if (Array.isArray(q.options) && q.options.length > 0) {
            console.log(`处理问题 ${i+1} 的 ${q.options.length} 个选项`);
            
            const optionPromises = q.options.map((opt: any, j: number) => {
              const optionIndex = opt.id || String.fromCharCode(65 + j); // 使用前端提供的ID或生成 A, B, C...
              
              // 处理正确答案标记
              let isCorrect = false;
              if (q.questionType === 'single' && q.correctAnswer === optionIndex) {
                isCorrect = true;
              } else if (q.questionType === 'multiple' && Array.isArray(q.correctAnswer) && q.correctAnswer.includes(optionIndex)) {
                isCorrect = true;
              } else if (opt.isCorrect) {
                isCorrect = true;
              }
              
              console.log(`- 选项 ${optionIndex}: ${opt.text.substring(0, 20)}... 正确: ${isCorrect}`);
              
              return Option.create({
                questionId: questionRecord.id,
                text: opt.text,
                isCorrect: isCorrect,
                optionIndex: optionIndex
              }, { transaction: t });
            });
            
            await Promise.all(optionPromises);
          } else {
            console.warn(`问题 ${i+1} 没有选项数据`);
          }
        }
      }
      
      // 获取新创建的题库（包含问题和选项）
      const createdQuestionSet = await QuestionSet.findByPk(questionSet.id, {
        include: [
          {
            model: Question,
            as: 'questions',
            include: [{ model: Option, as: 'options' }]
          }
        ],
        transaction: t
      });
      
      return createdQuestionSet;
    });

    res.status(201).json({
      success: true,
      message: '题库创建成功',
      data: result
    });
  } catch (error: any) {
    console.error('创建题库失败:', error);
    res.status(500).json({
      success: false,
      message: '创建题库失败',
      error: error.message
    });
  }
};

/**
 * @desc    更新题库
 * @route   PUT /api/question-sets/:id
 * @access  Admin
 */
export const updateQuestionSet = async (req: Request, res: Response) => {
  const { id } = req.params;
  let { 
    title, 
    description, 
    category, 
    icon, 
    isPaid, 
    price, 
    trialQuestions,
    questions,
    isFeatured,
    featuredCategory
  } = req.body;

  try {
    console.log(`Received update request for question set ${id}`);
    console.log('Request body summary:', JSON.stringify({
      title,
      description,
      category,
      questionCount: questions?.length || 0
    }));
    
    // 特殊处理: 如果前端传来的请求体包含格式为 {question: "xxx"} 的问题，转换为 {text: "xxx"}
    if (Array.isArray(questions)) {
      console.log(`预处理 ${questions.length} 个问题的请求数据`);
      questions = questions.map((q, index) => {
        if (!q) return q;
        
        // 直接输出原始问题对象帮助调试
        console.log(`原始问题 ${index}:`, JSON.stringify(q));
        
        // 处理 {id: X, question: "xxx"} 格式
        if (q.question !== undefined && q.text === undefined) {
          console.log(`问题 ${index}: 转换 question 字段 "${q.question}" 到 text 字段`);
          return { ...q, text: q.question };
        }
        
        return q;
      });
    }
    
    // 标准化问题数据，确保格式一致
    if (Array.isArray(questions) && questions.length > 0) {
      questions = normalizeQuestionData(questions);
      console.log(`Normalized ${questions.length} questions`);
    }

    // 使用Sequelize事务
    const result = await sequelize.transaction(async (t) => {
      // 查找题库
      const questionSet = await QuestionSet.findByPk(id);
      
      if (!questionSet) {
        // 不要在事务内返回响应，而是抛出错误
        throw new Error('题库不存在');
      }
      
      console.log(`Found question set ${id}, updating basic info`);
      
      // 更新题库基本信息
      await questionSet.update({
        title: title !== undefined ? title : questionSet.title,
        description: description !== undefined ? description : questionSet.description,
        category: category !== undefined ? category : questionSet.category,
        icon: icon !== undefined ? icon : questionSet.icon,
        isPaid: isPaid !== undefined ? isPaid : questionSet.isPaid,
        price: isPaid && price !== undefined ? price : questionSet.price,
        trialQuestions: isPaid && trialQuestions !== undefined ? trialQuestions : questionSet.trialQuestions,
        isFeatured: isFeatured !== undefined ? isFeatured : questionSet.isFeatured,
        featuredCategory: featuredCategory !== undefined ? featuredCategory : questionSet.featuredCategory
      }, { transaction: t });
      
      // 如果提供了问题数据，则更新问题
      if (Array.isArray(questions) && questions.length > 0) {
        console.log(`Updating ${questions.length} questions for set ${id}`);
        
        // 直接检查questions数组，确保每个问题都有text字段
        for (let i = 0; i < questions.length; i++) {
          // 确保question数据中存在text字段
          if (questions[i] && !questions[i].text && (questions[i] as any).question) {
            console.log(`预处理: 问题 ${i+1} 没有text字段但有question字段，复制值`);
            questions[i].text = (questions[i] as any).question;
          }
        }
        
        try {
          // 先删除该题库下的所有问题和选项
          await Question.destroy({
            where: { questionSetId: id },
            transaction: t
          });
          
          // 重新创建问题和选项
          for (let i = 0; i < questions.length; i++) {
            const q = questions[i];
            
            // 详细诊断日志 - 使用最简单的方式输出
            console.log("=============================================");
            console.log("问题创建前调试信息 - 问题 #" + (i+1));
            console.log("q.text = " + q.text);
            console.log("q.question = " + (q as any).question);
            console.log("JSON: " + JSON.stringify(q));
            console.log("=============================================");
            
            // 确保创建的数据绝对不会有null
            const createData = {
              text: String(q.text || '').trim() || `问题 ${i+1}`,
              explanation: String(q.explanation || '暂无解析').trim(),
              questionSetId: id,
              questionType: q.questionType || 'single',
              orderIndex: q.orderIndex !== undefined ? q.orderIndex : i
            };
            
            // 再次验证 text 不为 null
            if (!createData.text) {
              console.error(`警告: 在 create 前 text 为空，强制设置默认值`);
              createData.text = `问题 ${i+1} [自动修复]`;
            }
            
            console.log(`最终创建数据:`, JSON.stringify(createData));
            const question = await Question.create(createData, { transaction: t });
            
            // 创建问题的选项
            if (Array.isArray(q.options) && q.options.length > 0) {
              console.log(`Creating ${q.options.length} options for question ${i+1}`);
              try {
                for (const option of q.options) {
                  if (!option) {
                    console.log('跳过空选项');
                    continue;
                  }
                  
                  // 确保选项文本不为空
                  let optionText = option.text || '';
                  if (!optionText && option.id) {
                    // 尝试从ID为键的属性中获取文本
                    const idKey = option.id;
                    optionText = option[idKey] || '';
                  }
                  
                  // 如果仍然为空，使用默认值
                  if (!optionText) {
                    optionText = `选项 ${option.optionIndex || option.id || ''}`;
                  }
                  
                  // 使用单独创建而不是批量创建，以避免批量操作的潜在问题
                  await Option.create({
                    questionId: q.id!,  // 使用非空断言，因为在这个上下文中我们已经确认q.id存在
                    text: String(optionText).trim() || '默认选项文本',
                    isCorrect: !!option.isCorrect,
                    optionIndex: option.optionIndex || option.id || ''
                  }, { transaction: t });
                }
              } catch (optionError) {
                console.error(`Error creating options for question ${i+1}:`, optionError);
                throw optionError;
              }
            } else {
              console.warn(`Question ${i+1} has no options`);
            }
          }
        } catch (questionError) {
          console.error('Error updating questions:', questionError);
          throw questionError;
        }
      }
      
      // 获取更新后的题库ID - 不返回完整对象避免循环引用
      return questionSet.id;
    });
    
    console.log(`Transaction completed successfully, fetching updated data for ${result}`);
    
    // 事务完成后，单独查询题库，避免循环引用
    const updatedQuestionSet = await QuestionSet.findByPk(result, {
      include: [
        {
          model: Question,
          as: 'questions',
          include: [{ model: Option, as: 'options' }]
        }
      ]
    }) as unknown as QuestionSetWithQuestions;
    
    if (!updatedQuestionSet) {
      return res.status(404).json({
        success: false,
        message: '题库不存在'
      });
    }

    console.log(`Building safe response for question set ${result} with ${updatedQuestionSet.questions?.length || 0} questions`);

    // 手动构建安全的响应对象，避免可能的循环引用
    const safeResponse = {
      id: updatedQuestionSet.id,
      title: updatedQuestionSet.title,
      description: updatedQuestionSet.description,
      category: updatedQuestionSet.category,
      icon: updatedQuestionSet.icon,
      isPaid: updatedQuestionSet.isPaid,
      price: updatedQuestionSet.price,
      trialQuestions: updatedQuestionSet.trialQuestions,
      isFeatured: updatedQuestionSet.isFeatured,
      featuredCategory: updatedQuestionSet.featuredCategory,
      questions: updatedQuestionSet.questions?.map((q: any) => ({
        id: q.id,
        text: q.text,
        explanation: q.explanation,
        questionType: q.questionType,
        orderIndex: q.orderIndex,
        options: q.options?.map((o: any) => ({
          id: o.id,
          text: o.text,
          isCorrect: o.isCorrect,
          optionIndex: o.optionIndex
        }))
      }))
    };

    console.log(`Successfully updated question set ${result}`);
    return res.status(200).json({
      success: true,
      message: '题库更新成功',
      data: safeResponse
    });
  } catch (error: any) {
    // 如果是在事务中抛出的'题库不存在'错误，返回404
    if (error.message === '题库不存在') {
      return res.status(404).json({
        success: false,
        message: '题库不存在'
      });
    }
    
    console.error('更新题库失败:', error);
    console.error('Error stack:', error.stack);
    
    // 提供更具体的错误信息
    let errorMessage = '更新题库失败';
    if (error.name === 'SequelizeValidationError') {
      errorMessage = '数据验证失败: ' + error.message;
    } else if (error.name === 'SequelizeDatabaseError') {
      errorMessage = '数据库错误: ' + error.message;
    }
    
    return res.status(500).json({
      success: false,
      message: errorMessage,
      error: error.message
    });
  }
};

// @desc    Delete a question set
// @route   DELETE /api/question-sets/:id
// @access  Private/Admin
export const deleteQuestionSet = async (req: Request, res: Response) => {
  try {
    const questionSet = await QuestionSet.findByPk(req.params.id);

    if (questionSet) {
      await questionSet.destroy();
      
      // TODO: Also clean up any redeem codes or purchases referencing this question set

      res.json({
        success: true,
        message: 'Question set removed'
      });
    } else {
      res.status(404).json({
        success: false,
        message: 'Question set not found'
      });
    }
  } catch (error: any) {
    console.error('Delete question set error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Server error'
    });
  }
};

// @desc    Save user progress on a question set
// @route   POST /api/question-sets/:id/progress
// @access  Private
export const saveProgress = async (req: Request, res: Response) => {
  try {
    const { completedQuestions, totalQuestions, correctAnswers } = req.body;
    const user = await User.findByPk(req.user.id);
    const questionSetId = req.params.id;

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Update or create progress record
    if (!user.progress) {
      user.progress = {};
    }

    user.progress[questionSetId] = {
      completedQuestions,
      totalQuestions,
      correctAnswers,
      lastAccessed: new Date()
    };

    await user.save();

    res.json({
      success: true,
      message: 'Progress saved',
      data: user.progress[questionSetId]
    });
  } catch (error: any) {
    console.error('Save progress error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Server error'
    });
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
            const question = await Question.create({
              id: q.id || undefined, // 如果未提供ID，让Sequelize生成
              text: q.text,
              explanation: q.explanation,
              questionSetId: setData.id,
              questionType: q.questionType || 'single',
              orderIndex: q.orderIndex !== undefined ? q.orderIndex : i
            });
            
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
    
    res.status(201).json({
      success: true,
      data: results,
      message: '题库上传成功'
    });
  } catch (error: any) {
    console.error('批量上传题库错误:', error);
    res.status(500).json({
      success: false,
      message: error.message || '服务器错误'
    });
  }
}; 