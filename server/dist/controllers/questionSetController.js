"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.saveProgress = exports.deleteQuestionSet = exports.updateQuestionSet = exports.createQuestionSet = exports.getQuestionSetById = exports.getQuestionSets = void 0;
const QuestionSet_1 = __importDefault(require("../models/QuestionSet"));
const User_1 = __importDefault(require("../models/User"));
// @desc    Get all question sets
// @route   GET /api/question-sets
// @access  Public
const getQuestionSets = async (req, res) => {
    try {
        // Fetch all question sets
        const questionSets = await QuestionSet_1.default.findAll();
        res.json({
            success: true,
            data: questionSets
        });
    }
    catch (error) {
        console.error('Get question sets error:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Server error'
        });
    }
};
exports.getQuestionSets = getQuestionSets;
// @desc    Get question set by ID
// @route   GET /api/question-sets/:id
// @access  Public
const getQuestionSetById = async (req, res) => {
    try {
        const questionSet = await QuestionSet_1.default.findByPk(req.params.id);
        if (questionSet) {
            res.json({
                success: true,
                data: questionSet
            });
        }
        else {
            res.status(404).json({
                success: false,
                message: 'Question set not found'
            });
        }
    }
    catch (error) {
        console.error('Get question set by ID error:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Server error'
        });
    }
};
exports.getQuestionSetById = getQuestionSetById;
// @desc    Create a question set
// @route   POST /api/question-sets
// @access  Private/Admin
const createQuestionSet = async (req, res) => {
    try {
        const { title, description, category, icon, isPaid, price, trialQuestions } = req.body;
        const createdQuestionSet = await QuestionSet_1.default.create({
            title,
            description,
            category,
            icon,
            isPaid: isPaid || false,
            price: isPaid ? price : 0,
            trialQuestions: trialQuestions || 0
        });
        res.status(201).json({
            success: true,
            data: createdQuestionSet
        });
    }
    catch (error) {
        console.error('Create question set error:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Server error'
        });
    }
};
exports.createQuestionSet = createQuestionSet;
// @desc    Update a question set
// @route   PUT /api/question-sets/:id
// @access  Private/Admin
const updateQuestionSet = async (req, res) => {
    try {
        const { title, description, category, icon, isPaid, price, trialQuestions } = req.body;
        const questionSet = await QuestionSet_1.default.findByPk(req.params.id);
        if (questionSet) {
            // 使用 Sequelize 的 update 方法
            await questionSet.update({
                title: title || questionSet.title,
                description: description || questionSet.description,
                category: category || questionSet.category,
                icon: icon || questionSet.icon,
                isPaid: isPaid !== undefined ? isPaid : questionSet.isPaid,
                price: isPaid ? (price || questionSet.price) : 0,
                trialQuestions: trialQuestions !== undefined ? trialQuestions : questionSet.trialQuestions
            });
            // 重新获取更新后的数据
            const updatedQuestionSet = await QuestionSet_1.default.findByPk(req.params.id);
            res.json({
                success: true,
                data: updatedQuestionSet
            });
        }
        else {
            res.status(404).json({
                success: false,
                message: 'Question set not found'
            });
        }
    }
    catch (error) {
        console.error('Update question set error:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Server error'
        });
    }
};
exports.updateQuestionSet = updateQuestionSet;
// @desc    Delete a question set
// @route   DELETE /api/question-sets/:id
// @access  Private/Admin
const deleteQuestionSet = async (req, res) => {
    try {
        const questionSet = await QuestionSet_1.default.findByPk(req.params.id);
        if (questionSet) {
            await questionSet.destroy();
            // TODO: Also clean up any redeem codes or purchases referencing this question set
            res.json({
                success: true,
                message: 'Question set removed'
            });
        }
        else {
            res.status(404).json({
                success: false,
                message: 'Question set not found'
            });
        }
    }
    catch (error) {
        console.error('Delete question set error:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Server error'
        });
    }
};
exports.deleteQuestionSet = deleteQuestionSet;
// @desc    Save user progress on a question set
// @route   POST /api/question-sets/:id/progress
// @access  Private
const saveProgress = async (req, res) => {
    try {
        const { completedQuestions, totalQuestions, correctAnswers } = req.body;
        const user = await User_1.default.findByPk(req.user.id);
        const questionSetId = req.params.id;
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }
        // Update or create progress record
        if (!user.progress) {
            user.progress = {};
        }
        user.progress[questionSetId] = {
            completedQuestions,
            totalQuestions,
            correctAnswers,
            lastAccessed: new Date()
        };
        await user.save();
        res.json({
            success: true,
            message: 'Progress saved',
            data: user.progress[questionSetId]
        });
    }
    catch (error) {
        console.error('Save progress error:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Server error'
        });
    }
};
exports.saveProgress = saveProgress;
