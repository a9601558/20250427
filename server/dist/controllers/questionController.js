"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.batchUploadQuestions = exports.getQuestionCount = exports.getRandomQuestion = exports.deleteQuestion = exports.updateQuestion = exports.createQuestion = exports.getQuestionById = exports.getQuestions = void 0;
const Question_1 = __importDefault(require("../models/Question"));
const responseUtils_1 = require("../utils/responseUtils");
const Option_1 = __importDefault(require("../models/Option"));
const sequelize_1 = require("sequelize");
const database_1 = __importDefault(require("../config/database"));
const uuid_1 = require("uuid");
/**
 * @route GET /api/v1/questions
 * @access Public
 */
const getQuestions = async (req, res) => {
    try {
        const { questionSetId, page = 1, limit = 10, include } = req.query;
        const offset = (Number(page) - 1) * Number(limit);
        const where = questionSetId ? { questionSetId: String(questionSetId) } : {};
        const includeOptions = include === 'options' ? [{
                model: Option_1.default,
                as: 'options',
                attributes: ['id', 'text', 'isCorrect', 'optionIndex']
            }] : [];
        const { count, rows: questions } = await Question_1.default.findAndCountAll({
            where,
            include: includeOptions,
            limit: Number(limit),
            offset,
            order: [['orderIndex', 'ASC']]
        });
        console.log(`Found ${questions.length} questions with options: ${include === 'options' ? 'yes' : 'no'}`);
        if (questions.length > 0 && include === 'options') {
            console.log(`First question options count: ${questions[0].options?.length || 0}`);
        }
        // Return response in the format expected by the frontend
        res.status(200).json({
            success: true,
            data: questions
        });
    }
    catch (error) {
        console.error('获取问题列表失败:', error);
        res.status(500).json({
            success: false,
            message: '获取问题列表失败',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
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
// @desc    Get count of questions for a question set
// @route   GET /api/questions/count/:questionSetId
// @access  Public
const getQuestionCount = async (req, res) => {
    try {
        console.log('[API] Received request for question count:', req.params);
        const { questionSetId } = req.params;
        // 验证参数
        if (!questionSetId) {
            console.log('[API] Missing questionSetId in request params');
            return res.status(400).json({
                success: false,
                message: '题库ID不能为空',
                count: 0
            });
        }
        // 使用原生SQL查询以确保准确性
        const [result] = await database_1.default.query('SELECT COUNT(*) as count FROM questions WHERE questionSetId = :questionSetId', {
            replacements: { questionSetId },
            type: sequelize_1.QueryTypes.SELECT
        });
        // 解析结果，确保返回有效的数字
        let count = 0;
        if (result && typeof result.count !== 'undefined') {
            count = parseInt(result.count, 10);
        }
        console.log(`[API] Question count for questionSetId=${questionSetId}: ${count}`);
        // 返回标准格式的响应
        return res.status(200).json({
            success: true,
            count,
            message: '获取题目数量成功'
        });
    }
    catch (error) {
        console.error('[API] Error getting question count:', error);
        // 确保返回一个有效的响应，即使发生错误
        return res.status(500).json({
            success: false,
            count: 0,
            message: '获取题目数量失败',
            error: error.message
        });
    }
};
exports.getQuestionCount = getQuestionCount;
// @desc    Batch upload questions for a question set
// @route   POST /api/questions/batch-upload/:questionSetId
// @access  Admin
const batchUploadQuestions = async (req, res) => {
    try {
        console.log(`[API] Received batch upload request for question set`);
        console.log(`[API] Request params:`, req.params);
        console.log(`[API] Request has file:`, !!req.file);
        const { questionSetId } = req.params;
        // 验证参数
        if (!questionSetId) {
            console.log(`[API] Missing questionSetId in request params`);
            return res.status(400).json({
                success: false,
                message: '题库ID不能为空'
            });
        }
        console.log(`[API] 使用题库ID: ${questionSetId}`);
        // 检查题库是否存在
        const QuestionSet = database_1.default.models.QuestionSet;
        if (QuestionSet) {
            try {
                const questionSet = await QuestionSet.findByPk(questionSetId);
                if (!questionSet) {
                    console.log(`[API] QuestionSet not found with ID: ${questionSetId}`);
                    return res.status(404).json({
                        success: false,
                        message: '题库不存在'
                    });
                }
                console.log(`[API] 确认题库存在: ${questionSetId}`);
            }
            catch (error) {
                console.error('[API] Error checking QuestionSet:', error);
                return res.status(500).json({
                    success: false,
                    message: '检查题库失败',
                    error: error.message
                });
            }
        }
        else {
            console.log(`[API] 警告: 无法获取QuestionSet模型，跳过题库存在性验证`);
        }
        // 检查上传的文件 - 使用multer中间件处理后的req.file
        if (!req.file) {
            console.log(`[API] No file uploaded in request`);
            return res.status(400).json({
                success: false,
                message: '没有上传文件'
            });
        }
        console.log(`[API] Received file: ${req.file.originalname} size: ${req.file.size}`);
        // 读取文件内容
        const fs = require('fs');
        const path = require('path');
        const fileContent = fs.readFileSync(req.file.path, 'utf8');
        // 解析文件内容 - 假设是按行分隔的文本文件
        const lines = fileContent.split('\n').filter((line) => line.trim() !== '');
        console.log(`[API] 解析到 ${lines.length} 行数据`);
        // 导入成功的问题数量
        let successCount = 0;
        // 导入失败的问题数量
        let failedCount = 0;
        // 错误信息数组
        const errors = [];
        // 成功创建的问题ID集合
        const createdQuestionIds = [];
        // 处理每一行数据
        for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
            const line = lines[lineIndex];
            let transaction = null;
            let currentQuestionId = '';
            try {
                console.log(`[API] 处理第 ${lineIndex + 1} 行数据`);
                // 开启一个新事务
                transaction = await database_1.default.transaction();
                // 分割数据字段，使用|作为分隔符
                const fields = line.split('|').map((field) => field.trim());
                if (fields.length < 3) {
                    failedCount++;
                    errors.push(`行 ${lineIndex + 1}: 格式不正确: ${line.substring(0, 50)}...`);
                    if (transaction)
                        await transaction.rollback();
                    continue;
                }
                // 解析字段 - 正确解析我们的模板格式
                const questionText = fields[0];
                // 处理不同的字段数量情况
                let options = [];
                let explanation = '';
                if (fields.length >= 7) {
                    // 标准格式: 问题|选项A|选项B|选项C|选项D|正确答案|解析
                    options = fields.slice(1, 5); // 四个选项A,B,C,D
                    explanation = fields[6]; // 第7个元素是解析
                }
                else if (fields.length === 6) {
                    // 少一个字段: 问题|选项A|选项B|选项C|选项D|正确答案
                    options = fields.slice(1, 5);
                    explanation = '';
                }
                else if (fields.length === 5) {
                    // 三个选项: 问题|选项A|选项B|选项C|正确答案
                    options = fields.slice(1, 4);
                    explanation = '';
                }
                else if (fields.length === 4) {
                    // 两个选项: 问题|选项A|选项B|正确答案
                    options = fields.slice(1, 3);
                    explanation = '';
                }
                else {
                    // 不支持的格式
                    failedCount++;
                    errors.push(`行 ${lineIndex + 1}: 字段数量不足: ${line.substring(0, 50)}...`);
                    if (transaction)
                        await transaction.rollback();
                    continue;
                }
                // 获取正确答案字段位置（总是倒数第二个或倒数第一个字段）
                const correctAnswer = fields.length > 1 ? fields[fields.length - (fields.length > 5 ? 2 : 1)].trim() : '';
                // 检查答案是否包含英文逗号，真正用于多选题答案分割
                // 只有当答案中包含多个字母（如"A,B"）时才视为多选题
                const isMultipleChoice = correctAnswer.includes(',') && correctAnswer.split(',').length > 1;
                // 处理正确答案 - 修复单选题被识别为多选题的问题
                const correctAnswers = isMultipleChoice
                    ? correctAnswer.split(',').map((a) => a.trim().toUpperCase())
                    : [correctAnswer.trim().toUpperCase()];
                // 验证正确答案格式 - 必须是有效的选项字母 (A, B, C, D...)
                const validAnswers = correctAnswers.filter((answer) => {
                    const index = answer.charCodeAt(0) - 'A'.charCodeAt(0);
                    return index >= 0 && index < options.length;
                });
                if (validAnswers.length === 0) {
                    failedCount++;
                    errors.push(`行 ${lineIndex + 1}: 无效的正确答案 "${correctAnswer}": ${line.substring(0, 50)}...`);
                    console.log(`[API] Invalid correct answers: "${correctAnswer}" for question "${questionText.substring(0, 30)}..."`);
                    if (transaction)
                        await transaction.rollback();
                    continue;
                }
                console.log(`[API] Parsed question: "${questionText.substring(0, 30)}...", ${options.length} options, answers: ${correctAnswers.join(',')}, explanation: ${explanation.substring(0, 20)}...`);
                if (options.length < 2) {
                    failedCount++;
                    errors.push(`行 ${lineIndex + 1}: 选项不足: ${line.substring(0, 50)}...`);
                    if (transaction)
                        await transaction.rollback();
                    continue;
                }
                try {
                    // 使用事务并明确指定ID
                    const questionId = (0, uuid_1.v4)();
                    currentQuestionId = questionId;
                    console.log(`[API] 为问题生成新ID: ${questionId}`);
                    // 1. 首先创建问题 - 指定ID而不是依赖默认生成的ID
                    const questionData = {
                        id: questionId,
                        questionSetId,
                        text: questionText,
                        questionType: isMultipleChoice ? 'multiple' : 'single',
                        explanation: explanation || '无解析',
                        orderIndex: lineIndex // 使用行号作为排序索引
                    };
                    console.log(`[API] 创建问题数据:`, JSON.stringify(questionData));
                    // 使用事务创建问题
                    const question = await Question_1.default.create(questionData, { transaction });
                    // 确保问题正确创建且有ID
                    if (!question) {
                        throw new Error(`问题创建失败，未能获取问题对象`);
                    }
                    // 增加额外确认步骤，确保问题存在且ID有效
                    if (!question.id) {
                        throw new Error(`问题创建后ID为空`);
                    }
                    console.log(`[API] 创建问题成功，ID: ${questionId}, 数据库返回ID: ${question.id}`);
                    // 增加额外验证确保ID匹配
                    if (question.id !== questionId) {
                        console.warn(`[API] 警告: 创建的问题ID ${question.id} 与生成的ID ${questionId} 不匹配`);
                        // 使用数据库返回的ID作为实际ID
                        currentQuestionId = question.id;
                    }
                    // 再次确认ID有效
                    if (!currentQuestionId) {
                        throw new Error(`问题ID无效，无法创建选项`);
                    }
                    // 显示选项创建的问题ID引用
                    console.log(`[API] 将使用问题ID: ${currentQuestionId} 创建选项`);
                    // 2. 然后为每个选项创建记录
                    const createdOptions = [];
                    for (let i = 0; i < options.length; i++) {
                        const optionText = options[i];
                        const optionLetter = String.fromCharCode(65 + i); // A, B, C, D...
                        const isCorrect = correctAnswers.includes(optionLetter);
                        // 创建选项 - 也明确指定ID
                        const optionId = (0, uuid_1.v4)();
                        console.log(`[API] 为选项 ${optionLetter} 生成新ID: ${optionId}, 关联到问题ID: ${currentQuestionId}`);
                        try {
                            // 直接内联创建选项，避免中间对象
                            const optionData = {
                                id: optionId,
                                questionId: currentQuestionId,
                                text: optionText || '选项内容',
                                isCorrect: !!isCorrect,
                                optionIndex: optionLetter
                            };
                            console.log(`[API] 创建选项数据:`, JSON.stringify(optionData));
                            // 在同一事务中创建
                            const option = await Option_1.default.create(optionData, { transaction });
                            // 验证选项是否成功创建
                            if (!option || !option.id) {
                                throw new Error(`选项 ${optionLetter} 创建失败`);
                            }
                            console.log(`[API] 选项创建成功, ID: ${option.id}, 选项: ${option.optionIndex}, 问题ID: ${option.questionId}`);
                            // 额外验证选项ID
                            if (option.id !== optionId) {
                                console.warn(`[API] 警告: 创建的选项ID ${option.id} 与生成的ID ${optionId} 不匹配`);
                            }
                            // 额外验证问题关联
                            if (!option.questionId) {
                                console.error(`[API] 错误: 选项创建成功但问题ID为空`);
                            }
                            else if (option.questionId !== currentQuestionId) {
                                console.warn(`[API] 警告: 选项关联的问题ID ${option.questionId} 与预期ID ${currentQuestionId} 不匹配`);
                            }
                            createdOptions.push(option);
                        }
                        catch (optionError) {
                            console.error(`[API] 创建选项 ${optionLetter} 失败:`, optionError);
                            throw new Error(`创建选项 ${optionLetter} 失败: ${optionError instanceof Error ? optionError.message : String(optionError)}`);
                        }
                    }
                    // 验证选项创建是否成功
                    if (createdOptions.length !== options.length) {
                        throw new Error(`只创建了 ${createdOptions.length} 个选项，应该有 ${options.length} 个选项`);
                    }
                    // 验证是否有正确选项
                    const hasCorrectOption = createdOptions.some(option => option.isCorrect);
                    if (!hasCorrectOption) {
                        throw new Error(`没有正确选项被创建，请检查答案格式是否正确`);
                    }
                    console.log(`[API] 问题 ID ${currentQuestionId} 及其 ${createdOptions.length} 个选项创建成功`);
                    // 添加到成功创建的ID集合
                    createdQuestionIds.push(currentQuestionId);
                    // 提交事务
                    await transaction.commit();
                    transaction = null; // 防止后续代码重复提交/回滚
                    // 更新成功计数
                    successCount++;
                }
                catch (innerError) {
                    // 事务错误，回滚所有操作
                    if (transaction)
                        await transaction.rollback();
                    transaction = null;
                    // 操作失败，计数为失败并记录错误
                    failedCount++;
                    const errorMessage = innerError instanceof Error ? innerError.message : '未知错误';
                    errors.push(`行 ${lineIndex + 1}: ${errorMessage}`);
                    console.error(`[API] 第 ${lineIndex + 1} 行处理失败:`, innerError);
                }
            }
            catch (parseError) {
                // 确保事务回滚
                if (transaction)
                    await transaction.rollback();
                // 解析失败，计数为失败并记录错误
                failedCount++;
                const errorLine = line.substring(0, 50);
                const errorMessage = parseError instanceof Error ? parseError.message : '未知错误';
                errors.push(`行 ${lineIndex + 1}: 解析失败: ${errorLine}... - ${errorMessage}`);
                console.error(`[API] 解析行 ${lineIndex + 1} 失败:`, parseError);
            }
        }
        // 清理上传的临时文件
        try {
            fs.unlinkSync(req.file.path);
            console.log(`[API] 清理临时文件: ${req.file.path}`);
        }
        catch (cleanupError) {
            console.error(`[API] 清理临时文件失败:`, cleanupError);
        }
        console.log(`[API] 批量导入完成. 成功: ${successCount}, 失败: ${failedCount}`);
        if (createdQuestionIds.length > 0) {
            console.log(`[API] 创建的问题ID列表:`, createdQuestionIds);
        }
        // 导入完成后返回结果
        return res.status(200).json({
            success: true,
            successCount,
            failedCount,
            errors: errors.length > 0 ? errors : undefined,
            message: `成功导入 ${successCount} 个问题，失败 ${failedCount} 个`
        });
    }
    catch (error) {
        console.error('[API] 批量导入题目失败:', error);
        return res.status(500).json({
            success: false,
            message: '批量导入题目失败',
            error: error.message
        });
    }
};
exports.batchUploadQuestions = batchUploadQuestions;
