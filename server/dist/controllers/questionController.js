"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getQuestionsByQuestionSetId = exports.deleteQuestion = exports.getQuestionById = exports.updateQuestion = exports.createQuestion = exports.deleteQuestionSet = exports.updateQuestionSet = exports.createQuestionSet = exports.getQuestionSetById = exports.getAllQuestionSets = void 0;
const QuestionSet_1 = __importDefault(require("../models/QuestionSet"));
const Question_1 = __importDefault(require("../models/Question"));
const Option_1 = __importDefault(require("../models/Option"));
const db_1 = require("../config/db");
const socket_1 = require("../config/socket");
// @desc    获取所有题库
// @route   GET /api/question-sets
// @access  Public
const getAllQuestionSets = async (req, res) => {
    try {
        const questionSets = await QuestionSet_1.default.findAll({
            include: [{
                    model: Question_1.default,
                    as: 'questions',
                    include: [{ model: Option_1.default, as: 'options' }]
                }]
        });
        res.json({
            success: true,
            data: questionSets
        });
    }
    catch (error) {
        console.error('获取题库错误:', error);
        res.status(500).json({
            success: false,
            message: error.message || '服务器错误'
        });
    }
};
exports.getAllQuestionSets = getAllQuestionSets;
// @desc    获取特定题库
// @route   GET /api/question-sets/:id
// @access  Public
const getQuestionSetById = async (req, res) => {
    try {
        const questionSet = await QuestionSet_1.default.findByPk(req.params.id, {
            include: [{
                    model: Question_1.default,
                    as: 'questions',
                    include: [{ model: Option_1.default, as: 'options' }]
                }]
        });
        if (!questionSet) {
            return res.status(404).json({
                success: false,
                message: '题库不存在'
            });
        }
        res.json({
            success: true,
            data: questionSet
        });
    }
    catch (error) {
        console.error('获取题库详情错误:', error);
        res.status(500).json({
            success: false,
            message: error.message || '服务器错误'
        });
    }
};
exports.getQuestionSetById = getQuestionSetById;
// @desc    创建新题库
// @route   POST /api/question-sets
// @access  Private/Admin
const createQuestionSet = async (req, res) => {
    try {
        const { id, title, description, category, icon, isPaid, price, trialQuestions, questions } = req.body;
        // 验证必填字段
        if (!id || !title || !category) {
            return res.status(400).json({
                success: false,
                message: '请提供所有必填字段'
            });
        }
        // 检查题库ID是否已存在
        const existingSet = await QuestionSet_1.default.findByPk(id);
        if (existingSet) {
            return res.status(400).json({
                success: false,
                message: 'ID已存在，请使用另一个ID'
            });
        }
        // 创建题库
        const questionSet = await QuestionSet_1.default.create({
            id,
            title,
            description,
            category,
            icon,
            isPaid: isPaid || false,
            price: isPaid ? price : null,
            trialQuestions: isPaid ? trialQuestions : null
        });
        // 如果提供了题目，则创建题目
        if (questions && questions.length > 0) {
            const createdQuestions = await Question_1.default.bulkCreate(questions.map((q) => ({
                ...q,
                questionSetId: questionSet.id
            })));
        }
        // 获取带有题目的完整题库
        const fullQuestionSet = await QuestionSet_1.default.findByPk(questionSet.id, {
            include: [{
                    model: Question_1.default,
                    as: 'questions',
                    include: [{ model: Option_1.default, as: 'options' }]
                }]
        });
        res.status(201).json({
            success: true,
            data: fullQuestionSet,
            message: '题库创建成功'
        });
    }
    catch (error) {
        console.error('创建题库错误:', error);
        res.status(500).json({
            success: false,
            message: error.message || '服务器错误'
        });
    }
};
exports.createQuestionSet = createQuestionSet;
// @desc    更新题库
// @route   PUT /api/question-sets/:id
// @access  Private/Admin
const updateQuestionSet = async (req, res) => {
    try {
        const { title, description, category, icon, isPaid, price, trialQuestions, questions } = req.body;
        // 查找题库
        const questionSet = await QuestionSet_1.default.findByPk(req.params.id);
        if (!questionSet) {
            return res.status(404).json({
                success: false,
                message: '题库不存在'
            });
        }
        // 更新题库信息
        await questionSet.update({
            title: title || questionSet.title,
            description: description || questionSet.description,
            category: category || questionSet.category,
            icon: icon || questionSet.icon,
            isPaid: isPaid !== undefined ? isPaid : questionSet.isPaid,
            price: isPaid ? price : null,
            trialQuestions: isPaid ? trialQuestions : null
        });
        // 如果提供了题目，则更新题目
        if (questions && questions.length > 0) {
            // 先删除所有旧题目
            await Question_1.default.destroy({
                where: { questionSetId: questionSet.id }
            });
            // 添加新题目
            await Question_1.default.bulkCreate(questions.map((q) => ({
                ...q,
                questionSetId: questionSet.id
            })));
        }
        // 获取更新后的完整题库
        const updatedQuestionSet = await QuestionSet_1.default.findByPk(questionSet.id, {
            include: [{
                    model: Question_1.default,
                    as: 'questions',
                    include: [{ model: Option_1.default, as: 'options' }]
                }]
        });
        res.json({
            success: true,
            data: updatedQuestionSet,
            message: '题库更新成功'
        });
    }
    catch (error) {
        console.error('更新题库错误:', error);
        res.status(500).json({
            success: false,
            message: error.message || '服务器错误'
        });
    }
};
exports.updateQuestionSet = updateQuestionSet;
// @desc    删除题库
// @route   DELETE /api/question-sets/:id
// @access  Private/Admin
const deleteQuestionSet = async (req, res) => {
    try {
        const questionSet = await QuestionSet_1.default.findByPk(req.params.id);
        if (!questionSet) {
            return res.status(404).json({
                success: false,
                message: '题库不存在'
            });
        }
        // 删除题库 (关联的题目会通过外键约束自动删除)
        await questionSet.destroy();
        res.json({
            success: true,
            message: '题库删除成功'
        });
    }
    catch (error) {
        console.error('删除题库错误:', error);
        res.status(500).json({
            success: false,
            message: error.message || '服务器错误'
        });
    }
};
exports.deleteQuestionSet = deleteQuestionSet;
/**
 * @desc    添加新题目
 * @route   POST /api/questions
 * @access  Admin
 */
const createQuestion = async (req, res) => {
    try {
        const { questionSetId, text, explanation, questionType, options, orderIndex } = req.body;
        if (!questionSetId) {
            return res.status(400).json({
                success: false,
                message: '题库ID不能为空'
            });
        }
        if (!text) {
            return res.status(400).json({
                success: false,
                message: '题目内容不能为空'
            });
        }
        if (!Array.isArray(options) || options.length < 2) {
            return res.status(400).json({
                success: false,
                message: '请提供至少两个选项'
            });
        }
        // 使用事务确保题目和选项一起创建成功
        const result = await db_1.sequelize.transaction(async (t) => {
            // 创建题目
            const question = await Question_1.default.create({
                questionSetId,
                text,
                explanation: explanation || '暂无解析',
                questionType: questionType || 'single',
                orderIndex: orderIndex !== undefined ? orderIndex : 0
            }, { transaction: t });
            // 创建选项
            const optionPromises = options.map((option, index) => {
                return Option_1.default.create({
                    questionId: question.id,
                    text: option.text || `选项 ${index + 1}`,
                    isCorrect: !!option.isCorrect,
                    optionIndex: option.optionIndex || String.fromCharCode(65 + index)
                }, { transaction: t });
            });
            await Promise.all(optionPromises);
            // 返回创建的题目（包含选项）
            return Question_1.default.findByPk(question.id, {
                include: [{ model: Option_1.default, as: 'options' }],
                transaction: t
            });
        });
        // 获取最新的题目数量
        const questionCount = await Question_1.default.count({
            where: { questionSetId }
        });
        // 通过Socket.IO通知所有客户端更新题目数量
        const io = req.app.get('io');
        if (io) {
            io.emit('question_count_updated', {
                questionSetId,
                count: questionCount
            });
        }
        res.status(201).json({
            success: true,
            message: '题目创建成功',
            data: result
        });
    }
    catch (error) {
        console.error('创建题目失败:', error);
        res.status(500).json({
            success: false,
            message: error.message || '服务器错误'
        });
    }
};
exports.createQuestion = createQuestion;
/**
 * @desc    更新题目
 * @route   PUT /api/questions/:id
 * @access  Admin
 */
const updateQuestion = async (req, res) => {
    try {
        const { id } = req.params;
        const { text, explanation, questionType, options, orderIndex } = req.body;
        // 查找现有题目
        const question = await Question_1.default.findByPk(id);
        if (!question) {
            return res.status(404).json({
                success: false,
                message: '题目不存在'
            });
        }
        // 使用事务确保题目和选项一起更新成功
        const result = await db_1.sequelize.transaction(async (t) => {
            // 更新题目
            await question.update({
                text: text || question.text,
                explanation: explanation || question.explanation,
                questionType: questionType || question.questionType,
                orderIndex: orderIndex !== undefined ? orderIndex : question.orderIndex
            }, { transaction: t });
            // 如果提供了选项，则更新选项
            if (Array.isArray(options)) {
                // 先删除现有选项
                await Option_1.default.destroy({
                    where: { questionId: id },
                    transaction: t
                });
                // 创建新选项
                const optionPromises = options.map((option, index) => {
                    return Option_1.default.create({
                        questionId: id,
                        text: option.text || `选项 ${index + 1}`,
                        isCorrect: !!option.isCorrect,
                        optionIndex: option.optionIndex || option.id || String.fromCharCode(65 + index) // A, B, C...
                    }, { transaction: t });
                });
                await Promise.all(optionPromises);
            }
            // 返回更新后的题目（包含选项）
            return Question_1.default.findByPk(id, {
                include: [{ model: Option_1.default, as: 'options' }],
                transaction: t
            });
        });
        res.status(200).json({
            success: true,
            message: '题目更新成功',
            data: result
        });
    }
    catch (error) {
        console.error('更新题目失败:', error);
        res.status(500).json({
            success: false,
            message: '更新题目失败',
            error: error.message
        });
    }
};
exports.updateQuestion = updateQuestion;
/**
 * @desc    获取题目详情
 * @route   GET /api/questions/:id
 * @access  Public
 */
const getQuestionById = async (req, res) => {
    try {
        const { id } = req.params;
        const question = await Question_1.default.findByPk(id, {
            include: [{ model: Option_1.default, as: 'options' }]
        });
        if (!question) {
            return res.status(404).json({
                success: false,
                message: '题目不存在'
            });
        }
        res.status(200).json({
            success: true,
            data: question
        });
    }
    catch (error) {
        console.error('获取题目失败:', error);
        res.status(500).json({
            success: false,
            message: '获取题目失败',
            error: error.message
        });
    }
};
exports.getQuestionById = getQuestionById;
/**
 * @desc    删除题目
 * @route   DELETE /api/questions/:id
 * @access  Admin
 */
const deleteQuestion = async (req, res) => {
    try {
        const { id } = req.params;
        // 查找题目
        const question = await Question_1.default.findByPk(id);
        if (!question) {
            return res.status(404).json({
                success: false,
                message: '题目不存在'
            });
        }
        const questionSetId = question.questionSetId;
        // 使用事务删除题目和选项
        await db_1.sequelize.transaction(async (t) => {
            // 先删除选项
            await Option_1.default.destroy({
                where: { questionId: id },
                transaction: t
            });
            // 删除题目
            await question.destroy({ transaction: t });
        });
        // 获取最新的题目数量
        const questionCount = await Question_1.default.count({
            where: { questionSetId }
        });
        // 通过Socket.IO通知所有客户端更新题目数量
        const io = req.app.get('io');
        (0, socket_1.emitToHomepage)(io, 'question_count_updated', {
            questionSetId,
            count: questionCount
        });
        res.status(200).json({
            success: true,
            message: '题目删除成功'
        });
    }
    catch (error) {
        console.error('删除题目失败:', error);
        res.status(500).json({
            success: false,
            message: error.message || '服务器错误'
        });
    }
};
exports.deleteQuestion = deleteQuestion;
/**
 * @desc    获取题库所有题目
 * @route   GET /api/questions?questionSetId=id
 * @access  Public
 */
const getQuestionsByQuestionSetId = async (req, res) => {
    try {
        const questionSetId = req.query.questionSetId;
        if (!questionSetId) {
            return res.status(400).json({
                success: false,
                message: 'questionSetId 参数是必需的'
            });
        }
        // 查询特定题库的所有题目
        const questions = await Question_1.default.findAll({
            where: { questionSetId },
            include: [{ model: Option_1.default, as: 'options' }],
            order: [['orderIndex', 'ASC']]
        });
        console.log(`找到题库 ${questionSetId} 的 ${questions.length} 个题目`);
        res.json({
            success: true,
            data: questions
        });
    }
    catch (error) {
        console.error('获取题库题目错误:', error);
        res.status(500).json({
            success: false,
            message: error.message || '服务器错误'
        });
    }
};
exports.getQuestionsByQuestionSetId = getQuestionsByQuestionSetId;
