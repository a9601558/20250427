"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.uploadQuestionSets = exports.saveProgress = exports.deleteQuestionSet = exports.updateQuestionSet = exports.createQuestionSet = exports.getQuestionSetById = exports.getAllQuestionSets = void 0;
const QuestionSet_1 = __importDefault(require("../models/QuestionSet"));
const User_1 = __importDefault(require("../models/User"));
const db_1 = __importDefault(require("../config/db"));
const Question_1 = __importDefault(require("../models/Question"));
const Option_1 = __importDefault(require("../models/Option"));
const db_2 = require("../config/db");
/**
 * @desc    获取所有题库
 * @route   GET /api/question-sets
 * @access  Public
 */
const getAllQuestionSets = async (req, res) => {
    try {
        // 执行SQL查询
        const [questionSets] = await db_1.default.execute(`
      SELECT 
        qs.id, 
        qs.title, 
        qs.description, 
        qs.category, 
        qs.icon, 
        qs.isPaid, 
        qs.price, 
        qs.trialQuestions,
        COUNT(q.id) AS questionCount
      FROM 
        question_sets qs
      LEFT JOIN 
        questions q ON qs.id = q.questionSetId
      GROUP BY 
        qs.id
      ORDER BY 
        qs.createdAt DESC
    `);
        res.status(200).json({
            success: true,
            data: questionSets
        });
    }
    catch (error) {
        console.error('获取题库列表失败:', error);
        res.status(500).json({
            success: false,
            message: '获取题库列表失败',
            error: error.message
        });
    }
};
exports.getAllQuestionSets = getAllQuestionSets;
/**
 * @desc    获取题库详情（包含问题和选项）
 * @route   GET /api/question-sets/:id
 * @access  Public/Private (部分内容需要购买)
 */
const getQuestionSetById = async (req, res) => {
    var _a;
    const { id } = req.params;
    try {
        // 使用Sequelize的关联查询获取题库及其问题和选项
        const questionSet = await QuestionSet_1.default.findByPk(id, {
            include: [
                {
                    model: Question_1.default,
                    as: 'questions',
                    include: [
                        {
                            model: Option_1.default,
                            as: 'options',
                        }
                    ]
                }
            ]
        });
        if (!questionSet) {
            return res.status(404).json({
                success: false,
                message: '题库不存在'
            });
        }
        // 转换为前端期望的格式并使用类型断言
        const plainData = questionSet.get({ plain: true });
        const result = {
            ...plainData,
            questions: ((_a = plainData.questions) === null || _a === void 0 ? void 0 : _a.map(q => ({
                id: q.id,
                text: q.text,
                explanation: q.explanation,
                questionType: q.questionType,
                orderIndex: q.orderIndex,
                options: q.options.map(o => ({
                    id: o.id,
                    text: o.text,
                    isCorrect: o.isCorrect,
                    optionIndex: o.optionIndex
                }))
            }))) || []
        };
        res.status(200).json({
            success: true,
            data: result
        });
    }
    catch (error) {
        console.error('获取题库详情失败:', error);
        res.status(500).json({
            success: false,
            message: '获取题库详情失败',
            error: error.message
        });
    }
};
exports.getQuestionSetById = getQuestionSetById;
/**
 * @desc    创建题库
 * @route   POST /api/question-sets
 * @access  Admin
 */
const createQuestionSet = async (req, res) => {
    try {
        const { id, title, description, category, icon, isPaid, price, trialQuestions, questions } = req.body;
        // 验证基本信息
        if (!title) {
            return res.status(400).json({
                success: false,
                message: '题库标题不能为空'
            });
        }
        console.log('接收到的创建题库请求:', JSON.stringify({
            id, title, description, category, icon, isPaid,
            questionsCount: Array.isArray(questions) ? questions.length : 0
        }));
        // 使用Sequelize的事务处理
        const result = await db_2.sequelize.transaction(async (t) => {
            // 创建题库
            const questionSet = await QuestionSet_1.default.create({
                id: id, // 使用前端提供的ID或生成新的
                title,
                description,
                category,
                icon: icon || 'book',
                isPaid: isPaid || false,
                price: isPaid ? price : null,
                trialQuestions: isPaid ? trialQuestions : null,
                isFeatured: false
            }, { transaction: t });
            // 如果有问题数据，则创建问题和选项
            if (Array.isArray(questions) && questions.length > 0) {
                console.log(`处理 ${questions.length} 个问题`);
                for (let i = 0; i < questions.length; i++) {
                    const q = questions[i];
                    // 适配前端数据格式，处理question/text字段差异
                    const questionText = q.text || q.question || '';
                    if (!questionText) {
                        console.warn(`问题 ${i + 1} 缺少文本内容，跳过`);
                        continue;
                    }
                    console.log(`创建问题 ${i + 1}: ${questionText.substring(0, 30)}...`);
                    // 创建问题
                    const questionRecord = await Question_1.default.create({
                        text: questionText,
                        explanation: q.explanation || '暂无解析',
                        questionSetId: questionSet.id,
                        questionType: q.questionType || 'single',
                        orderIndex: q.orderIndex !== undefined ? q.orderIndex : i
                    }, { transaction: t });
                    // 如果有选项数据，则创建选项
                    if (Array.isArray(q.options) && q.options.length > 0) {
                        console.log(`处理问题 ${i + 1} 的 ${q.options.length} 个选项`);
                        const optionPromises = q.options.map((opt, j) => {
                            const optionIndex = opt.id || String.fromCharCode(65 + j); // 使用前端提供的ID或生成 A, B, C...
                            // 处理正确答案标记
                            let isCorrect = false;
                            if (q.questionType === 'single' && q.correctAnswer === optionIndex) {
                                isCorrect = true;
                            }
                            else if (q.questionType === 'multiple' && Array.isArray(q.correctAnswer) && q.correctAnswer.includes(optionIndex)) {
                                isCorrect = true;
                            }
                            else if (opt.isCorrect) {
                                isCorrect = true;
                            }
                            console.log(`- 选项 ${optionIndex}: ${opt.text.substring(0, 20)}... 正确: ${isCorrect}`);
                            return Option_1.default.create({
                                questionId: questionRecord.id,
                                text: opt.text,
                                isCorrect: isCorrect,
                                optionIndex: optionIndex
                            }, { transaction: t });
                        });
                        await Promise.all(optionPromises);
                    }
                    else {
                        console.warn(`问题 ${i + 1} 没有选项数据`);
                    }
                }
            }
            // 获取新创建的题库（包含问题和选项）
            const createdQuestionSet = await QuestionSet_1.default.findByPk(questionSet.id, {
                include: [
                    {
                        model: Question_1.default,
                        as: 'questions',
                        include: [{ model: Option_1.default, as: 'options' }]
                    }
                ],
                transaction: t
            });
            return createdQuestionSet;
        });
        res.status(201).json({
            success: true,
            message: '题库创建成功',
            data: result
        });
    }
    catch (error) {
        console.error('创建题库失败:', error);
        res.status(500).json({
            success: false,
            message: '创建题库失败',
            error: error.message
        });
    }
};
exports.createQuestionSet = createQuestionSet;
/**
 * @desc    更新题库
 * @route   PUT /api/question-sets/:id
 * @access  Admin
 */
const updateQuestionSet = async (req, res) => {
    const { id } = req.params;
    const { title, description, category, icon, isPaid, price, trialQuestions, questions, isFeatured, featuredCategory } = req.body;
    try {
        // 使用Sequelize事务
        const result = await db_2.sequelize.transaction(async (t) => {
            // 查找题库
            const questionSet = await QuestionSet_1.default.findByPk(id);
            if (!questionSet) {
                return res.status(404).json({
                    success: false,
                    message: '题库不存在'
                });
            }
            // 更新题库基本信息
            await questionSet.update({
                title: title !== undefined ? title : questionSet.title,
                description: description !== undefined ? description : questionSet.description,
                category: category !== undefined ? category : questionSet.category,
                icon: icon !== undefined ? icon : questionSet.icon,
                isPaid: isPaid !== undefined ? isPaid : questionSet.isPaid,
                price: isPaid && price !== undefined ? price : questionSet.price,
                trialQuestions: isPaid && trialQuestions !== undefined ? trialQuestions : questionSet.trialQuestions,
                isFeatured: isFeatured !== undefined ? isFeatured : questionSet.isFeatured,
                featuredCategory: featuredCategory !== undefined ? featuredCategory : questionSet.featuredCategory
            }, { transaction: t });
            // 如果提供了问题数据，则更新问题
            if (Array.isArray(questions) && questions.length > 0) {
                // 先删除该题库下的所有问题和选项
                await Question_1.default.destroy({
                    where: { questionSetId: id },
                    transaction: t
                });
                // 重新创建问题和选项
                for (let i = 0; i < questions.length; i++) {
                    const q = questions[i];
                    // 创建问题
                    const question = await Question_1.default.create({
                        text: q.text,
                        explanation: q.explanation || '暂无解析',
                        questionSetId: id,
                        questionType: q.questionType || 'single',
                        orderIndex: q.orderIndex !== undefined ? q.orderIndex : i
                    }, { transaction: t });
                    // 创建问题的选项
                    if (Array.isArray(q.options) && q.options.length > 0) {
                        const optionPromises = q.options.map((opt, j) => {
                            const optionIndex = opt.optionIndex || String.fromCharCode(65 + j); // A, B, C...
                            return Option_1.default.create({
                                questionId: question.id,
                                text: opt.text,
                                isCorrect: opt.isCorrect ? true : false,
                                optionIndex: optionIndex
                            }, { transaction: t });
                        });
                        await Promise.all(optionPromises);
                    }
                }
            }
            // 获取更新后的题库（包含问题和选项）
            const updatedQuestionSet = await QuestionSet_1.default.findByPk(id, {
                include: [
                    {
                        model: Question_1.default,
                        as: 'questions',
                        include: [{ model: Option_1.default, as: 'options' }]
                    }
                ],
                transaction: t
            });
            return updatedQuestionSet;
        });
        if (!result) {
            return res.status(404).json({
                success: false,
                message: '题库不存在'
            });
        }
        res.status(200).json({
            success: true,
            message: '题库更新成功',
            data: result
        });
    }
    catch (error) {
        console.error('更新题库失败:', error);
        res.status(500).json({
            success: false,
            message: '更新题库失败',
            error: error.message
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
        const results = [];
        // 使用事务处理批量上传
        for (const setData of questionSets) {
            // 检查题库ID是否已存在
            const existingSet = await QuestionSet_1.default.findByPk(setData.id);
            if (existingSet) {
                // 如果存在则更新
                await existingSet.update({
                    title: setData.title || existingSet.title,
                    description: setData.description || existingSet.description,
                    category: setData.category || existingSet.category,
                    icon: setData.icon || existingSet.icon,
                    isPaid: setData.isPaid !== undefined ? setData.isPaid : existingSet.isPaid,
                    price: setData.isPaid && setData.price !== undefined ? setData.price : undefined,
                    trialQuestions: setData.isPaid && setData.trialQuestions !== undefined ? setData.trialQuestions : undefined
                });
                // 如果提供了题目，并且题目数组不为空，则更新题目
                if (Array.isArray(setData.questions) && setData.questions.length > 0) {
                    console.log(`更新题库 ${setData.id} 的题目，数量: ${setData.questions.length}`);
                    // 先删除所有旧题目
                    await Question_1.default.destroy({
                        where: { questionSetId: setData.id }
                    });
                    // 添加新题目
                    for (let i = 0; i < setData.questions.length; i++) {
                        const q = setData.questions[i];
                        // 创建问题
                        const question = await Question_1.default.create({
                            id: q.id || undefined, // 如果未提供ID，让Sequelize生成
                            text: q.text,
                            explanation: q.explanation,
                            questionSetId: setData.id,
                            questionType: q.questionType || 'single',
                            orderIndex: q.orderIndex !== undefined ? q.orderIndex : i
                        });
                        // 创建问题的选项
                        if (q.options && q.options.length > 0) {
                            // 这里需要定义Option模型，或者使用原生SQL
                            // 示例: 使用原生SQL插入选项
                            for (const option of q.options) {
                                await db_1.default.execute(`
                  INSERT INTO options (id, question_id, text, is_correct)
                  VALUES (UUID(), ?, ?, ?)
                `, [question.id, option.text, option.isCorrect ? 1 : 0]);
                            }
                        }
                    }
                }
                else {
                    // 如果没有提供题目或提供了空数组，不做任何修改
                    console.log(`题库 ${setData.id} 的题目未提供或为空，保留原题目`);
                }
                results.push({
                    id: setData.id,
                    status: 'updated',
                    message: '题库更新成功'
                });
            }
            else {
                // 如果不存在则创建
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
                        // 创建问题
                        const question = await Question_1.default.create({
                            id: q.id || undefined, // 如果未提供ID，让Sequelize生成
                            text: q.text,
                            explanation: q.explanation,
                            questionSetId: setData.id,
                            questionType: q.questionType || 'single',
                            orderIndex: q.orderIndex !== undefined ? q.orderIndex : i
                        });
                        // 创建问题的选项
                        if (q.options && q.options.length > 0) {
                            // 这里需要定义Option模型，或者使用原生SQL
                            // 示例: 使用原生SQL插入选项
                            for (const option of q.options) {
                                await db_1.default.execute(`
                  INSERT INTO options (id, question_id, text, is_correct)
                  VALUES (UUID(), ?, ?, ?)
                `, [question.id, option.text, option.isCorrect ? 1 : 0]);
                            }
                        }
                    }
                }
                results.push({
                    id: setData.id,
                    status: 'created',
                    message: '题库创建成功'
                });
            }
        }
        res.status(201).json({
            success: true,
            data: results,
            message: '题库上传成功'
        });
    }
    catch (error) {
        console.error('批量上传题库错误:', error);
        res.status(500).json({
            success: false,
            message: error.message || '服务器错误'
        });
    }
};
exports.uploadQuestionSets = uploadQuestionSets;
