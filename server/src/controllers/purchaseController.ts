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
    message,
  });
};

// 统一错误响应
const sendError = (res: Response, status: number, message: string, error?: any) => {
  res.status(status).json({
    success: false,
    message,
    error: process.env.NODE_ENV === 'development' ? error?.message : undefined,
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
          [Op.gt]: new Date(),
        },
      },
    });

    if (existingPurchase) {
      return sendError(res, 400, '您已经购买过该题库且仍在有效期内');
    }

    // 创建购买记录
    const purchase = await Purchase.create({
      id: uuidv4(),
      userId: req.user.id,
      questionSetId,
      amount,
      status: 'pending',
      paymentMethod,
      purchaseDate: new Date(),
      expiryDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30天有效期
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // TODO: 调用支付接口处理支付
    // 这里应该调用实际的支付接口，比如微信支付、支付宝等
    // 支付成功后更新购买状态
    await purchase.update({ status: 'completed' });

    const purchaseWithQuestionSet = await Purchase.findByPk(purchase.id, {
      include: [{
        model: QuestionSet,
        as: 'questionSet',
        attributes: ['id', 'title', 'category', 'icon'],
      }],
    });

    sendResponse(res, 201, purchaseWithQuestionSet);
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

    const purchases = await Purchase.findAll(withPurchaseAttributes({
      where: {
        userId: userId,
      },
      order: [['purchaseDate', 'DESC']],
      include: [
        {
        model: QuestionSet,
          as: 'questionSet',
        },
      ],
    }));

    return res.status(200).json({
      success: true,
      data: purchases,
    });
  } catch (error: any) {
    console.error('获取购买记录失败:', error);
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
        isPaid: false,
      });
    }
    
    // 查找有效的购买记录
    const purchase = await Purchase.findOne({
      where: {
        userId: req.user.id,
        questionSetId,
        status: 'active',
        expiryDate: {
          [Op.gt]: new Date(),
        },
      },
    });
    
    if (purchase) {
      // 计算剩余天数
      const remainingDays = Math.ceil((new Date(purchase.expiryDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
      sendResponse(res, 200, {
        hasAccess: true,
        isPaid: true,
        expiryDate: purchase.expiryDate,
        remainingDays,
      });
    } else {
      sendResponse(res, 200, {
        hasAccess: false,
        isPaid: true,
        price: questionSet.price,
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
        type: QueryTypes.SELECT,
      }
    ) as any[];
    
    console.log(`[getActivePurchases] 原始SQL查询返回 ${rawResults.length} 条结果`);
    
    if (rawResults && rawResults.length > 0) {
      console.log('[getActivePurchases] 找到购买记录，第一条:', rawResults[0]);
      
      const formattedResults = rawResults.map((record: any) => {
        // 确保日期是有效的
        const now = new Date();
        let purchaseDate, expiryDate, remainingDays;
        
        try {
          purchaseDate = record.purchase_date ? new Date(record.purchase_date) : now;
          expiryDate = record.expiry_date ? new Date(record.expiry_date) : new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
          
          // 验证日期
          if (isNaN(purchaseDate.getTime()) || isNaN(expiryDate.getTime())) {
            console.warn('[getActivePurchases] 无效日期:', { purchaseDate, expiryDate });
            // 使用默认值
            purchaseDate = now;
            expiryDate = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
          }
          
          // 计算剩余天数
          remainingDays = Math.max(1, Math.ceil((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
        } catch (error) {
          console.error('[getActivePurchases] 日期处理错误:', error);
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
            category: record.category,
          },
        };
      });
      
      console.log(`[getActivePurchases] 返回 ${formattedResults.length} 条格式化的购买记录`);
      return sendResponse(res, 200, formattedResults);
    }
    
    // 如果原始 SQL 查询没有结果，再尝试 Sequelize
    const purchases = await Purchase.findAll({
      where: {
        userId: req.user.id,
      },
      include: [
        {
          model: QuestionSet,
          as: 'questionSet',
          required: true,
        },
      ],
    });
    
    console.log(`[getActivePurchases] Sequelize查询返回 ${purchases.length} 条结果`);
    
    // 格式化返回数据
    const formattedPurchases = purchases.map((purchase) => {
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
            expiryDate, 
          });
          throw new Error('Invalid date values');
        }
        
        // 计算剩余天数，确保至少为1天
        const remainingDays = Math.max(1, Math.ceil((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
        
        // Get the question set from the association
        const questionSetData = purchase.get('questionSet');
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
          hasAccess: true,
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
          questionSet: purchase.get('questionSet'),
          hasAccess: true,
        };
      }
    });
    
    // 过滤掉任何无效的记录
    const validPurchases = formattedPurchases.filter((purchase) => purchase && purchase.questionSetId);
    
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
        userId: req.user.id,
      },
      include: [
        {
          model: QuestionSet,
          as: 'questionSet',
        },
      ],
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
        status: 'pending',
      },
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
        status: 'completed',
      },
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
