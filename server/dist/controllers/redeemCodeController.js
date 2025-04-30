"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.fixRedeemCodeQuestionSet = exports.getUserRedeemCodes = exports.deleteRedeemCode = exports.redeemCode = exports.getRedeemCodes = exports.generateRedeemCodes = void 0;
const models_1 = require("../models");
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
                    as: 'redeemQuestionSet',
                    attributes: ['title', 'category']
                },
                {
                    model: models_1.User,
                    as: 'redeemUser',
                    attributes: ['username', 'email']
                },
                {
                    model: models_1.User,
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
    try {
        const { code } = req.body;
        const userId = req.user.id;
        // 输出调试信息
        console.log(`尝试兑换码: ${code}, 用户ID: ${userId}`);
        // 查找兑换码
        const redeemCode = await models_1.RedeemCode.findOne({
            where: { code },
            include: [
                {
                    model: models_1.QuestionSet,
                    as: 'redeemQuestionSet'
                }
            ]
        });
        if (!redeemCode) {
            console.error(`兑换码不存在: ${code}`);
            return res.status(404).json({
                success: false,
                message: '兑换码不存在'
            });
        }
        console.log(`找到兑换码: ${redeemCode.id}, 题库ID: ${redeemCode.questionSetId}`);
        if (redeemCode.isUsed) {
            console.error(`兑换码已使用: ${code}`);
            return res.status(400).json({
                success: false,
                message: '兑换码已被使用'
            });
        }
        // 直接使用关联加载的题库，如果存在
        let questionSet = redeemCode.redeemQuestionSet;
        // 如果关联加载失败，尝试单独查询
        if (!questionSet) {
            console.log(`尝试通过ID查找题库: ${redeemCode.questionSetId}`);
            questionSet = await models_1.QuestionSet.findByPk(redeemCode.questionSetId);
        }
        if (!questionSet) {
            // 尝试强制转换ID格式并再次查询
            const questionSetId = String(redeemCode.questionSetId).trim();
            console.error(`题库不存在 - 兑换码ID: ${redeemCode.id}, 题库ID: ${questionSetId}`);
            // 尝试列出所有题库的ID，以便排查问题
            const allSets = await models_1.QuestionSet.findAll({
                attributes: ['id', 'title']
            });
            console.log(`数据库中的题库列表: ${JSON.stringify(allSets.map(s => ({ id: s.id, title: s.title })))}`);
            return res.status(404).json({
                success: false,
                message: '题库不存在'
            });
        }
        console.log(`找到题库: ${questionSet.id}, 标题: ${questionSet.title}`);
        // 创建购买记录
        const purchase = await models_1.Purchase.create({
            id: (0, uuid_1.v4)(),
            userId,
            questionSetId: questionSet.id,
            purchaseDate: new Date(),
            status: 'active',
            expiryDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30天有效期
            amount: 0,
            createdAt: new Date(),
            updatedAt: new Date()
        });
        console.log(`创建了购买记录: ${purchase.id}`);
        // 更新兑换码状态
        await redeemCode.update({
            isUsed: true,
            usedBy: userId,
            usedAt: new Date()
        });
        console.log(`已更新兑换码状态为已使用`);
        // 更新用户的购买记录
        const user = await models_1.User.findByPk(userId);
        if (user) {
            const currentPurchases = user.purchases || [];
            await user.update({
                purchases: [...currentPurchases, purchase.toJSON()]
            });
            console.log(`已更新用户购买记录`);
        }
        res.json({
            success: true,
            message: '兑换成功',
            data: {
                questionSet,
                purchase
            }
        });
    }
    catch (error) {
        console.error('兑换失败:', error);
        res.status(500).json({
            success: false,
            message: '兑换失败'
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
// @desc    Get user's redeemed codes
// @route   GET /api/redeem-codes/user
// @access  Private
const getUserRedeemCodes = async (req, res) => {
    try {
        const userId = req.user.id;
        // 查找用户已兑换的所有兑换码
        const redeemCodes = await models_1.RedeemCode.findAll({
            where: {
                usedBy: userId,
                isUsed: true
            },
            include: [
                {
                    model: models_1.QuestionSet,
                    as: 'redeemQuestionSet',
                    attributes: ['id', 'title', 'description', 'icon', 'category']
                }
            ],
            order: [['usedAt', 'DESC']]
        });
        // 获取相关的购买记录以检查有效期
        const purchases = await models_1.Purchase.findAll({
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
    }
    catch (error) {
        console.error('Get user redeemed codes error:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Server error'
        });
    }
};
exports.getUserRedeemCodes = getUserRedeemCodes;
// @desc    Fix redeem code question set association
// @route   PUT /api/redeem-codes/:id/fix-question-set
// @access  Private/Admin
const fixRedeemCodeQuestionSet = async (req, res) => {
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
        const redeemCode = await models_1.RedeemCode.findByPk(id);
        if (!redeemCode) {
            return res.status(404).json({
                success: false,
                message: '兑换码不存在'
            });
        }
        // 检查题库是否存在
        const questionSet = await models_1.QuestionSet.findByPk(questionSetId);
        if (!questionSet) {
            return res.status(404).json({
                success: false,
                message: '题库不存在'
            });
        }
        // 更新兑换码关联的题库
        await redeemCode.update({ questionSetId });
        res.json({
            success: true,
            message: '兑换码关联已成功修复',
            data: { redeemCode }
        });
    }
    catch (error) {
        console.error('修复兑换码关联失败:', error);
        res.status(500).json({
            success: false,
            message: error.message || '服务器错误'
        });
    }
};
exports.fixRedeemCodeQuestionSet = fixRedeemCodeQuestionSet;
