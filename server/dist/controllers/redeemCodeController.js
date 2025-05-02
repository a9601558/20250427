"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getRedeemCode = exports.useRedeemCode = exports.createRedeemCode = exports.batchFixRedeemCodes = exports.debugRedeemCodes = exports.fixRedeemCodeQuestionSet = exports.getUserRedeemCodes = exports.deleteRedeemCode = exports.redeemCode = exports.getRedeemCodes = exports.generateRedeemCodes = void 0;
const models_1 = require("../models");
const sequelize_1 = require("sequelize");
const uuid_1 = require("uuid");
const socket_1 = require("../socket"); // Import the getSocketIO function
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
        const userId = req.user?.id;
        // 获取分页参数
        const page = parseInt(req.query.page) || 1;
        const pageSize = parseInt(req.query.pageSize) || 10;
        const offset = (page - 1) * pageSize;
        const limit = pageSize;
        const { isUsed, questionSetId } = req.query;
        // 构建查询条件
        const whereClause = {};
        if (isUsed !== undefined) {
            whereClause.isUsed = isUsed === 'true';
        }
        if (questionSetId) {
            whereClause.questionSetId = questionSetId;
        }
        // 查询兑换码
        const { count, rows } = await models_1.RedeemCode.findAndCountAll({
            where: whereClause,
            include: [
                {
                    model: models_1.QuestionSet,
                    as: 'redeemQuestionSet',
                    attributes: ['id', 'title', 'description']
                },
                {
                    model: models_1.User,
                    as: 'redeemUser',
                    attributes: ['id', 'username', 'email']
                },
                {
                    model: models_1.User,
                    as: 'redeemCreator',
                    attributes: ['id', 'username', 'email']
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
    }
    catch (error) {
        console.error('获取兑换码列表出错:', error);
        return res.status(500).json({
            success: false,
            message: '服务器错误，获取兑换码列表失败'
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
        // 直接使用原始SQL查询获取兑换码，避免关联加载问题
        const [redeemCodeResults] = await models_1.sequelize.query(`SELECT * FROM redeem_codes WHERE code = ?`, {
            replacements: [code],
            type: sequelize_1.QueryTypes.SELECT
        });
        // 检查兑换码是否存在
        if (!redeemCodeResults) {
            console.error(`兑换码不存在: ${code}`);
            return res.status(404).json({
                success: false,
                message: '兑换码不存在'
            });
        }
        // 获取兑换码信息
        const redeemCode = redeemCodeResults;
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
        const [questionSetResults] = await models_1.sequelize.query(`SELECT * FROM question_sets WHERE id = ?`, {
            replacements: [redeemCode.questionSetId],
            type: sequelize_1.QueryTypes.SELECT
        });
        if (!questionSetResults) {
            console.error(`题库不存在 - 兑换码ID: ${redeemCode.id}, 题库ID: ${redeemCode.questionSetId}`);
            return res.status(404).json({
                success: false,
                message: '题库不存在'
            });
        }
        const questionSet = questionSetResults;
        console.log(`找到题库: ${questionSet.id}, 标题: ${questionSet.title}`);
        // 创建购买记录
        const purchaseId = (0, uuid_1.v4)();
        const now = new Date();
        const expiryDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30天有效期
        await models_1.sequelize.query(`INSERT INTO purchases (id, user_id, question_set_id, purchase_date, status, expiry_date, amount, created_at, updated_at)
       VALUES (?, ?, ?, ?, 'active', ?, 0, ?, ?)`, {
            replacements: [purchaseId, userId, questionSet.id, now, expiryDate, now, now],
            type: sequelize_1.QueryTypes.INSERT
        });
        console.log(`创建了购买记录: ${purchaseId}`);
        // 更新兑换码状态
        await models_1.sequelize.query(`UPDATE redeem_codes SET isUsed = 1, usedBy = ?, usedAt = ? WHERE id = ?`, {
            replacements: [userId, now, redeemCode.id],
            type: sequelize_1.QueryTypes.UPDATE
        });
        console.log(`已更新兑换码状态为已使用`);
        // 查询创建的购买记录
        const [purchase] = await models_1.sequelize.query(`SELECT * FROM purchases WHERE id = ?`, {
            replacements: [purchaseId],
            type: sequelize_1.QueryTypes.SELECT
        });
        // 查询用户的socket_id
        const [userSocketResult] = await models_1.sequelize.query(`SELECT socket_id FROM users WHERE id = ?`, {
            replacements: [userId],
            type: sequelize_1.QueryTypes.SELECT
        });
        // 如果用户在线，通过Socket.IO发送兑换成功通知
        const userSocket = userSocketResult;
        if (userSocket && userSocket.socket_id) {
            try {
                const io = (0, socket_1.getSocketIO)();
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
            }
            catch (error) {
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
        await redeemCode.update({ questionSetId: String(questionSetId) });
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
// @desc    Debug redeem codes and question sets
// @route   GET /api/redeem-codes/debug
// @access  Private/Admin
const debugRedeemCodes = async (req, res) => {
    try {
        // 获取所有兑换码
        const redeemCodes = await models_1.RedeemCode.findAll({
            attributes: ['id', 'code', 'questionSetId', 'isUsed', 'createdAt']
        });
        // 获取所有题库
        const questionSets = await models_1.QuestionSet.findAll({
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
            }
            else {
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
    }
    catch (error) {
        console.error('Debug redeem codes error:', error);
        res.status(500).json({
            success: false,
            message: error.message || '服务器错误'
        });
    }
};
exports.debugRedeemCodes = debugRedeemCodes;
// @desc    Batch fix redeem code question set associations
// @route   POST /api/redeem-codes/batch-fix
// @access  Private/Admin
const batchFixRedeemCodes = async (req, res) => {
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
            details: []
        };
        // 逐个处理每个兑换码
        for (const [codeId, questionSetId] of Object.entries(codeToQuestionSetMap)) {
            try {
                // 检查题库是否存在
                const questionSet = await models_1.QuestionSet.findByPk(String(questionSetId));
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
                const redeemCode = await models_1.RedeemCode.findByPk(codeId);
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
            }
            catch (error) {
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
    }
    catch (error) {
        console.error('批量修复兑换码关联失败:', error);
        res.status(500).json({
            success: false,
            message: error.message || '服务器错误'
        });
    }
};
exports.batchFixRedeemCodes = batchFixRedeemCodes;
// 创建兑换码
const createRedeemCode = async (req, res) => {
    const { questionSetId, validityDays = 30, quantity = 1 } = req.body;
    const userId = req.user?.id;
    try {
        // 验证题库ID是否存在
        const questionSet = await models_1.QuestionSet.findByPk(questionSetId);
        if (!questionSet) {
            return res.status(404).json({
                success: false,
                message: '题库不存在'
            });
        }
        // 创建兑换码记录
        const createdCodes = [];
        for (let i = 0; i < quantity; i++) {
            const code = await models_1.RedeemCode.create({
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
    }
    catch (error) {
        console.error('创建兑换码出错:', error);
        return res.status(500).json({
            success: false,
            message: '服务器错误，创建兑换码失败'
        });
    }
};
exports.createRedeemCode = createRedeemCode;
// 使用兑换码
const useRedeemCode = async (req, res) => {
    const { code } = req.body;
    const userId = req.user?.id;
    try {
        // 开启事务
        const result = await models_1.sequelize.transaction(async (t) => {
            // 查找兑换码
            const redeemCode = await models_1.RedeemCode.findOne({
                where: { code },
                include: [{
                        model: models_1.QuestionSet,
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
    }
    catch (error) {
        console.error('使用兑换码出错:', error);
        return res.status(500).json({
            success: false,
            message: '服务器错误，兑换失败'
        });
    }
};
exports.useRedeemCode = useRedeemCode;
// 获取单个兑换码
const getRedeemCode = async (req, res) => {
    const { id } = req.params;
    try {
        const redeemCode = await models_1.RedeemCode.findByPk(id, {
            include: [
                {
                    model: models_1.QuestionSet,
                    as: 'redeemQuestionSet',
                    attributes: ['id', 'title', 'description']
                },
                {
                    model: models_1.User,
                    as: 'redeemUser',
                    attributes: ['id', 'username', 'email']
                },
                {
                    model: models_1.User,
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
    }
    catch (error) {
        console.error('获取兑换码详情出错:', error);
        return res.status(500).json({
            success: false,
            message: '服务器错误，获取兑换码详情失败'
        });
    }
};
exports.getRedeemCode = getRedeemCode;
