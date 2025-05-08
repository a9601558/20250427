import { Request, Response } from 'express';
import { sequelize, RedeemCode, QuestionSet, User, Purchase } from '../models';
import { Transaction, Op, QueryTypes } from 'sequelize';
import { v4 as uuidv4 } from 'uuid';
import { IPurchase } from '../types';
import { getSocketIO } from '../socket'; // Import the getSocketIO function

// @desc    Generate redeem codes
// @route   POST /api/redeem-codes/generate
// @access  Private/Admin
export const generateRedeemCodes = async (req: Request, res: Response) => {
  try {
    const { questionSetId, validityDays, quantity = 1 } = req.body;

    if (!questionSetId || !validityDays || validityDays < 1) {
      return res.status(400).json({
        success: false,
        message: 'Please provide valid questionSetId and validityDays'
      });
    }

    // Verify question set exists
    const questionSet = await QuestionSet.findByPk(questionSetId);
    if (!questionSet) {
      return res.status(404).json({
        success: false,
        message: 'Question set not found'
      });
    }

    const generatedCodes = [];
    
    // Generate codes
    for (let i = 0; i < quantity; i++) {
      // Calculate expiry date (validityDays ahead of creation)
      const expiryDate = new Date();
      expiryDate.setDate(expiryDate.getDate() + validityDays);
      
      // Generate unique code
      const code = await RedeemCode.generateUniqueCode();
      
      const redeemCode = await RedeemCode.create({
        code,
        questionSetId,
        validityDays,
        expiryDate,
        isUsed: false,
        createdBy: req.user.id
      });
      
      generatedCodes.push(redeemCode);
    }

    res.status(201).json({
      success: true,
      message: `${quantity} redeem code(s) generated successfully`,
      data: generatedCodes
    });
  } catch (error: any) {
    console.error('Generate redeem codes error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Server error'
    });
  }
};

// @desc    Get all redeem codes
// @route   GET /api/redeem-codes
// @access  Private/Admin
export const getRedeemCodes = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    // 获取分页参数
    const page = parseInt(req.query.page as string) || 1;
    const pageSize = parseInt(req.query.pageSize as string) || 10;
    const offset = (page - 1) * pageSize;
    const limit = pageSize;
    
    const { isUsed, questionSetId } = req.query;
    
    // 构建查询条件
    const whereClause: any = {};
    if (isUsed !== undefined) {
      whereClause.isUsed = isUsed === 'true';
    }
    if (questionSetId) {
      whereClause.questionSetId = questionSetId;
    }
    
    try {
      // 尝试使用Sequelize关联查询
      console.log('Attempting to fetch redeem codes with associations...');
      const { count, rows } = await RedeemCode.findAndCountAll({
        where: whereClause,
        include: [
          {
            model: QuestionSet,
            as: 'redeemQuestionSet',
            attributes: ['id', 'title', 'description'],
            required: false
          },
          {
            model: User,
            as: 'redeemUser',
            attributes: ['id', 'username', 'email'],
            required: false
          },
          {
            model: User,
            as: 'redeemCreator',
            attributes: ['id', 'username', 'email'],
            required: false
          }
        ],
        offset,
        limit,
        order: [['createdAt', 'DESC']]
      });
      
      return res.json({
        success: true,
        data: {
          total: count,
          page,
          pageSize,
          list: rows
        }
      });
    } catch (associationError) {
      // 如果关联查询失败，尝试直接查询兑换码
      console.error('Association query failed:', associationError);
      console.log('Falling back to direct query without associations...');
      
      // 直接查询兑换码，不使用关联
      const { count, rows } = await RedeemCode.findAndCountAll({
        where: whereClause,
        offset,
        limit,
        order: [['createdAt', 'DESC']]
      });
      
      // 手动查询关联的数据
      const enhancedRows = await Promise.all(rows.map(async (code) => {
        // 使用as any来绕过类型限制，因为我们需要添加关联属性
        const codeData: any = code.toJSON();
        
        try {
          // 查询关联的题库
          if (code.questionSetId) {
            const questionSet = await QuestionSet.findByPk(code.questionSetId, {
              attributes: ['id', 'title', 'description']
            });
            if (questionSet) {
              codeData.redeemQuestionSet = questionSet;
            }
          }
          
          // 查询使用者用户信息
          if (code.usedBy) {
            const user = await User.findByPk(code.usedBy, {
              attributes: ['id', 'username', 'email']
            });
            if (user) {
              codeData.redeemUser = user;
            }
          }
          
          // 查询创建者用户信息
          if (code.createdBy) {
            const creator = await User.findByPk(code.createdBy, {
              attributes: ['id', 'username', 'email']
            });
            if (creator) {
              codeData.redeemCreator = creator;
            }
          }
        } catch (error) {
          console.error('Error fetching related data:', error);
        }
        
        return codeData;
      }));
      
      return res.json({
        success: true,
        data: {
          total: count,
          page,
          pageSize,
          list: enhancedRows
        }
      });
    }
  } catch (error) {
    console.error('获取兑换码列表出错:', error);
    return res.status(500).json({
      success: false,
      message: '服务器错误，获取兑换码列表失败'
    });
  }
};

// @desc    Redeem a code
// @route   POST /api/redeem-codes/redeem
// @access  Private
export const redeemCode = async (req: Request, res: Response) => {
  try {
    const { code } = req.body;
    const userId = req.user.id;

    // 输出调试信息
    console.log(`尝试兑换码: ${code}, 用户ID: ${userId}`);

    // 直接使用原始SQL查询获取兑换码，避免关联加载问题
    const [redeemCodeResults] = await sequelize.query(
      `SELECT * FROM redeem_codes WHERE code = ?`,
      {
        replacements: [code],
        type: QueryTypes.SELECT
      }
    );

    // 检查兑换码是否存在
    if (!redeemCodeResults) {
      console.error(`兑换码不存在: ${code}`);
      return res.status(404).json({
        success: false,
        message: '兑换码不存在'
      });
    }

    // 获取兑换码信息
    const redeemCode = redeemCodeResults as any;
    console.log(`找到兑换码: ID=${redeemCode.id}, 题库ID=${redeemCode.questionSetId}, 代码=${redeemCode.code}`);

    if (redeemCode.isUsed) {
      console.error(`兑换码已使用: ${code}`);
      return res.status(400).json({
        success: false,
        message: '兑换码已被使用'
      });
    }

    if (!redeemCode.questionSetId) {
      console.error(`兑换码缺少题库ID: ${redeemCode.id}, 代码=${code}`);
      return res.status(400).json({
        success: false,
        message: '兑换码配置错误，请联系管理员'
      });
    }

    // 直接查询题库信息
    const [questionSetResults] = await sequelize.query(
      `SELECT * FROM question_sets WHERE id = ?`,
      {
        replacements: [redeemCode.questionSetId],
        type: QueryTypes.SELECT
      }
    );

    if (!questionSetResults) {
      console.error(`题库不存在 - 兑换码ID: ${redeemCode.id}, 题库ID: ${redeemCode.questionSetId}`);
      return res.status(404).json({
        success: false,
        message: '题库不存在'
      });
    }

    const questionSet = questionSetResults as any;
    console.log(`找到题库: ${questionSet.id}, 标题: ${questionSet.title}`);

    // 创建购买记录
    const purchaseId = uuidv4();
    const now = new Date();
    const expiryDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30天有效期

    await sequelize.query(
      `INSERT INTO purchases (id, user_id, question_set_id, purchase_date, status, expiry_date, amount, created_at, updated_at)
       VALUES (?, ?, ?, ?, 'active', ?, 0, ?, ?)`,
      {
        replacements: [purchaseId, userId, questionSet.id, now, expiryDate, now, now],
        type: QueryTypes.INSERT
      }
    );

    console.log(`创建了购买记录: ${purchaseId}`);

    // 更新兑换码状态
    await sequelize.query(
      `UPDATE redeem_codes SET isUsed = 1, usedBy = ?, usedAt = ? WHERE id = ?`,
      {
        replacements: [userId, now, redeemCode.id],
        type: QueryTypes.UPDATE
      }
    );

    console.log(`已更新兑换码状态为已使用`);

    // 查询创建的购买记录
    const [purchase] = await sequelize.query(
      `SELECT * FROM purchases WHERE id = ?`,
      {
        replacements: [purchaseId],
        type: QueryTypes.SELECT
      }
    );

    // 查询用户的socket_id
    const [userSocketResult] = await sequelize.query(
      `SELECT socket_id FROM users WHERE id = ?`,
      {
        replacements: [userId],
        type: QueryTypes.SELECT
      }
    );

    // 如果用户在线，通过Socket.IO发送兑换成功通知
    const userSocket = userSocketResult as any;
    if (userSocket && userSocket.socket_id) {
      try {
        const io = getSocketIO();
        // 发送题库访问权限更新
        io.to(userSocket.socket_id).emit('questionSet:accessUpdate', {
          questionSetId: questionSet.id,
          hasAccess: true
        });

        // 发送兑换成功事件
        io.to(userSocket.socket_id).emit('redeem:success', {
          questionSetId: questionSet.id,
          purchaseId: purchaseId,
          expiryDate: expiryDate
        });
        
        console.log(`已通过Socket发送兑换成功事件到客户端`);
      } catch (error) {
        console.error('发送Socket事件失败:', error);
      }
    }

    res.json({
      success: true,
      message: '兑换成功',
      data: {
        questionSet,
        purchase
      }
    });
  } catch (error) {
    console.error('兑换失败:', error);
    res.status(500).json({
      success: false,
      message: '兑换失败'
    });
  }
};

// @desc    Delete a redeem code
// @route   DELETE /api/redeem-codes/:id
// @access  Private/Admin
export const deleteRedeemCode = async (req: Request, res: Response) => {
  try {
    const redeemCode = await RedeemCode.findByPk(req.params.id);

    if (!redeemCode) {
      return res.status(404).json({
        success: false,
        message: 'Redeem code not found'
      });
    }

    // Don't allow deletion of used codes
    if (redeemCode.isUsed) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete a redeem code that has been used'
      });
    }

    await redeemCode.destroy();

    res.json({
      success: true,
      message: 'Redeem code deleted'
    });
  } catch (error: any) {
    console.error('Delete redeem code error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Server error'
    });
  }
};

// @desc    Get user's redeemed codes
// @route   GET /api/redeem-codes/user
// @access  Private
export const getUserRedeemCodes = async (req: Request, res: Response) => {
  try {
    const userId = req.user.id;
    
    // 查找用户已兑换的所有兑换码
    const redeemCodes = await RedeemCode.findAll({
      where: { 
        usedBy: userId,
        isUsed: true
      },
      include: [
        {
          model: QuestionSet,
          as: 'redeemQuestionSet',
          attributes: ['id', 'title', 'description', 'icon', 'category']
        }
      ],
      order: [['usedAt', 'DESC']]
    });

    // 获取相关的购买记录以检查有效期
    const purchases = await Purchase.findAll({
      where: { 
        userId,
        status: 'active'
      }
    });

    // 为兑换码添加失效日期信息
    const codeWithExpiry = redeemCodes.map(code => {
      const purchase = purchases.find(p => p.questionSetId === code.questionSetId);
      // 确保 usedAt 是字符串类型
      const usedAtString = code.usedAt ? code.usedAt.toString() : new Date().toISOString();
      const usedDate = new Date(usedAtString);
      const defaultExpiryDate = new Date(usedDate.getTime() + 180 * 24 * 60 * 60 * 1000); // 默认6个月有效期
      
      return {
        ...code.toJSON(),
        expiryDate: purchase?.expiryDate ?? defaultExpiryDate
      };
    });

    res.json({
      success: true,
      data: codeWithExpiry
    });
  } catch (error: any) {
    console.error('Get user redeemed codes error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Server error'
    });
  }
};

// @desc    Fix redeem code question set association
// @route   PUT /api/redeem-codes/:id/fix-question-set
// @access  Private/Admin
export const fixRedeemCodeQuestionSet = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { questionSetId } = req.body;

    if (!questionSetId) {
      return res.status(400).json({
        success: false,
        message: '请提供有效的题库ID'
      });
    }

    // 查找兑换码
    const redeemCode = await RedeemCode.findByPk(id);
    if (!redeemCode) {
      return res.status(404).json({
        success: false,
        message: '兑换码不存在'
      });
    }

    // 检查题库是否存在
    const questionSet = await QuestionSet.findByPk(questionSetId);
    if (!questionSet) {
      return res.status(404).json({
        success: false,
        message: '题库不存在'
      });
    }

    // 更新兑换码关联的题库
    await redeemCode.update({ questionSetId: String(questionSetId) });

    res.json({
      success: true,
      message: '兑换码关联已成功修复',
      data: { redeemCode }
    });
  } catch (error: any) {
    console.error('修复兑换码关联失败:', error);
    res.status(500).json({
      success: false,
      message: error.message || '服务器错误'
    });
  }
};

// @desc    Debug redeem codes and question sets
// @route   GET /api/redeem-codes/debug
// @access  Private/Admin
export const debugRedeemCodes = async (req: Request, res: Response) => {
  try {
    // 获取所有兑换码
    const redeemCodes = await RedeemCode.findAll({
      attributes: ['id', 'code', 'questionSetId', 'isUsed', 'createdAt']
    });
    
    // 获取所有题库
    const questionSets = await QuestionSet.findAll({
      attributes: ['id', 'title']
    });
    
    // 创建题库ID映射
    const questionSetMap = new Map();
    questionSets.forEach(qs => {
      questionSetMap.set(qs.id, qs.title);
    });
    
    // 检查每个兑换码是否有对应的题库
    const issues = [];
    const validCodes = [];
    
    for (const code of redeemCodes) {
      if (!questionSetMap.has(code.questionSetId)) {
        issues.push({
          codeId: code.id,
          code: code.code,
          questionSetId: code.questionSetId,
          issue: '题库不存在'
        });
      } else {
        validCodes.push({
          codeId: code.id,
          code: code.code,
          questionSetId: code.questionSetId,
          questionSetTitle: questionSetMap.get(code.questionSetId),
          isUsed: code.isUsed,
          createdAt: code.createdAt
        });
      }
    }
    
    res.json({
      success: true,
      data: {
        totalRedeemCodes: redeemCodes.length,
        totalQuestionSets: questionSets.length,
        issues,
        validCodes
      }
    });
  } catch (error: any) {
    console.error('Debug redeem codes error:', error);
    res.status(500).json({
      success: false,
      message: error.message || '服务器错误'
    });
  }
};

// @desc    Batch fix redeem code question set associations
// @route   POST /api/redeem-codes/batch-fix
// @access  Private/Admin
export const batchFixRedeemCodes = async (req: Request, res: Response) => {
  try {
    const { codeToQuestionSetMap } = req.body;
    
    if (!codeToQuestionSetMap || typeof codeToQuestionSetMap !== 'object') {
      return res.status(400).json({
        success: false,
        message: '请提供有效的兑换码和题库ID映射'
      });
    }
    
    const results = {
      total: Object.keys(codeToQuestionSetMap).length,
      successful: 0,
      failed: 0,
      details: [] as any[]
    };
    
    // 逐个处理每个兑换码
    for (const [codeId, questionSetId] of Object.entries(codeToQuestionSetMap)) {
      try {
        // 检查题库是否存在
        const questionSet = await QuestionSet.findByPk(String(questionSetId));
        if (!questionSet) {
          results.failed++;
          results.details.push({
            codeId,
            success: false,
            message: '题库不存在'
          });
          continue;
        }
        
        // 查找兑换码
        const redeemCode = await RedeemCode.findByPk(codeId);
        if (!redeemCode) {
          results.failed++;
          results.details.push({
            codeId,
            success: false,
            message: '兑换码不存在'
          });
          continue;
        }
        
        // 更新兑换码关联的题库
        await redeemCode.update({ questionSetId: String(questionSetId) });
        
        results.successful++;
        results.details.push({
          codeId,
          success: true,
          message: '更新成功',
          oldQuestionSetId: redeemCode.questionSetId,
          newQuestionSetId: questionSetId
        });
      } catch (error: any) {
        console.error(`处理兑换码 ${codeId} 时出错:`, error);
        results.failed++;
        results.details.push({
          codeId,
          success: false,
          message: error.message || '处理出错'
        });
      }
    }
    
    res.json({
      success: true,
      message: `已处理 ${results.total} 个兑换码，成功 ${results.successful} 个，失败 ${results.failed} 个`,
      data: results
    });
  } catch (error: any) {
    console.error('批量修复兑换码关联失败:', error);
    res.status(500).json({
      success: false,
      message: error.message || '服务器错误'
    });
  }
};

// 创建兑换码
export const createRedeemCode = async (req: Request, res: Response) => {
  const { questionSetId, validityDays = 30, quantity = 1 } = req.body;
  const userId = req.user?.id;
  
  try {
    // 验证题库ID是否存在
    const questionSet = await QuestionSet.findByPk(questionSetId);
    if (!questionSet) {
      return res.status(404).json({ 
        success: false, 
        message: '题库不存在' 
      });
    }
    
    // 创建兑换码记录
    const createdCodes = [];
    for (let i = 0; i < quantity; i++) {
      const code = await RedeemCode.create({
        questionSetId,
        validityDays,
        createdBy: userId,
      });
      createdCodes.push(code);
    }
    
    return res.status(201).json({
      success: true,
      message: `成功创建${quantity}个兑换码`,
      data: createdCodes
    });
  } catch (error) {
    console.error('创建兑换码出错:', error);
    return res.status(500).json({
      success: false, 
      message: '服务器错误，创建兑换码失败'
    });
  }
};

// 使用兑换码
export const useRedeemCode = async (req: Request, res: Response) => {
  const { code } = req.body;
  const userId = req.user?.id;
  
  try {
    // 开启事务
    const result = await sequelize.transaction(async (t) => {
      // 查找兑换码
      const redeemCode = await RedeemCode.findOne({
        where: { code },
        include: [{
          model: QuestionSet,
          as: 'redeemQuestionSet'
        }],
        transaction: t
      });
      
      // 验证兑换码是否存在
      if (!redeemCode) {
        return { success: false, message: '兑换码不存在' };
      }
      
      // 验证兑换码是否已使用
      if (redeemCode.isUsed) {
        return { success: false, message: '兑换码已被使用' };
      }
      
      // 验证兑换码是否过期
      if (new Date() > redeemCode.expiryDate) {
        return { success: false, message: '兑换码已过期' };
      }
      
      // 获取题库信息
      const questionSet = redeemCode.redeemQuestionSet;
      if (!questionSet) {
        return { success: false, message: '题库不存在或已被删除' };
      }
      
      // 标记兑换码为已使用
      await redeemCode.update({
        isUsed: true,
        usedBy: userId,
        usedAt: new Date()
      }, { transaction: t });
      
      return {
        success: true,
        message: '兑换成功',
        data: {
          questionSet,
          validityDays: redeemCode.validityDays
        }
      };
    });
    
    return res.status(result.success ? 200 : 400).json(result);
  } catch (error) {
    console.error('使用兑换码出错:', error);
    return res.status(500).json({
      success: false,
      message: '服务器错误，兑换失败'
    });
  }
};

// 获取单个兑换码
export const getRedeemCode = async (req: Request, res: Response) => {
  const { id } = req.params;
  
  try {
    const redeemCode = await RedeemCode.findByPk(id, {
      include: [
        {
          model: QuestionSet,
          as: 'redeemQuestionSet',
          attributes: ['id', 'title', 'description']
        },
        {
          model: User,
          as: 'redeemUser',
          attributes: ['id', 'username', 'email']
        },
        {
          model: User,
          as: 'redeemCreator',
          attributes: ['id', 'username', 'email']
        }
      ]
    });
    
    if (!redeemCode) {
      return res.status(404).json({
        success: false,
        message: '兑换码不存在'
      });
    }
    
    return res.json({
      success: true,
      data: redeemCode
    });
  } catch (error) {
    console.error('获取兑换码详情出错:', error);
    return res.status(500).json({
      success: false,
      message: '服务器错误，获取兑换码详情失败'
    });
  }
}; 