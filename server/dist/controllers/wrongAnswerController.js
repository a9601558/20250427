"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getUserWrongAnswers = exports.getWrongAnswerById = exports.getWrongAnswersByQuestionSet = exports.bulkDeleteWrongAnswers = exports.markAsMastered = exports.updateWrongAnswerMemo = exports.deleteWrongAnswer = exports.saveWrongAnswer = exports.getWrongAnswers = void 0;
const models_1 = require("../models");
const uuid_1 = require("uuid");
const sequelize_1 = require("sequelize");
/**
 * 获取用户所有错题记录
 */
const getWrongAnswers = async (req, res) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ success: false, message: '未授权，请先登录' });
        }
        const wrongAnswers = await models_1.WrongAnswer.findAll({
            where: { userId },
            include: [
                {
                    model: models_1.Question,
                    as: 'wrongAnswerQuestion',
                    attributes: ['id', 'text', 'questionType', 'explanation']
                },
                {
                    model: models_1.QuestionSet,
                    as: 'questionSet',
                    attributes: ['id', 'title']
                }
            ],
            order: [['createdAt', 'DESC']]
        });
        return res.json({
            success: true,
            data: wrongAnswers
        });
    }
    catch (error) {
        console.error('获取错题记录失败:', error);
        return res.status(500).json({
            success: false,
            message: '服务器错误，获取错题记录失败'
        });
    }
};
exports.getWrongAnswers = getWrongAnswers;
/**
 * 保存错题记录
 */
const saveWrongAnswer = async (req, res) => {
    try {
        const userId = req.user?.id;
        const { questionId, questionSetId, question, questionType, options, selectedOption, selectedOptions, correctOption, correctOptions, explanation, memo } = req.body;
        // 验证必要字段
        if (!questionId || !questionSetId || !question || !questionType || !options) {
            return res.status(400).json({
                success: false,
                message: '缺少必要的错题信息'
            });
        }
        // 检查错题是否已存在
        const existingWrongAnswer = await models_1.WrongAnswer.findOne({
            where: {
                userId,
                questionId,
                questionSetId
            }
        });
        let wrongAnswer;
        if (existingWrongAnswer) {
            // 更新现有错题
            wrongAnswer = await existingWrongAnswer.update({
                question,
                questionType,
                options,
                selectedOption,
                selectedOptions,
                correctOption,
                correctOptions,
                explanation,
                memo
            });
        }
        else {
            // 创建新错题记录
            wrongAnswer = await models_1.WrongAnswer.create({
                id: (0, uuid_1.v4)(),
                userId,
                questionId,
                questionSetId,
                question,
                questionType,
                options,
                selectedOption,
                selectedOptions,
                correctOption,
                correctOptions,
                explanation,
                memo
            });
        }
        res.status(201).json({
            success: true,
            message: existingWrongAnswer ? '错题已更新' : '错题已保存',
            data: wrongAnswer
        });
    }
    catch (error) {
        console.error('保存错题失败:', error);
        res.status(500).json({
            success: false,
            message: '服务器错误，无法保存错题'
        });
    }
};
exports.saveWrongAnswer = saveWrongAnswer;
/**
 * 删除错题记录
 */
const deleteWrongAnswer = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user?.id;
        const wrongAnswer = await models_1.WrongAnswer.findOne({
            where: {
                id,
                userId
            }
        });
        if (!wrongAnswer) {
            return res.status(404).json({
                success: false,
                message: '错题不存在或无权访问'
            });
        }
        await wrongAnswer.destroy();
        res.json({
            success: true,
            message: '错题已删除'
        });
    }
    catch (error) {
        console.error('删除错题失败:', error);
        res.status(500).json({
            success: false,
            message: '服务器错误，无法删除错题'
        });
    }
};
exports.deleteWrongAnswer = deleteWrongAnswer;
/**
 * 更新错题备注
 */
const updateWrongAnswerMemo = async (req, res) => {
    try {
        const { id } = req.params;
        const { memo } = req.body;
        const userId = req.user?.id;
        const wrongAnswer = await models_1.WrongAnswer.findOne({
            where: {
                id,
                userId
            }
        });
        if (!wrongAnswer) {
            return res.status(404).json({
                success: false,
                message: '错题不存在或无权访问'
            });
        }
        await wrongAnswer.update({ memo });
        res.json({
            success: true,
            message: '错题备注已更新',
            data: wrongAnswer
        });
    }
    catch (error) {
        console.error('更新错题备注失败:', error);
        res.status(500).json({
            success: false,
            message: '服务器错误，无法更新错题备注'
        });
    }
};
exports.updateWrongAnswerMemo = updateWrongAnswerMemo;
/**
 * 标记错题为已掌握（删除）
 */
const markAsMastered = async (req, res) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ success: false, message: '未授权，请先登录' });
        }
        const { id } = req.params;
        const wrongAnswer = await models_1.WrongAnswer.findOne({
            where: {
                id,
                userId
            }
        });
        if (!wrongAnswer) {
            return res.status(404).json({
                success: false,
                message: '错题记录不存在'
            });
        }
        await wrongAnswer.destroy();
        return res.json({
            success: true,
            message: '已标记为掌握，该题已从错题集中移除'
        });
    }
    catch (error) {
        console.error('标记为已掌握失败:', error);
        return res.status(500).json({
            success: false,
            message: '服务器错误，标记为已掌握失败'
        });
    }
};
exports.markAsMastered = markAsMastered;
/**
 * 批量删除错题
 */
const bulkDeleteWrongAnswers = async (req, res) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ success: false, message: '未授权，请先登录' });
        }
        const { ids } = req.body;
        if (!Array.isArray(ids) || ids.length === 0) {
            return res.status(400).json({
                success: false,
                message: '请提供要删除的错题ID列表'
            });
        }
        await models_1.WrongAnswer.destroy({
            where: {
                id: {
                    [sequelize_1.Op.in]: ids
                },
                userId
            }
        });
        return res.json({
            success: true,
            message: `成功删除${ids.length}条错题记录`
        });
    }
    catch (error) {
        console.error('批量删除错题失败:', error);
        return res.status(500).json({
            success: false,
            message: '服务器错误，批量删除错题失败'
        });
    }
};
exports.bulkDeleteWrongAnswers = bulkDeleteWrongAnswers;
/**
 * 获取题库下的错题
 */
const getWrongAnswersByQuestionSet = async (req, res) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ success: false, message: '未授权，请先登录' });
        }
        const { questionSetId } = req.params;
        const wrongAnswers = await models_1.WrongAnswer.findAll({
            where: {
                userId,
                questionSetId
            },
            order: [['createdAt', 'DESC']]
        });
        return res.json({
            success: true,
            data: wrongAnswers
        });
    }
    catch (error) {
        console.error('获取题库错题失败:', error);
        return res.status(500).json({
            success: false,
            message: '服务器错误，获取题库错题失败'
        });
    }
};
exports.getWrongAnswersByQuestionSet = getWrongAnswersByQuestionSet;
/**
 * 获取错题详情
 */
const getWrongAnswerById = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user?.id;
        const wrongAnswer = await models_1.WrongAnswer.findOne({
            where: {
                id,
                userId
            },
            include: [
                {
                    model: models_1.Question,
                    as: 'wrongAnswerQuestion',
                    attributes: ['id', 'text', 'questionType', 'explanation']
                },
                {
                    model: models_1.QuestionSet,
                    as: 'questionSet',
                    attributes: ['id', 'title', 'description', 'category']
                }
            ]
        });
        if (!wrongAnswer) {
            return res.status(404).json({
                success: false,
                message: '错题不存在或无权访问'
            });
        }
        res.json({
            success: true,
            data: wrongAnswer
        });
    }
    catch (error) {
        console.error('获取错题详情失败:', error);
        res.status(500).json({
            success: false,
            message: '服务器错误，无法获取错题详情'
        });
    }
};
exports.getWrongAnswerById = getWrongAnswerById;
/**
 * 获取用户的错题列表
 */
const getUserWrongAnswers = async (req, res) => {
    try {
        const userId = req.user?.id;
        const { questionSetId } = req.query;
        const query = { userId };
        // 如果提供了题库ID，则按题库筛选
        if (questionSetId) {
            query.questionSetId = questionSetId;
        }
        const wrongAnswers = await models_1.WrongAnswer.findAll({
            where: query,
            include: [
                {
                    model: models_1.Question,
                    as: 'wrongAnswerQuestion',
                    attributes: ['id', 'text', 'questionType', 'explanation']
                },
                {
                    model: models_1.QuestionSet,
                    as: 'questionSet',
                    attributes: ['id', 'title', 'description', 'category']
                }
            ],
            order: [['createdAt', 'DESC']]
        });
        res.json({
            success: true,
            data: wrongAnswers
        });
    }
    catch (error) {
        console.error('获取错题列表失败:', error);
        res.status(500).json({
            success: false,
            message: '服务器错误，无法获取错题列表'
        });
    }
};
exports.getUserWrongAnswers = getUserWrongAnswers;
