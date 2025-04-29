import { Request, Response } from 'express';
import { sequelize, RedeemCode, QuestionSet, User, Purchase } from '../models';
import { Transaction, Op } from 'sequelize';
import { v4 as uuidv4 } from 'uuid';
import { IPurchase } from '../types';

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
          as: 'user',
          attributes: ['username', 'email']
        },
        {
          model: User,
          as: 'creator',
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

    // 查找兑换码
    const redeemCode = await RedeemCode.findOne({
      where: { code }
    });

    if (!redeemCode) {
      return res.status(404).json({
        success: false,
        message: '兑换码不存在'
      });
    }

    if (redeemCode.isUsed) {
      return res.status(400).json({
        success: false,
        message: '兑换码已被使用'
      });
    }

    // 查找对应的题库
    const questionSet = await QuestionSet.findByPk(redeemCode.questionSetId);
    if (!questionSet) {
      return res.status(404).json({
        success: false,
        message: '题库不存在'
      });
    }

    // 创建购买记录
    const purchase = await Purchase.create({
      id: uuidv4(),
      userId,
      questionSetId: questionSet.id,
      purchaseDate: new Date(),
      status: 'active',
      expiryDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30天有效期
      amount: 0,
      createdAt: new Date(),
      updatedAt: new Date()
    });

    // 更新兑换码状态
    await redeemCode.update({
      isUsed: true,
      usedBy: userId,
      usedAt: new Date()
    });

    // 更新用户的购买记录
    const user = await User.findByPk(userId);
    if (user) {
      const currentPurchases = user.purchases || [];
      await user.update({
        purchases: [...currentPurchases, purchase.toJSON() as IPurchase]
      });
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