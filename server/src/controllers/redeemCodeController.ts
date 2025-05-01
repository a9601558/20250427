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
    const redeemCodes = await RedeemCode.findAll({
      include: [
        {
          model: QuestionSet,
          as: 'questionSet',
          attributes: ['title', 'category']
        },
        {
          model: User,
          as: 'redeemUser',
          attributes: ['username', 'email']
        },
        {
          model: User,
          as: 'redeemCreator',
          attributes: ['username']
        }
      ],
      order: [['createdAt', 'DESC']]
    });

    res.json({
      success: true,
      data: redeemCodes
    });
  } catch (error: any) {
    console.error('Get redeem codes error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Server error'
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
          as: 'questionSet',
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