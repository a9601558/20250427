"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.addQuestionToQuestionSet = exports.getQuestionSetsByCategory = exports.getQuestionSetCategories = exports.uploadQuestionSets = exports.setFeaturedQuestionSet = exports.getFeaturedQuestionSets = exports.getAllCategories = exports.deleteQuestionSet = exports.updateQuestionSet = exports.createQuestionSet = exports.getQuestionSetById = exports.getAllQuestionSets = void 0;
const QuestionSet_1 = __importDefault(require("../models/QuestionSet"));
const database_1 = __importDefault(require("../config/database"));
const Question_1 = __importDefault(require("../models/Question"));
const Option_1 = __importDefault(require("../models/Option"));
const sequelize_1 = require("sequelize");
const uuid_1 = require("uuid");
const applyFieldMappings_1 = require("../utils/applyFieldMappings");
// 统一响应格式
const sendResponse = (res, status, data, message) => {
    res.status(status).json({
        success: status >= 200 && status < 300,
        data,
        message
    });
};
// 统一错误响应
const sendError = (res, status, message, error) => {
    res.status(status).json({
        success: false,
        message,
        error: process.env.NODE_ENV === 'development' ? error?.message : undefined
    });
};
// @desc    Get all question sets
// @route   GET /api/v1/question-sets
// @access  Public
const getAllQuestionSets = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const offset = (page - 1) * limit;
        const questionSets = await QuestionSet_1.default.findAll({
            ...(0, applyFieldMappings_1.withQuestionSetAttributes)({
                order: [['createdAt', 'DESC']],
                limit,
                offset
            }),
            include: [{
                    model: Question_1.default,
                    as: 'questions',
                    attributes: ['id'] // 只拿 id 就够用
                }]
        });
        const total = await QuestionSet_1.default.count();
        // 添加 questionCount 字段
        const result = questionSets.map(set => ({
            ...set.toJSON(),
            questionCount: set.questions?.length || 0
        }));
        res.status(200).json({
            success: true,
            data: result,
            pagination: {
                total,
                page,
                limit,
                pages: Math.ceil(total / limit)
            }
        });
    }
    catch (error) {
        console.error('获取题集列表失败:', error);
        res.status(500).json({
            success: false,
            message: '获取题库列表失败',
            error: error.message
        });
    }
};
exports.getAllQuestionSets = getAllQuestionSets;
// @desc    Get question set by ID
// @route   GET /api/v1/question-sets/:id
// @access  Public
const getQuestionSetById = async (req, res) => {
    try {
        console.log(`尝试获取题库，ID: ${req.params.id}`);
        const questionSet = await QuestionSet_1.default.findByPk(req.params.id, {
            include: [{
                    model: Question_1.default,
                    as: 'questions',
                    include: [{
                            model: Option_1.default,
                            as: 'options'
                        }]
                }]
        });
        if (!questionSet) {
            console.log(`未找到题库，ID: ${req.params.id}`);
            return sendError(res, 404, '题库不存在');
        }
        console.log(`题库获取成功，ID: ${questionSet.id}，包含 ${questionSet.questions?.length || 0} 个问题`);
        sendResponse(res, 200, questionSet);
    }
    catch (error) {
        console.error('Get question set error:', error);
        sendError(res, 500, '获取题库详情失败', error);
    }
};
exports.getQuestionSetById = getQuestionSetById;
// @desc    Create question set
// @route   POST /api/v1/question-sets
// @access  Private/Admin
const createQuestionSet = async (req, res) => {
    try {
        const { title, description, category, isFeatured, featuredCategory, isPaid, price, trialQuestions } = req.body;
        // 验证必填字段
        if (!title || !description || !category) {
            return sendError(res, 400, '请提供标题、描述和分类');
        }
        // 如果是付费题库，验证价格
        if (isPaid && (price === undefined || price <= 0)) {
            return sendError(res, 400, '付费题库必须设置有效的价格');
        }
        const questionSet = await QuestionSet_1.default.create({
            title,
            description,
            category,
            icon: 'default',
            isPaid: isPaid || false,
            price: isPaid ? price : null,
            trialQuestions: isPaid ? trialQuestions : null,
            isFeatured: isFeatured || false,
            featuredCategory
        });
        sendResponse(res, 201, questionSet, '题库创建成功');
    }
    catch (error) {
        console.error('Create question set error:', error);
        sendError(res, 500, '创建题库失败', error);
    }
};
exports.createQuestionSet = createQuestionSet;
// @desc    Update question set
// @route   PUT /api/v1/question-sets/:id
// @access  Private/Admin
const updateQuestionSet = async (req, res) => {
    try {
        const questionSet = await QuestionSet_1.default.findByPk(req.params.id);
        if (questionSet) {
            const { title, description, category, isFeatured, featuredCategory, isPaid, price, trialQuestions } = req.body;
            // 如果是付费题库，验证价格
            if (isPaid && (price === undefined || price <= 0)) {
                return sendError(res, 400, '付费题库必须设置有效的价格');
            }
            questionSet.title = title || questionSet.title;
            questionSet.description = description || questionSet.description;
            questionSet.category = category || questionSet.category;
            // 更新付费相关字段
            if (isPaid !== undefined) {
                questionSet.isPaid = isPaid;
                if (isPaid) {
                    questionSet.price = price !== undefined ? price : questionSet.price;
                    questionSet.trialQuestions = trialQuestions !== undefined ? trialQuestions : questionSet.trialQuestions;
                }
                else {
                    questionSet.price = undefined;
                    questionSet.trialQuestions = undefined;
                }
            }
            questionSet.isFeatured = isFeatured !== undefined ? isFeatured : questionSet.isFeatured;
            questionSet.featuredCategory = featuredCategory !== undefined ? featuredCategory : questionSet.featuredCategory;
            const updatedQuestionSet = await questionSet.save();
            sendResponse(res, 200, updatedQuestionSet, '题库更新成功');
        }
        else {
            sendError(res, 404, '题库不存在');
        }
    }
    catch (error) {
        console.error('Update question set error:', error);
        sendError(res, 500, '更新题库失败', error);
    }
};
exports.updateQuestionSet = updateQuestionSet;
// @desc    Delete question set
// @route   DELETE /api/v1/question-sets/:id
// @access  Private/Admin
const deleteQuestionSet = async (req, res) => {
    try {
        const questionSet = await QuestionSet_1.default.findByPk(req.params.id);
        if (questionSet) {
            await questionSet.destroy();
            sendResponse(res, 200, null, '题库删除成功');
        }
        else {
            sendError(res, 404, '题库不存在');
        }
    }
    catch (error) {
        console.error('Delete question set error:', error);
        sendError(res, 500, '删除题库失败', error);
    }
};
exports.deleteQuestionSet = deleteQuestionSet;
// @desc    Get all categories
// @route   GET /api/v1/question-sets/categories
// @access  Public
const getAllCategories = async (req, res) => {
    try {
        const categories = await QuestionSet_1.default.findAll({
            attributes: ['category'],
            group: ['category']
        });
        const categoryList = categories.map(row => row.category);
        sendResponse(res, 200, categoryList);
    }
    catch (error) {
        console.error('获取题库分类列表失败:', error);
        sendError(res, 500, '获取题库分类列表失败', error);
    }
};
exports.getAllCategories = getAllCategories;
// @desc    Get featured question sets
// @route   GET /api/v1/question-sets/featured
// @access  Public
const getFeaturedQuestionSets = async (req, res) => {
    try {
        const questionSets = await QuestionSet_1.default.findAll((0, applyFieldMappings_1.withQuestionSetAttributes)({
            where: {
                isFeatured: true
            }
        }));
        res.status(200).json({
            success: true,
            data: questionSets
        });
    }
    catch (error) {
        console.error('获取推荐题集失败:', error);
        res.status(500).json({
            success: false,
            message: '获取推荐题集失败',
            error: error.message
        });
    }
};
exports.getFeaturedQuestionSets = getFeaturedQuestionSets;
// @desc    Set question set as featured
// @route   PUT /api/v1/question-sets/:id/featured
// @access  Private/Admin
const setFeaturedQuestionSet = async (req, res) => {
    try {
        const questionSet = await QuestionSet_1.default.findByPk(req.params.id);
        if (questionSet) {
            const { isFeatured, featuredCategory } = req.body;
            questionSet.isFeatured = isFeatured;
            questionSet.featuredCategory = featuredCategory;
            const updatedQuestionSet = await questionSet.save();
            sendResponse(res, 200, updatedQuestionSet, '精选题库设置成功');
        }
        else {
            sendError(res, 404, '题库不存在');
        }
    }
    catch (error) {
        console.error('Set featured question set error:', error);
        sendError(res, 500, '设置精选题库失败', error);
    }
};
exports.setFeaturedQuestionSet = setFeaturedQuestionSet;
/**
 * @desc    批量上传题库和题目
 * @route   POST /api/question-sets/upload
 * @access  Private/Admin
 */
const uploadQuestionSets = async (req, res) => {
    try {
        const { questionSets } = req.body;
        if (!questionSets || !Array.isArray(questionSets) || questionSets.length === 0) {
            return res.status(400).json({
                success: false,
                message: '请提供有效的题库数据'
            });
        }
        console.log(`接收到 ${questionSets.length} 个题库的批量上传请求`);
        const results = [];
        // 使用事务处理批量上传
        for (const setData of questionSets) {
            // 检查题库ID是否已存在
            const existingSet = await QuestionSet_1.default.findByPk(setData.id);
            let questionsAdded = 0;
            let questionsUpdated = 0;
            if (existingSet) {
                // 如果存在则更新
                console.log(`正在更新题库 ${setData.id}: ${setData.title}`);
                await existingSet.update({
                    title: setData.title || existingSet.title,
                    description: setData.description || existingSet.description,
                    category: setData.category || existingSet.category,
                    icon: setData.icon || existingSet.icon,
                    isPaid: setData.isPaid !== undefined ? setData.isPaid : existingSet.isPaid,
                    price: setData.isPaid && setData.price !== undefined ? setData.price : undefined,
                    trialQuestions: setData.isPaid && setData.trialQuestions !== undefined ? setData.trialQuestions : undefined
                });
                // 如果提供了题目，则更新题目
                if (Array.isArray(setData.questions) && setData.questions.length > 0) {
                    console.log(`处理题库 ${setData.id} 的题目，数量: ${setData.questions.length}`);
                    // 分类出有ID和无ID的题目
                    const questionsWithId = setData.questions.filter(q => q.id);
                    const questionsWithoutId = setData.questions.filter(q => !q.id);
                    console.log(`题库 ${setData.id}: 有ID的题目: ${questionsWithId.length}, 无ID的题目（新增）: ${questionsWithoutId.length}`);
                    // 获取当前题库的所有题目ID，用于检查哪些需要保留
                    const existingQuestions = await Question_1.default.findAll({
                        where: { questionSetId: setData.id },
                        attributes: ['id']
                    });
                    const existingIds = existingQuestions.map(q => q.id);
                    const idsToKeep = questionsWithId.map(q => q.id);
                    // 删除不在更新列表中的题目
                    const idsToDelete = existingIds.filter(id => !idsToKeep.includes(id));
                    if (idsToDelete.length > 0) {
                        console.log(`将删除题库 ${setData.id} 中的 ${idsToDelete.length} 个题目`);
                        await Question_1.default.destroy({
                            where: {
                                id: idsToDelete,
                                questionSetId: setData.id
                            }
                        });
                    }
                    // 更新有ID的题目
                    for (const q of questionsWithId) {
                        const existingQuestion = await Question_1.default.findOne({
                            where: { id: q.id, questionSetId: setData.id }
                        });
                        if (existingQuestion) {
                            // 更新现有题目
                            console.log(`更新题目 ${q.id}: ${q.text?.substring(0, 30)}...`);
                            await existingQuestion.update({
                                text: q.text || '',
                                explanation: q.explanation || '',
                                questionType: q.questionType || 'single',
                                orderIndex: q.orderIndex !== undefined ? q.orderIndex : existingQuestion.orderIndex
                            });
                            // 更新选项
                            if (q.options && q.options.length > 0) {
                                // 先删除现有选项
                                await Option_1.default.destroy({
                                    where: { questionId: q.id }
                                });
                                // 创建新选项
                                for (const option of q.options) {
                                    await Option_1.default.create({
                                        questionId: q.id, // 使用非空断言，因为在这个上下文中我们已经确认q.id存在
                                        text: option.text || '',
                                        isCorrect: option.isCorrect,
                                        optionIndex: option.optionIndex || option.id || ''
                                    });
                                }
                            }
                            questionsUpdated++;
                        }
                        else {
                            // ID存在但题目不存在，创建新题目
                            console.log(`创建指定ID的题目 ${q.id}: ${q.text?.substring(0, 30)}...`);
                            const newQuestion = await Question_1.default.create({
                                id: q.id,
                                text: q.text,
                                explanation: q.explanation,
                                questionSetId: setData.id,
                                questionType: q.questionType || 'single',
                                orderIndex: q.orderIndex !== undefined ? q.orderIndex : 0
                            });
                            // 创建选项
                            if (q.options && q.options.length > 0) {
                                for (const option of q.options) {
                                    await Option_1.default.create({
                                        questionId: newQuestion.id,
                                        text: option.text || '',
                                        isCorrect: option.isCorrect,
                                        optionIndex: option.optionIndex || option.id || ''
                                    });
                                }
                            }
                            questionsAdded++;
                        }
                    }
                    // 创建没有ID的新题目
                    for (let i = 0; i < questionsWithoutId.length; i++) {
                        const q = questionsWithoutId[i];
                        console.log(`创建新题目 ${i + 1}: ${q.text?.substring(0, 30)}...`);
                        const newQuestion = await Question_1.default.create({
                            text: q.text,
                            explanation: q.explanation,
                            questionSetId: setData.id,
                            questionType: q.questionType || 'single',
                            orderIndex: q.orderIndex !== undefined ? q.orderIndex : i
                        });
                        // 创建选项
                        if (q.options && q.options.length > 0) {
                            for (const option of q.options) {
                                await Option_1.default.create({
                                    questionId: newQuestion.id,
                                    text: option.text || '',
                                    isCorrect: option.isCorrect,
                                    optionIndex: option.optionIndex || option.id || ''
                                });
                            }
                        }
                        questionsAdded++;
                    }
                }
                results.push({
                    id: setData.id,
                    status: 'updated',
                    message: '题库更新成功',
                    questions: {
                        added: questionsAdded,
                        updated: questionsUpdated
                    }
                });
            }
            else {
                // 如果不存在则创建
                console.log(`创建新题库 ${setData.id}: ${setData.title}`);
                const newQuestionSet = await QuestionSet_1.default.create({
                    id: setData.id,
                    title: setData.title,
                    description: setData.description,
                    category: setData.category,
                    icon: setData.icon,
                    isPaid: setData.isPaid || false,
                    price: setData.isPaid && setData.price !== undefined ? setData.price : 0,
                    trialQuestions: setData.isPaid && setData.trialQuestions !== undefined ? setData.trialQuestions : 0
                });
                // 如果提供了题目，则创建题目
                if (setData.questions && setData.questions.length > 0) {
                    for (let i = 0; i < setData.questions.length; i++) {
                        const q = setData.questions[i];
                        console.log(`创建新题库的题目 ${i + 1}: ${q.text?.substring(0, 30)}...`);
                        // 创建问题
                        const questionObj = {
                            questionSetId: setData.id,
                            text: q.text,
                            explanation: q.explanation,
                            questionType: q.questionType || 'single',
                            orderIndex: q.orderIndex !== undefined ? q.orderIndex : i
                        };
                        // 创建题目
                        let question;
                        try {
                            question = await Question_1.default.create(questionObj);
                            console.log('题目创建成功，ID:', question.id);
                        }
                        catch (error) {
                            console.error('题目创建失败:', error);
                            const errorMessage = error instanceof Error ? error.message : '未知错误';
                            throw new Error(`题目创建失败: ${errorMessage}`);
                        }
                        // 创建问题的选项
                        if (q.options && q.options.length > 0) {
                            for (const option of q.options) {
                                await Option_1.default.create({
                                    questionId: question.id,
                                    text: option.text || '',
                                    isCorrect: option.isCorrect,
                                    optionIndex: option.optionIndex || option.id || ''
                                });
                            }
                        }
                        questionsAdded++;
                    }
                }
                results.push({
                    id: setData.id,
                    status: 'created',
                    message: '题库创建成功',
                    questions: {
                        added: questionsAdded,
                        updated: 0
                    }
                });
            }
        }
        sendResponse(res, 201, results, '题库上传成功');
    }
    catch (error) {
        console.error('批量上传题库错误:', error);
        sendError(res, 500, error.message || '服务器错误', error);
    }
};
exports.uploadQuestionSets = uploadQuestionSets;
/**
 * @desc    获取所有题库分类
 * @route   GET /api/question-sets/categories
 * @access  Public
 */
const getQuestionSetCategories = async (req, res) => {
    try {
        const categories = await QuestionSet_1.default.findAll({
            attributes: ['category'],
            group: ['category'],
            order: [['category', 'ASC']]
        });
        const categoryList = categories.map(row => row.category);
        sendResponse(res, 200, categoryList);
    }
    catch (error) {
        console.error('获取题库分类列表失败:', error);
        sendError(res, 500, '获取题库分类列表失败', error);
    }
};
exports.getQuestionSetCategories = getQuestionSetCategories;
/**
 * @desc    按分类获取题库
 * @route   GET /api/question-sets/by-category/:category
 * @access  Public
 */
const getQuestionSetsByCategory = async (req, res) => {
    const { category } = req.params;
    try {
        // 记录日志，但不再显式调用关联设置
        console.log(`尝试获取分类题库，分类: ${category}`);
        const decodedCategory = decodeURIComponent(category);
        try {
            // 使用原始 SQL 查询获取分类题库
            const [questionSets] = await database_1.default.query(`SELECT * FROM question_sets WHERE category = ? ORDER BY createdAt DESC`, {
                replacements: [decodedCategory],
                type: sequelize_1.QueryTypes.SELECT
            });
            const formattedQuestionSets = [];
            if (Array.isArray(questionSets)) {
                for (const set of questionSets) {
                    // 获取题目数量
                    const [questions] = await database_1.default.query(`SELECT * FROM questions WHERE questionSetId = ?`, {
                        replacements: [set.id],
                        type: sequelize_1.QueryTypes.SELECT
                    });
                    const questionsArray = Array.isArray(questions) ? questions : [questions].filter(Boolean);
                    // 为每个题目获取选项
                    const questionsWithOptions = [];
                    for (const question of questionsArray) {
                        if (question && question.id) {
                            const [options] = await database_1.default.query(`SELECT * FROM options WHERE questionId = ?`, {
                                replacements: [question.id],
                                type: sequelize_1.QueryTypes.SELECT
                            });
                            questionsWithOptions.push({
                                ...question,
                                options: Array.isArray(options) ? options : [options].filter(Boolean)
                            });
                        }
                    }
                    formattedQuestionSets.push({
                        ...set,
                        questionCount: questionsArray.length,
                        questions: questionsWithOptions
                    });
                }
            }
            sendResponse(res, 200, formattedQuestionSets);
        }
        catch (sqlError) {
            console.error('SQL查询错误:', sqlError);
            sendError(res, 500, '获取分类题库SQL查询错误', sqlError);
        }
    }
    catch (error) {
        console.error('获取分类题库失败:', error);
        sendError(res, 500, '获取分类题库失败', error);
    }
};
exports.getQuestionSetsByCategory = getQuestionSetsByCategory;
// @desc    Add a question to a question set
// @route   POST /api/v1/question-sets/:id/questions
// @access  Private/Admin
const addQuestionToQuestionSet = async (req, res) => {
    try {
        // 记录日志，但不再显式调用关联设置
        console.log(`尝试向题库添加题目，题库ID: ${req.params.id}`);
        const { id } = req.params;
        const questionData = req.body;
        // 验证必要的字段
        if (!questionData.text) {
            return sendError(res, 400, '题目文本是必填项');
        }
        if (!Array.isArray(questionData.options) || questionData.options.length === 0) {
            return sendError(res, 400, '题目至少需要包含一个选项');
        }
        // 查找题库
        const questionSet = await QuestionSet_1.default.findByPk(id);
        if (!questionSet) {
            return sendError(res, 404, '题库不存在');
        }
        // 生成一个基于时间的UUID (v1)
        const questionId = (0, uuid_1.v1)();
        console.log('生成基于时间的UUID:', questionId);
        // 创建题目对象
        const questionObj = {
            id: questionId,
            questionSetId: id,
            text: questionData.text,
            explanation: questionData.explanation || '',
            questionType: questionData.questionType || 'single',
            orderIndex: questionData.orderIndex || 0
        };
        console.log('准备创建题目:', JSON.stringify(questionObj, null, 2));
        // 创建题目
        let question;
        try {
            // 直接使用原始SQL插入确保ID被正确设置
            const result = await database_1.default.query(`INSERT INTO questions (id, questionSetId, text, explanation, questionType, orderIndex, createdAt, updatedAt) 
         VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())`, {
                replacements: [
                    questionId,
                    id,
                    questionData.text,
                    questionData.explanation || '',
                    questionData.questionType || 'single',
                    questionData.orderIndex || 0
                ],
                type: sequelize_1.QueryTypes.INSERT
            });
            console.log('SQL插入结果:', result);
            // 再次查询确认题目已创建
            question = await Question_1.default.findByPk(questionId);
            if (!question) {
                throw new Error(`题目插入成功但无法检索，ID: ${questionId}`);
            }
            console.log('题目创建成功，ID:', question.id);
        }
        catch (error) {
            console.error('题目创建SQL错误:', error);
            return sendError(res, 500, `创建题目SQL错误: ${error.message}`, error);
        }
        // 创建选项
        const createdOptions = [];
        try {
            for (let i = 0; i < questionData.options.length; i++) {
                const option = questionData.options[i];
                const optionIndex = option.optionIndex || String.fromCharCode(65 + i); // A, B, C...
                // 生成选项ID
                const optionId = (0, uuid_1.v1)();
                // 使用原始SQL插入选项
                await database_1.default.query(`INSERT INTO options (id, questionId, text, isCorrect, optionIndex, createdAt, updatedAt)
           VALUES (?, ?, ?, ?, ?, NOW(), NOW())`, {
                    replacements: [
                        optionId,
                        questionId,
                        option.text || '',
                        option.isCorrect ? 1 : 0,
                        optionIndex
                    ],
                    type: sequelize_1.QueryTypes.INSERT
                });
                console.log(`选项 ${optionIndex} 创建成功, ID: ${optionId}`);
                createdOptions.push({
                    id: optionId,
                    questionId,
                    text: option.text || '',
                    isCorrect: !!option.isCorrect,
                    optionIndex
                });
            }
        }
        catch (error) {
            console.error('创建选项错误:', error);
            // 如果创建选项失败，删除已创建的题目
            if (question) {
                await database_1.default.query(`DELETE FROM questions WHERE id = ?`, {
                    replacements: [questionId],
                    type: sequelize_1.QueryTypes.DELETE
                });
            }
            return sendError(res, 500, `创建选项失败: ${error.message}`, error);
        }
        if (createdOptions.length === 0) {
            // 如果没有创建任何选项，删除题目
            await database_1.default.query(`DELETE FROM questions WHERE id = ?`, {
                replacements: [questionId],
                type: sequelize_1.QueryTypes.DELETE
            });
            return sendError(res, 500, '未能创建任何选项');
        }
        // 获取完整的题目和选项
        try {
            const completeQuestion = await Question_1.default.findByPk(questionId, {
                include: [{
                        model: Option_1.default,
                        as: 'options'
                    }]
            });
            if (!completeQuestion) {
                throw new Error(`无法检索完整题目，ID: ${questionId}`);
            }
            // 不尝试直接访问options属性，直接使用简单日志
            console.log('成功检索完整题目:', {
                id: completeQuestion.id,
                text: completeQuestion.text
            });
            return sendResponse(res, 201, completeQuestion, '题目添加成功');
        }
        catch (error) {
            console.error('检索完整题目错误:', error);
            return sendError(res, 500, `检索完整题目失败: ${error.message}`, error);
        }
    }
    catch (error) {
        console.error('添加题目整体错误:', error);
        return sendError(res, 500, `添加题目失败: ${error.message}`, error);
    }
};
exports.addQuestionToQuestionSet = addQuestionToQuestionSet;
