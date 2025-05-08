import { Request, Response } from 'express';
import { Op, QueryTypes } from 'sequelize';
import { Purchase, User, QuestionSet, sequelize } from '../models';
import { stripePaymentIntent } from '../services/stripe';
import { v4 as uuidv4 } from 'uuid';
import { purchaseAttributes, purchaseQuestionSetAttributes } from '../utils/sequelizeHelpers';
import { withPurchaseAttributes } from '../utils/applyFieldMappings';

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

// @desc    Create purchase
// @route   POST /api/v1/purchases
// @access  Private
export const createPurchase = async (req: Request, res: Response) => {
  try {
    const { questionSetId, paymentMethod, amount } = req.body;

    // 验证必填字段
    if (!questionSetId || !paymentMethod || !amount) {
      return sendError(res, 400, '缺少必要参数');
    }

    // 检查题库是否存在
    const questionSet = await QuestionSet.findByPk(questionSetId);
    if (!questionSet) {
      return sendError(res, 404, '题库不存在');
    }

    // 检查题库是否需要付费
    if (!questionSet.isPaid) {
      return sendError(res, 400, '该题库为免费题库');
    }

    // 检查金额是否正确
    if (amount !== questionSet.price) {
      return sendError(res, 400, '支付金额不正确');
    }

    // 检查用户是否已经购买过该题库
    const existingPurchase = await Purchase.findOne({
      where: {
        userId: req.user.id,
        questionSetId: questionSetId,
        status: 'completed',
        expiryDate: {
          [Op.gt]: new Date()
        }
      }
    });

    if (existingPurchase) {
      return sendError(res, 400, '您已经购买过该题库且仍在有效期内');
    }

    // 使用Stripe创建支付意向
    const paymentIntent = await stripePaymentIntent({
      amount: Math.round(parseFloat(amount) * 100), // 转换为分
      currency: 'cny',
      metadata: {
        userId: req.user.id,
        questionSetId: questionSetId,
        questionSetTitle: questionSet.title
      }
    });

    // 创建购买记录但设置为pending状态
    const purchase = await Purchase.create({
      id: uuidv4(),
      userId: req.user.id,
      questionSetId,
      amount,
      status: 'pending',
      paymentMethod,
      purchaseDate: new Date(),
      expiryDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30天有效期
      transactionId: paymentIntent.id, // 使用Stripe的paymentIntent ID作为交易ID
      createdAt: new Date(),
      updatedAt: new Date()
    });

    // 返回支付意向信息，前端将使用它完成支付流程
    sendResponse(res, 201, {
      purchase: purchase,
      paymentIntent: {
        id: paymentIntent.id,
        clientSecret: paymentIntent.client_secret
      }
    });
  } catch (error) {
    console.error('Create purchase error:', error);
    sendError(res, 500, '创建购买记录失败');
  }
};

// @desc    Get user's purchases
// @route   GET /api/v1/purchases
// @access  Private
export const getUserPurchases = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: '未授权',
      });
    }

    console.log(`[getUserPurchases] 查询用户 ${userId} 的所有购买记录`);

    // 使用更直接的方式查询，确保包含题库信息
    const purchases = await Purchase.findAll({
      where: {
        userId: userId,
        // 查询所有状态的购买记录，包括 pending、active 和 completed
        status: {
          [Op.in]: ['pending', 'active', 'completed']
        }
      },
      order: [['purchaseDate', 'DESC']],
      include: [
        {
        model: QuestionSet,
          as: 'purchaseQuestionSet',
          attributes: ['id', 'title', 'description', 'category', 'icon'],
          required: false
        },
      ],
    });
    
    console.log(`[getUserPurchases] 查询到 ${purchases.length} 条购买记录`);
    
    // 格式化数据，确保字段一致性
    const formattedPurchases = purchases.map(purchase => {
      try {
        // 获取原始数据
        const rawPurchase = purchase.get({ plain: true });
        
        // 确保日期字段是有效的
        const now = new Date();
        const purchaseDate = rawPurchase.purchaseDate ? new Date(rawPurchase.purchaseDate) : now;
        const expiryDate = rawPurchase.expiryDate ? new Date(rawPurchase.expiryDate) : new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
        
        // 计算剩余天数
        const remainingDays = Math.max(0, Math.ceil((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
        
        // 标准化问题集信息
        const purchaseData = rawPurchase as any; // Use type assertion to fix TypeScript errors
        const questionSetInfo = purchaseData.purchaseQuestionSet ? {
          id: purchaseData.purchaseQuestionSet.id,
          title: purchaseData.purchaseQuestionSet.title,
          description: purchaseData.purchaseQuestionSet.description,
          category: purchaseData.purchaseQuestionSet.category,
          icon: purchaseData.purchaseQuestionSet.icon
        } : null;
        
        // 创建一个标准格式的响应对象
        return {
          id: rawPurchase.id,
          userId: rawPurchase.userId,
          questionSetId: rawPurchase.questionSetId,
          purchaseDate: purchaseDate.toISOString(),
          expiryDate: expiryDate.toISOString(),
          amount: rawPurchase.amount,
          status: rawPurchase.status,
          paymentMethod: rawPurchase.paymentMethod,
          transactionId: rawPurchase.transactionId,
          createdAt: rawPurchase.createdAt,
          updatedAt: rawPurchase.updatedAt,
          remainingDays: remainingDays,
          hasAccess: rawPurchase.status === 'active' && remainingDays > 0,
          // 使用标准化的字段名称
          purchaseQuestionSet: questionSetInfo,
          // 保留原始字段以保持兼容性
          questionSet: questionSetInfo
        };
      } catch (error) {
        console.error('[getUserPurchases] 格式化购买记录失败:', error);
        // 返回基本信息以防止整个请求失败
        return {
          id: purchase.id,
          questionSetId: purchase.questionSetId,
          status: purchase.status
        };
      }
    });
    
    console.log(`[getUserPurchases] 返回 ${formattedPurchases.length} 条格式化的购买记录`);

    return res.status(200).json({
      success: true,
      data: formattedPurchases,
    });
  } catch (error: any) {
    console.error('[getUserPurchases] 获取购买记录失败:', error);
    return res.status(500).json({
      success: false,
      message: '获取购买记录失败',
      error: error.message,
    });
  }
};

// @desc    Check access to question set
// @route   GET /api/purchases/check/:questionSetId
// @access  Private
export const checkAccess = async (req: Request, res: Response) => {
  try {
    const questionSetId = req.params.questionSetId;
    // 检查题库是否存在
    const questionSet = await QuestionSet.findByPk(questionSetId);
    if (!questionSet) {
      return sendError(res, 404, '题库不存在');
    }
    
    // 如果题库是免费的，直接返回有访问权限
    if (!questionSet.isPaid) {
      return sendResponse(res, 200, {
        hasAccess: true,
        isPaid: false
      });
    }
    
    // 查找有效的购买记录
    const purchase = await Purchase.findOne({
      where: {
        userId: req.user.id,
        questionSetId,
        status: 'active',
        expiryDate: {
          [Op.gt]: new Date()
        }
      }
    });
    
    if (purchase) {
      // 计算剩余天数
      const remainingDays = Math.ceil((new Date(purchase.expiryDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
      sendResponse(res, 200, {
        hasAccess: true,
        isPaid: true,
        expiryDate: purchase.expiryDate,
        remainingDays
      });
    } else {
      sendResponse(res, 200, {
        hasAccess: false,
        isPaid: true,
        price: questionSet.price
      });
    }
  } catch (error) {
    console.error('Check access error:', error);
    sendError(res, 500, '检查访问权限失败', error);
  }
};

// @desc    Get user's active purchase records for all question sets
// @route   GET /api/purchases/active
// @access  Private
export const getActivePurchases = async (req: Request, res: Response) => {
  try {
    if (!req.user || !req.user.id) {
      return sendError(res, 401, '用户未登录');
    }
    
    console.log(`[getActivePurchases] 查询用户 ${req.user.id} 的购买记录`);
    
    // 首先直接从数据库查询，确保有数据
    const rawResults = await sequelize.query(
      `SELECT p.*, qs.id as question_set_id, qs.title, qs.description, qs.category 
       FROM purchases p 
       JOIN question_sets qs ON p.question_set_id = qs.id 
       WHERE p.user_id = :userId`,
      {
        replacements: { userId: req.user.id },
        logging: console.log,
        type: QueryTypes.SELECT
      }
    ) as any[];
    
    console.log(`[getActivePurchases] 原始SQL查询返回 ${rawResults.length} 条结果`);
    
    if (rawResults && rawResults.length > 0) {
      console.log(`[getActivePurchases] 找到购买记录，第一条:`, rawResults[0]);
      
      const formattedResults = rawResults.map((record: any) => {
        // 确保日期是有效的
        const now = new Date();
        let purchaseDate, expiryDate, remainingDays;
        
        try {
          purchaseDate = record.purchase_date ? new Date(record.purchase_date) : now;
          expiryDate = record.expiry_date ? new Date(record.expiry_date) : new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
          
          // 验证日期
          if (isNaN(purchaseDate.getTime()) || isNaN(expiryDate.getTime())) {
            console.warn(`[getActivePurchases] 无效日期:`, { purchaseDate, expiryDate });
            // 使用默认值
            purchaseDate = now;
            expiryDate = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
          }
          
          // 计算剩余天数
          remainingDays = Math.max(1, Math.ceil((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
        } catch (error) {
          console.error(`[getActivePurchases] 日期处理错误:`, error);
          purchaseDate = now;
          expiryDate = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
          remainingDays = 30;
        }
        
        return {
          id: record.id,
          questionSetId: record.question_set_id,
          purchaseDate: purchaseDate.toISOString(),
          expiryDate: expiryDate.toISOString(),
          remainingDays,
          status: record.status || 'active',
          hasAccess: true,
          questionSet: {
            id: record.question_set_id,
            title: record.title,
            description: record.description,
            category: record.category
          }
        };
      });
      
      console.log(`[getActivePurchases] 返回 ${formattedResults.length} 条格式化的购买记录`);
      return sendResponse(res, 200, formattedResults);
    }
    
    // 如果原始 SQL 查询没有结果，再尝试 Sequelize
    const purchases = await Purchase.findAll({
      where: {
        userId: req.user.id
      },
      include: [
        {
          model: QuestionSet,
          as: 'purchaseQuestionSet',
          required: true
        }
      ]
    });
    
    console.log(`[getActivePurchases] Sequelize查询返回 ${purchases.length} 条结果`);
    
    // 格式化返回数据
    const formattedPurchases = purchases.map(purchase => {
      try {
        const now = new Date();
        // 确保日期字段是有效的
        const purchaseDate = purchase.purchaseDate ? new Date(purchase.purchaseDate) : now;
        const expiryDate = purchase.expiryDate ? new Date(purchase.expiryDate) : new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
        
        // 验证日期是否有效
        if (isNaN(purchaseDate.getTime()) || isNaN(expiryDate.getTime())) {
          console.error('[getActivePurchases] Invalid date found:', { 
            purchaseId: purchase.id, 
            purchaseDate, 
            expiryDate 
          });
          throw new Error('Invalid date values');
        }
        
        // 计算剩余天数，确保至少为1天
        const remainingDays = Math.max(1, Math.ceil((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
        
        // Get the question set from the association
        const questionSetData = purchase.get('purchaseQuestionSet');
        if (!questionSetData) {
          console.error('[getActivePurchases] Question set data not found for purchase:', purchase.id);
          throw new Error('Question set data not found');
        }
        
        return {
          id: purchase.id,
          questionSetId: purchase.questionSetId,
          purchaseDate: purchaseDate.toISOString(),
          expiryDate: expiryDate.toISOString(),
          remainingDays,
          status: purchase.status,
          questionSet: questionSetData,
          hasAccess: true
        };
      } catch (error) {
        console.error('[getActivePurchases] Error formatting purchase:', purchase.id, error);
        // 返回一个带有默认值的对象，而不是抛出错误
        const now = new Date();
        return {
          id: purchase.id,
          questionSetId: purchase.questionSetId,
          purchaseDate: now.toISOString(),
          expiryDate: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          remainingDays: 30,
          status: purchase.status || 'active',
          questionSet: purchase.get('purchaseQuestionSet'),
          hasAccess: true
        };
      }
    });
    
    // 过滤掉任何无效的记录
    const validPurchases = formattedPurchases.filter(purchase => purchase && purchase.questionSetId);
    
    console.log(`[getActivePurchases] Sequelize方式返回 ${validPurchases.length} 条有效的购买记录`);
    return sendResponse(res, 200, validPurchases.length > 0 ? validPurchases : []);
  } catch (error) {
    console.error('[getActivePurchases] Error:', error);
    sendError(res, 500, '获取有效购买记录失败', error);
  }
};

// @desc    Get purchase details
// @route   GET /api/v1/purchases/:id
// @access  Private
export const getPurchaseById = async (req: Request, res: Response) => {
  try {
    const purchase = await Purchase.findOne({
      where: {
        id: req.params.id,
        userId: req.user.id
      },
      include: [
        {
          model: QuestionSet,
          as: 'questionSet'
        }
      ]
    });

    if (!purchase) {
      return sendError(res, 404, '购买记录不存在');
    }

    sendResponse(res, 200, purchase);
  } catch (error) {
    console.error('Get purchase error:', error);
    sendError(res, 500, '获取购买记录失败', error);
  }
};

// @desc    Cancel purchase
// @route   POST /api/v1/purchases/:id/cancel
// @access  Private
export const cancelPurchase = async (req: Request, res: Response) => {
  try {
    const purchase = await Purchase.findOne({
      where: {
        id: req.params.id,
        userId: req.user.id,
        status: 'pending'
      }
    });

    if (!purchase) {
      return sendError(res, 404, '购买记录不存在或无法取消');
    }

    await purchase.update({ status: 'failed' });

    // TODO: 处理退款逻辑（如果需要）

    sendResponse(res, 200, purchase, '购买已取消');
  } catch (error) {
    console.error('Cancel purchase error:', error);
    sendError(res, 500, '取消购买失败', error);
  }
};

// @desc    Extend purchase validity
// @route   POST /api/v1/purchases/:id/extend
// @access  Private
export const extendPurchase = async (req: Request, res: Response) => {
  try {
    const { months } = req.body;

    if (!months || months <= 0) {
      return sendError(res, 400, '请提供有效的延长月数');
    }

    const purchase = await Purchase.findOne({
      where: {
        id: req.params.id,
        userId: req.user.id,
        status: 'completed'
      }
    });

    if (!purchase) {
      return sendError(res, 404, '购买记录不存在');
    }

    // 计算新的有效期
    const newExpiryDate = new Date(purchase.expiryDate.getTime() + months * 30 * 24 * 60 * 60 * 1000);
    await purchase.update({ expiryDate: newExpiryDate });

    sendResponse(res, 200, purchase, '有效期延长成功');
  } catch (error) {
    console.error('Extend purchase error:', error);
    sendError(res, 500, '延长有效期失败', error);
  }
};

// @desc    Force create purchase (for debugging and bypass validation)
// @route   POST /api/v1/purchases/force-create
// @access  Private
export const forceCreatePurchase = async (req: Request, res: Response) => {
  try {
    console.log(`[forceCreatePurchase] 开始处理请求，请求体:`, JSON.stringify(req.body));
    const { questionSetId, paymentMethod, price, forceBuy } = req.body;

    // 验证必填字段
    if (!questionSetId) {
      console.log('[forceCreatePurchase] 缺少必要参数: questionSetId');
      return sendError(res, 400, '缺少必要参数: questionSetId');
    }

    console.log(`[forceCreatePurchase] 尝试强制创建购买记录: ${questionSetId}, 用户: ${req.user.id}`);

    try {
    // 检查题库是否存在
    const questionSet = await QuestionSet.findByPk(questionSetId);
    if (!questionSet) {
        console.log(`[forceCreatePurchase] 题库不存在: ${questionSetId}`);
      return sendError(res, 404, '题库不存在');
    }

    // 检查用户是否已经购买过该题库
      try {
    const existingPurchase = await Purchase.findOne({
      where: {
        userId: req.user.id,
        questionSetId: questionSetId,
        status: 'active',
        expiryDate: {
          [Op.gt]: new Date()
        }
      }
    });

    if (existingPurchase) {
      console.log(`[forceCreatePurchase] 用户已购买题库: ${req.user.id}, ${questionSetId}`);
      
      // 直接返回已有的购买记录，不创建新记录
          try {
            return sendResponse(res, 200, {
              ...existingPurchase.toJSON(),
              hasAccess: true,
              message: '用户已经购买过该题库且仍在有效期内'
            });
          } catch (jsonError) {
            console.error('[forceCreatePurchase] 转换现有购买记录为JSON时出错:', jsonError);
            return sendResponse(res, 200, {
              id: existingPurchase.id,
              questionSetId: existingPurchase.questionSetId,
              status: existingPurchase.status,
              expiryDate: existingPurchase.expiryDate,
              hasAccess: true
            }, '用户已经购买过该题库且仍在有效期内');
          }
        }
      } catch (findError) {
        console.error('[forceCreatePurchase] 查询现有购买记录失败:', findError);
        // 继续执行，尝试创建新记录
    }

    // 计算过期时间（6个月后）
    const now = new Date();
    const expiryDate = new Date(now);
    expiryDate.setMonth(expiryDate.getMonth() + 6);

    // 创建购买记录 - 强制模式下，忽略isPaid检查
      try {
        const purchaseId = uuidv4();
    const purchase = await Purchase.create({
          id: purchaseId,
      userId: req.user.id,
      questionSetId,
      amount: price || questionSet.price || 0,
      status: 'active', // 直接标记为激活状态
      paymentMethod: paymentMethod || 'direct',
      purchaseDate: now,
      expiryDate: expiryDate,
      createdAt: now,
      updatedAt: now,
      transactionId: `force_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`,
    });

    console.log(`[forceCreatePurchase] 成功创建强制购买记录: ${purchase.id}`);

        // 简化响应，避免使用复杂的关联查询
        return sendResponse(res, 201, {
          id: purchase.id,
          userId: req.user.id,
          questionSetId,
          status: 'active',
          expiryDate: expiryDate.toISOString(),
      remainingDays: 180, // 6个月
      hasAccess: true
        }, '强制购买记录创建成功');
      } catch (createError) {
        console.error('[forceCreatePurchase] 创建购买记录失败:', createError);
        return sendError(res, 500, '创建购买记录失败', createError);
      }
    } catch (dbError) {
      console.error('[forceCreatePurchase] 数据库操作失败:', dbError);
      return sendError(res, 500, '数据库操作失败', dbError);
    }
  } catch (error) {
    console.error('[forceCreatePurchase] 处理请求时出现未捕获异常:', error);
    return sendError(res, 500, '创建强制购买记录失败', error);
  }
};

// @desc    Update user access to question set
// @route   POST /api/v1/purchases/update-access
// @access  Private
export const updateAccess = async (req: Request, res: Response) => {
  try {
    const { questionSetId, purchaseId } = req.body;

    // 验证必填字段
    if (!questionSetId) {
      return sendError(res, 400, '缺少必要参数: questionSetId');
    }

    console.log(`[updateAccess] 尝试更新访问权限: ${questionSetId}, 用户: ${req.user.id}, 购买ID: ${purchaseId || 'N/A'}`);

    // 查找用户的购买记录
    let purchase;
    
    if (purchaseId) {
      // 如果提供了purchaseId，直接查找该购买记录
      purchase = await Purchase.findOne({
        where: {
          id: purchaseId,
          userId: req.user.id
        }
      });
    } else {
      // 否则查找该用户对该题库的任何有效购买记录
      purchase = await Purchase.findOne({
        where: {
          userId: req.user.id,
          questionSetId,
          status: 'active',
          expiryDate: {
            [Op.gt]: new Date()
          }
        }
      });
    }

    if (!purchase) {
      console.log(`[updateAccess] 未找到有效购买记录: ${questionSetId}, 用户: ${req.user.id}`);
      
      // 尝试创建一个新的临时访问记录
      try {
        // 检查题库是否存在
        const questionSet = await QuestionSet.findByPk(questionSetId);
        if (!questionSet) {
          return sendError(res, 404, '题库不存在');
        }
        
        // 计算过期时间（1个月后）
        const now = new Date();
        const expiryDate = new Date(now);
        expiryDate.setMonth(expiryDate.getMonth() + 1);
        
        // 创建临时访问记录
        const tempPurchase = await Purchase.create({
          id: uuidv4(),
          userId: req.user.id,
          questionSetId,
          amount: 0,
          status: 'active',
          paymentMethod: 'system',
          purchaseDate: now,
          expiryDate: expiryDate,
          createdAt: now,
          updatedAt: now,
          transactionId: `temp_${Date.now()}`
        });
        
        console.log(`[updateAccess] 创建临时访问记录成功: ${tempPurchase.id}`);
        
        return sendResponse(res, 201, {
          id: tempPurchase.id,
          questionSetId,
          hasAccess: true,
          expiryDate: expiryDate,
          remainingDays: 30
        }, '临时访问记录创建成功');
      } catch (createError) {
        console.error('[updateAccess] 创建临时访问记录失败:', createError);
        return sendError(res, 500, '创建临时访问记录失败', createError);
      }
    }
    
    // 确保购买记录处于活跃状态
    if (purchase.status !== 'active') {
      await purchase.update({ status: 'active' });
      console.log(`[updateAccess] 更新购买记录状态为active: ${purchase.id}`);
    }
    
    // 计算剩余天数
    const now = new Date();
    const expiryDate = new Date(purchase.expiryDate);
    const remainingDays = Math.max(0, Math.ceil((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
    
    sendResponse(res, 200, {
      id: purchase.id,
      questionSetId,
      hasAccess: true,
      expiryDate: purchase.expiryDate,
      remainingDays
    }, '访问权限更新成功');
  } catch (error) {
    console.error('[updateAccess] 更新访问权限失败:', error);
    sendError(res, 500, '更新访问权限失败', error);
  }
};