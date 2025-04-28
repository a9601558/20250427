"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getRandomQuestion = exports.deleteQuestion = exports.updateQuestion = exports.createQuestion = exports.getQuestionById = exports.getQuestions = void 0;
const Question_1 = __importDefault(require("../models/Question"));
const responseUtils_1 = require("../utils/responseUtils");
/**
 * @route GET /api/v1/questions
 * @access Public
 */
const getQuestions = async (req, res) => {
    try {
        const { questionSetId, page = 1, limit = 10 } = req.query;
        const offset = (Number(page) - 1) * Number(limit);
        const where = questionSetId ? { questionSetId: String(questionSetId) } : {};
        const { count, rows: questions } = await Question_1.default.findAndCountAll({
            where,
            limit: Number(limit),
            offset,
            order: [['orderIndex', 'ASC']]
        });
        (0, responseUtils_1.sendResponse)(res, 200, '获取问题列表成功', questions);
    }
    catch (error) {
        (0, responseUtils_1.sendError)(res, 500, '获取问题列表失败', error);
    }
};
exports.getQuestions = getQuestions;
/**
 * @route GET /api/v1/questions/:id
 * @access Public
 */
const getQuestionById = async (req, res) => {
    try {
        const question = await Question_1.default.findByPk(req.params.id);
        if (!question) {
            return (0, responseUtils_1.sendError)(res, 404, '问题不存在');
        }
        (0, responseUtils_1.sendResponse)(res, 200, '获取问题成功', question);
    }
    catch (error) {
        (0, responseUtils_1.sendError)(res, 500, '获取问题失败', error);
    }
};
exports.getQuestionById = getQuestionById;
/**
 * @route POST /api/v1/questions
 * @access Admin
 */
const createQuestion = async (req, res) => {
    try {
        const { questionSetId, text, questionType, explanation, orderIndex } = req.body;
        if (!questionSetId || !text || !questionType || !explanation) {
            return (0, responseUtils_1.sendError)(res, 400, '缺少必要字段');
        }
        const question = await Question_1.default.create({
            questionSetId,
            text,
            questionType,
            explanation,
            orderIndex: orderIndex || 0
        });
        (0, responseUtils_1.sendResponse)(res, 201, '创建问题成功', question);
    }
    catch (error) {
        (0, responseUtils_1.sendError)(res, 500, '创建问题失败', error);
    }
};
exports.createQuestion = createQuestion;
/**
 * @route PUT /api/v1/questions/:id
 * @access Admin
 */
const updateQuestion = async (req, res) => {
    try {
        const question = await Question_1.default.findByPk(req.params.id);
        if (!question) {
            return (0, responseUtils_1.sendError)(res, 404, '问题不存在');
        }
        const { text, questionType, explanation, orderIndex } = req.body;
        await question.update({
            text,
            questionType,
            explanation,
            orderIndex
        });
        (0, responseUtils_1.sendResponse)(res, 200, '更新问题成功', question);
    }
    catch (error) {
        (0, responseUtils_1.sendError)(res, 500, '更新问题失败', error);
    }
};
exports.updateQuestion = updateQuestion;
/**
 * @route DELETE /api/v1/questions/:id
 * @access Admin
 */
const deleteQuestion = async (req, res) => {
    try {
        const question = await Question_1.default.findByPk(req.params.id);
        if (!question) {
            return (0, responseUtils_1.sendError)(res, 404, '问题不存在');
        }
        await question.destroy();
        (0, responseUtils_1.sendResponse)(res, 200, '问题删除成功');
    }
    catch (error) {
        (0, responseUtils_1.sendError)(res, 500, '删除问题失败', error);
    }
};
exports.deleteQuestion = deleteQuestion;
/**
 * @route GET /api/v1/questions/random/:questionSetId
 * @access Public
 */
const getRandomQuestion = async (req, res) => {
    try {
        const { questionSetId } = req.query;
        if (!questionSetId) {
            return (0, responseUtils_1.sendError)(res, 400, '缺少问题集ID');
        }
        const count = await Question_1.default.count({ where: { questionSetId: String(questionSetId) } });
        if (count === 0) {
            return (0, responseUtils_1.sendError)(res, 404, '该问题集没有可用的问题');
        }
        const randomOffset = Math.floor(Math.random() * count);
        const question = await Question_1.default.findOne({
            where: { questionSetId: String(questionSetId) },
            offset: randomOffset
        });
        (0, responseUtils_1.sendResponse)(res, 200, '获取随机问题成功', question);
    }
    catch (error) {
        (0, responseUtils_1.sendError)(res, 500, '获取随机问题失败', error);
    }
};
exports.getRandomQuestion = getRandomQuestion;
