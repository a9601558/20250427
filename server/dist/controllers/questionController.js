"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteQuestionSet = exports.updateQuestionSet = exports.createQuestionSet = exports.getQuestionSetById = exports.getAllQuestionSets = void 0;
const QuestionSet_1 = __importDefault(require("../models/QuestionSet"));
const Question_1 = __importDefault(require("../models/Question"));
// @desc    获取所有题库
// @route   GET /api/question-sets
// @access  Public
const getAllQuestionSets = async (req, res) => {
    try {
        const questionSets = await QuestionSet_1.default.findAll({
            include: [{ model: Question_1.default, as: 'questions' }]
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
            include: [{ model: Question_1.default, as: 'questions' }]
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
            include: [{ model: Question_1.default, as: 'questions' }]
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
            include: [{ model: Question_1.default, as: 'questions' }]
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
