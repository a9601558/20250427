import { Request, Response } from 'express';
import { Op } from 'sequelize';
import { Purchase, User, QuestionSet, sequelize } from '../models';
import { stripePaymentIntent } from '../services/stripe';
import { v4 as uuidv4 } from 'uuid';

// @desc    Create a new purchase (payment intent)
// @route   POST /api/purchases
// @access  Private
export const createPurchase = async (req: Request, res: Response) => {
  try {
    const { quizId } = req.body;
    const userId = req.user.id;

    // Validate the quiz ID
    const questionSet = await QuestionSet.findByPk(quizId);
    if (!questionSet) {
      return res.status(404).json({
        success: false,
        message: 'Question set not found'
      });
    }

    // Check if it's a paid question set
    if (!questionSet.isPaid) {
      return res.status(400).json({
        success: false,
        message: 'This question set is free and does not require purchase'
      });
    }

    // Check if user already has an active purchase for this question set
    const user = await User.findByPk(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // 查找现有购买记录
    const existingPurchase = await Purchase.findOne({
      where: {
        userId,
        quizId,
        expiryDate: {
          [Op.gt]: new Date()
        }
      }
    });

    if (existingPurchase) {
      return res.status(400).json({
        success: false,
        message: 'You already have access to this question set',
        data: {
          expiryDate: existingPurchase.expiryDate
        }
      });
    }

    // Create a payment intent with Stripe
    const paymentIntent = await stripePaymentIntent({
      amount: questionSet.price ? Math.round(questionSet.price * 100) : 0, // Convert to cents
      currency: 'usd',
      metadata: {
        userId: userId.toString(),
        quizId: quizId,
        quizTitle: questionSet.title
      }
    });

    res.status(201).json({
      success: true,
      data: {
        clientSecret: paymentIntent.client_secret,
        amount: questionSet.price,
        quizId: quizId,
        quizTitle: questionSet.title
      }
    });
  } catch (error: any) {
    console.error('Create purchase error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Server error'
    });
  }
};

// @desc    Complete purchase after successful payment
// @route   POST /api/purchases/complete
// @access  Private
export const completePurchase = async (req: Request, res: Response) => {
  const transaction = await sequelize.transaction();

  try {
    const { paymentIntentId, quizId, amount } = req.body;
    const userId = req.user.id;

    if (!paymentIntentId || !quizId || amount === undefined) {
      return res.status(400).json({
        success: false,
        message: 'Please provide paymentIntentId, quizId, and amount'
      });
    }

    // Verify the question set
    const questionSet = await QuestionSet.findByPk(quizId, { transaction });
    if (!questionSet) {
      await transaction.rollback();
      return res.status(404).json({
        success: false,
        message: 'Question set not found'
      });
    }

    // Calculate expiry date (6 months from now)
    const expiryDate = new Date();
    expiryDate.setMonth(expiryDate.getMonth() + 6);

    // Create a new purchase record
    const purchase = await Purchase.create({
      id: uuidv4(),
      userId,
      quizId,
      purchaseDate: new Date(),
      expiryDate,
      transactionId: paymentIntentId,
      amount,
      paymentMethod: 'card',
      status: 'completed'
    }, { transaction });

    await transaction.commit();

    res.status(201).json({
      success: true,
      message: 'Purchase completed successfully',
      data: {
        purchase: {
          id: purchase.id,
          quizId,
          expiryDate
        }
      }
    });
  } catch (error: any) {
    await transaction.rollback();
    
    console.error('Complete purchase error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Server error'
    });
  }
};

// @desc    Get user's purchases
// @route   GET /api/purchases
// @access  Private
export const getUserPurchases = async (req: Request, res: Response) => {
  try {
    const userId = req.user.id;

    // Get all purchases for the user
    const purchases = await Purchase.findAll({
      where: { userId },
      include: [{
        model: QuestionSet,
        as: 'questionSet',
        attributes: ['title', 'category', 'icon']
      }],
      order: [['purchaseDate', 'DESC']]
    });

    res.json({
      success: true,
      data: purchases
    });
  } catch (error: any) {
    console.error('Get purchases error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Server error'
    });
  }
};

// @desc    Check if user has access to a question set
// @route   GET /api/purchases/check/:quizId
// @access  Private
export const checkPurchaseAccess = async (req: Request, res: Response) => {
  try {
    const userId = req.user.id;
    const quizId = req.params.quizId;

    // Check for an active purchase
    const activePurchase = await Purchase.findOne({
      where: {
        userId,
        quizId,
        expiryDate: {
          [Op.gt]: new Date()
        }
      }
    });

    if (activePurchase) {
      return res.json({
        success: true,
        data: {
          hasAccess: true,
          expiryDate: activePurchase.expiryDate,
          remainingDays: Math.ceil(
            (new Date(activePurchase.expiryDate).getTime() - new Date().getTime()) / 
            (1000 * 60 * 60 * 24)
          )
        }
      });
    }

    // Check if the question set is free
    const questionSet = await QuestionSet.findByPk(quizId);
    if (questionSet && !questionSet.isPaid) {
      return res.json({
        success: true,
        data: {
          hasAccess: true,
          isFree: true
        }
      });
    }

    res.json({
      success: true,
      data: {
        hasAccess: false,
        price: questionSet?.price,
        trialQuestions: questionSet?.trialQuestions
      }
    });
  } catch (error: any) {
    console.error('Check purchase access error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Server error'
    });
  }
}; 