"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteRedeemCode = exports.redeemCode = exports.getRedeemCodes = exports.generateRedeemCodes = void 0;
const models_1 = require("../models");
const sequelize_1 = require("sequelize");
const uuid_1 = require("uuid");
// @desc    Generate redeem codes
// @route   POST /api/redeem-codes/generate
// @access  Private/Admin
const generateRedeemCodes = async (req, res) => {
    try {
        const { questionSetId, validityDays, quantity = 1 } = req.body;
        if (!questionSetId || !validityDays || validityDays < 1) {
            return res.status(400).json({
                success: false,
                message: 'Please provide valid questionSetId and validityDays'
            });
        }
        // Verify question set exists
        const questionSet = await models_1.QuestionSet.findByPk(questionSetId);
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
            const code = await models_1.RedeemCode.generateUniqueCode();
            const redeemCode = await models_1.RedeemCode.create({
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
    }
    catch (error) {
        console.error('Generate redeem codes error:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Server error'
        });
    }
};
exports.generateRedeemCodes = generateRedeemCodes;
// @desc    Get all redeem codes
// @route   GET /api/redeem-codes
// @access  Private/Admin
const getRedeemCodes = async (req, res) => {
    try {
        const redeemCodes = await models_1.RedeemCode.findAll({
            include: [
                {
                    model: models_1.QuestionSet,
                    as: 'questionSet',
                    attributes: ['title', 'category']
                },
                {
                    model: models_1.User,
                    as: 'user',
                    attributes: ['username', 'email']
                },
                {
                    model: models_1.User,
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
    }
    catch (error) {
        console.error('Get redeem codes error:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Server error'
        });
    }
};
exports.getRedeemCodes = getRedeemCodes;
// @desc    Redeem a code
// @route   POST /api/redeem-codes/redeem
// @access  Private
const redeemCode = async (req, res) => {
    // Start transaction
    const transaction = await models_1.sequelize.transaction();
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
        const redeemCode = await models_1.RedeemCode.findOne({
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
        const questionSet = await models_1.QuestionSet.findByPk(redeemCode.questionSetId, { transaction });
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
        const user = await models_1.User.findByPk(userId, { transaction });
        if (!user) {
            await transaction.rollback();
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }
        // Check if user already has access to this question set
        const existingPurchase = await models_1.Purchase.findOne({
            where: {
                userId,
                quizId: redeemCode.questionSetId,
                expiryDate: {
                    [sequelize_1.Op.gt]: new Date()
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
        }
        else {
            // Create new purchase
            await models_1.Purchase.create({
                id: (0, uuid_1.v4)(),
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
    }
    catch (error) {
        // Rollback transaction on error
        await transaction.rollback();
        console.error('Redeem code error:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Server error'
        });
    }
};
exports.redeemCode = redeemCode;
// @desc    Delete a redeem code
// @route   DELETE /api/redeem-codes/:id
// @access  Private/Admin
const deleteRedeemCode = async (req, res) => {
    try {
        const redeemCode = await models_1.RedeemCode.findByPk(req.params.id);
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
    }
    catch (error) {
        console.error('Delete redeem code error:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Server error'
        });
    }
};
exports.deleteRedeemCode = deleteRedeemCode;
