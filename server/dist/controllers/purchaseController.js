"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkPurchaseAccess = exports.getUserPurchases = exports.completePurchase = exports.createPurchase = void 0;
const sequelize_1 = require("sequelize");
const models_1 = require("../models");
const stripe_1 = require("../services/stripe");
const uuid_1 = require("uuid");
// @desc    Create a new purchase (payment intent)
// @route   POST /api/purchases
// @access  Private
const createPurchase = async (req, res) => {
    try {
        const { quizId } = req.body;
        const userId = req.user.id;
        // Validate the quiz ID
        const questionSet = await models_1.QuestionSet.findByPk(quizId);
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
        const user = await models_1.User.findByPk(userId);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }
        // 查找现有购买记录
        const existingPurchase = await models_1.Purchase.findOne({
            where: {
                userId,
                quizId,
                expiryDate: {
                    [sequelize_1.Op.gt]: new Date()
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
        const paymentIntent = await (0, stripe_1.stripePaymentIntent)({
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
    }
    catch (error) {
        console.error('Create purchase error:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Server error'
        });
    }
};
exports.createPurchase = createPurchase;
// @desc    Complete purchase after successful payment
// @route   POST /api/purchases/complete
// @access  Private
const completePurchase = async (req, res) => {
    const transaction = await models_1.sequelize.transaction();
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
        const questionSet = await models_1.QuestionSet.findByPk(quizId, { transaction });
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
        const purchase = await models_1.Purchase.create({
            id: (0, uuid_1.v4)(),
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
    }
    catch (error) {
        await transaction.rollback();
        console.error('Complete purchase error:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Server error'
        });
    }
};
exports.completePurchase = completePurchase;
// @desc    Get user's purchases
// @route   GET /api/purchases
// @access  Private
const getUserPurchases = async (req, res) => {
    try {
        const userId = req.user.id;
        // Get all purchases for the user
        const purchases = await models_1.Purchase.findAll({
            where: { userId },
            include: [{
                    model: models_1.QuestionSet,
                    as: 'questionSet',
                    attributes: ['title', 'category', 'icon']
                }],
            order: [['purchaseDate', 'DESC']]
        });
        res.json({
            success: true,
            data: purchases
        });
    }
    catch (error) {
        console.error('Get purchases error:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Server error'
        });
    }
};
exports.getUserPurchases = getUserPurchases;
// @desc    Check if user has access to a question set
// @route   GET /api/purchases/check/:quizId
// @access  Private
const checkPurchaseAccess = async (req, res) => {
    try {
        const userId = req.user.id;
        const quizId = req.params.quizId;
        // Check for an active purchase
        const activePurchase = await models_1.Purchase.findOne({
            where: {
                userId,
                quizId,
                expiryDate: {
                    [sequelize_1.Op.gt]: new Date()
                }
            }
        });
        if (activePurchase) {
            return res.json({
                success: true,
                data: {
                    hasAccess: true,
                    expiryDate: activePurchase.expiryDate,
                    remainingDays: Math.ceil((new Date(activePurchase.expiryDate).getTime() - new Date().getTime()) /
                        (1000 * 60 * 60 * 24))
                }
            });
        }
        // Check if the question set is free
        const questionSet = await models_1.QuestionSet.findByPk(quizId);
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
                price: questionSet === null || questionSet === void 0 ? void 0 : questionSet.price,
                trialQuestions: questionSet === null || questionSet === void 0 ? void 0 : questionSet.trialQuestions
            }
        });
    }
    catch (error) {
        console.error('Check purchase access error:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Server error'
        });
    }
};
exports.checkPurchaseAccess = checkPurchaseAccess;
