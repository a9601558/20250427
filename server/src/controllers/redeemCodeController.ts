import { Request, Response } from 'express';
import { sequelize, RedeemCode, QuestionSet, User, Purchase } from '../models';
import { Transaction, Op } from 'sequelize';
import { v4 as uuidv4 } from 'uuid';

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
  // Start transaction
  const transaction = await sequelize.transaction();

  try {
    const { code } = req.body;
    const userId = req.user.id;

    if (!code) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a redeem code'
      });
    }

    // Find the code
    const redeemCode = await RedeemCode.findOne({ 
      where: { code },
      transaction
    });

    if (!redeemCode) {
      await transaction.rollback();
      return res.status(404).json({
        success: false,
        message: 'Invalid redeem code'
      });
    }

    // Check if already used
    if (redeemCode.isUsed) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: 'This code has already been used'
      });
    }

    // Check if expired
    if (new Date() > redeemCode.expiryDate) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: 'This code has expired'
      });
    }

    // Get question set info
    const questionSet = await QuestionSet.findByPk(redeemCode.questionSetId, { transaction });
    if (!questionSet) {
      await transaction.rollback();
      return res.status(404).json({
        success: false,
        message: 'Question set not found'
      });
    }

    // Calculate expiry date (validityDays ahead of redemption)
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + redeemCode.validityDays);

    // Update redeem code as used
    await redeemCode.update({
      isUsed: true,
      usedBy: userId,
      usedAt: new Date()
    }, { transaction });

    // Check if user exists
    const user = await User.findByPk(userId, { transaction });
    if (!user) {
      await transaction.rollback();
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Check if user already has access to this question set
    const existingPurchase = await Purchase.findOne({
      where: {
        userId,
        quizId: redeemCode.questionSetId,
        expiryDate: {
          [Op.gt]: new Date()
        }
      },
      transaction
    });

    if (existingPurchase) {
      // Extend the existing purchase if new expiry date is later
      if (expiryDate > existingPurchase.expiryDate) {
        await existingPurchase.update({
          expiryDate
        }, { transaction });
      }
    } else {
      // Create new purchase
      await Purchase.create({
        id: uuidv4(),
        userId,
        quizId: redeemCode.questionSetId,
        purchaseDate: new Date(),
        expiryDate,
        transactionId: `redeem_${redeemCode.code}`,
        amount: 0,
        paymentMethod: 'redeem_code',
        status: 'completed'
      }, { transaction });
    }

    // Commit transaction
    await transaction.commit();

    res.json({
      success: true,
      message: 'Code redeemed successfully',
      data: {
        questionSet: {
          id: questionSet.id,
          title: questionSet.title
        },
        expiryDate,
        validityDays: redeemCode.validityDays
      }
    });
  } catch (error: any) {
    // Rollback transaction on error
    await transaction.rollback();
    
    console.error('Redeem code error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Server error'
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