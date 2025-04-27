"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.uploadQuestionSetFile = exports.upload = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const multer_1 = __importDefault(require("multer"));
const uuid_1 = require("uuid");
const QuestionSet_1 = __importDefault(require("../models/QuestionSet"));
const Question_1 = __importDefault(require("../models/Question"));
const Option_1 = __importDefault(require("../models/Option"));
// Configure multer for file upload
const storage = multer_1.default.diskStorage({
    destination: function (req, file, cb) {
        const uploadsDir = path_1.default.join(__dirname, '../../uploads');
        if (!fs_1.default.existsSync(uploadsDir)) {
            fs_1.default.mkdirSync(uploadsDir, { recursive: true });
        }
        cb(null, uploadsDir);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + (0, uuid_1.v4)();
        cb(null, uniqueSuffix + path_1.default.extname(file.originalname));
    }
});
exports.upload = (0, multer_1.default)({
    storage: storage,
    fileFilter: (req, file, cb) => {
        if (file.mimetype === 'application/json' ||
            file.mimetype === 'text/csv' ||
            file.mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
            file.mimetype === 'application/vnd.ms-excel') {
            cb(null, true);
        }
        else {
            cb(new Error('仅支持上传JSON、CSV或Excel文件'));
        }
    },
    limits: {
        fileSize: 10 * 1024 * 1024 // 10MB max file size
    }
});
/**
 * @desc    上传题库文件（支持JSON、CSV、Excel）
 * @route   POST /api/question-sets/upload
 * @access  Admin
 */
const uploadQuestionSetFile = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: '请上传文件'
            });
        }
        const filePath = req.file.path;
        const fileExt = path_1.default.extname(req.file.originalname).toLowerCase();
        let questionSetData = null;
        // 根据文件类型处理数据
        if (fileExt === '.json') {
            const fileContent = fs_1.default.readFileSync(filePath, 'utf8');
            questionSetData = JSON.parse(fileContent);
        }
        else if (fileExt === '.csv') {
            // CSV处理逻辑
            return res.status(200).json({
                success: true,
                message: 'CSV文件解析功能开发中，请使用JSON格式'
            });
        }
        else if (fileExt === '.xlsx' || fileExt === '.xls') {
            // Excel处理逻辑
            return res.status(200).json({
                success: true,
                message: 'Excel文件解析功能开发中，请使用JSON格式'
            });
        }
        else {
            return res.status(400).json({
                success: false,
                message: '不支持的文件类型'
            });
        }
        // 验证数据格式
        if (!questionSetData || !questionSetData.id || !questionSetData.title) {
            return res.status(400).json({
                success: false,
                message: '题库数据格式不正确，必须包含id和title字段'
            });
        }
        // 检查题库ID是否已存在
        const existingSet = await QuestionSet_1.default.findByPk(questionSetData.id);
        let response;
        if (existingSet) {
            // 如果存在则更新
            await existingSet.update({
                title: questionSetData.title || existingSet.title,
                description: questionSetData.description || existingSet.description,
                category: questionSetData.category || existingSet.category,
                icon: questionSetData.icon || existingSet.icon,
                isPaid: questionSetData.isPaid !== undefined ? questionSetData.isPaid : existingSet.isPaid,
                price: questionSetData.isPaid && questionSetData.price !== undefined ? questionSetData.price : undefined,
                trialQuestions: questionSetData.isPaid && questionSetData.trialQuestions !== undefined ? questionSetData.trialQuestions : undefined,
                isFeatured: questionSetData.isFeatured !== undefined ? questionSetData.isFeatured : existingSet.isFeatured
            });
            // 如果提供了题目，则更新题目
            if (questionSetData.questions && questionSetData.questions.length > 0) {
                // 先删除所有旧题目
                await Question_1.default.destroy({
                    where: { questionSetId: questionSetData.id }
                });
                // 添加新题目
                for (let i = 0; i < questionSetData.questions.length; i++) {
                    const q = questionSetData.questions[i];
                    // 创建问题
                    const question = await Question_1.default.create({
                        id: q.id || undefined,
                        text: q.text,
                        explanation: q.explanation || '暂无解析',
                        questionSetId: questionSetData.id,
                        questionType: q.questionType || 'single',
                        orderIndex: q.orderIndex !== undefined ? q.orderIndex : i
                    });
                    // 创建问题的选项
                    if (q.options && q.options.length > 0) {
                        // 定义选项索引字母数组
                        const optionIndices = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'];
                        for (let j = 0; j < q.options.length; j++) {
                            const option = q.options[j];
                            const optionIndex = option.optionIndex || optionIndices[j] || String.fromCharCode(65 + j); // A, B, C...
                            // 使用Sequelize模型创建选项
                            await Option_1.default.create({
                                questionId: question.id,
                                text: option.text,
                                isCorrect: option.isCorrect ? true : false,
                                optionIndex: optionIndex
                            });
                        }
                    }
                }
            }
            response = {
                id: questionSetData.id,
                status: 'updated',
                message: '题库更新成功',
                questionCount: questionSetData.questions ? questionSetData.questions.length : 0
            };
        }
        else {
            // 如果不存在则创建
            const newQuestionSet = await QuestionSet_1.default.create({
                id: questionSetData.id,
                title: questionSetData.title,
                description: questionSetData.description,
                category: questionSetData.category,
                icon: questionSetData.icon || 'book',
                isPaid: questionSetData.isPaid || false,
                price: questionSetData.isPaid && questionSetData.price !== undefined ? questionSetData.price : 0,
                trialQuestions: questionSetData.isPaid && questionSetData.trialQuestions !== undefined ? questionSetData.trialQuestions : 0,
                isFeatured: questionSetData.isFeatured || false
            });
            // 如果提供了题目，则创建题目
            if (questionSetData.questions && questionSetData.questions.length > 0) {
                for (let i = 0; i < questionSetData.questions.length; i++) {
                    const q = questionSetData.questions[i];
                    // 创建问题
                    const question = await Question_1.default.create({
                        id: q.id || undefined,
                        text: q.text,
                        explanation: q.explanation || '暂无解析',
                        questionSetId: questionSetData.id,
                        questionType: q.questionType || 'single',
                        orderIndex: q.orderIndex !== undefined ? q.orderIndex : i
                    });
                    // 创建问题的选项
                    if (q.options && q.options.length > 0) {
                        // 定义选项索引字母数组
                        const optionIndices = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'];
                        for (let j = 0; j < q.options.length; j++) {
                            const option = q.options[j];
                            const optionIndex = option.optionIndex || optionIndices[j] || String.fromCharCode(65 + j); // A, B, C...
                            // 使用Sequelize模型创建选项
                            await Option_1.default.create({
                                questionId: question.id,
                                text: option.text,
                                isCorrect: option.isCorrect ? true : false,
                                optionIndex: optionIndex
                            });
                        }
                    }
                }
            }
            response = {
                id: questionSetData.id,
                status: 'created',
                message: '题库创建成功',
                questionCount: questionSetData.questions ? questionSetData.questions.length : 0
            };
        }
        // 删除临时文件
        fs_1.default.unlinkSync(filePath);
        res.status(201).json({
            success: true,
            data: response,
            message: '题库上传成功'
        });
    }
    catch (error) {
        console.error('上传题库文件错误:', error);
        res.status(500).json({
            success: false,
            message: error.message || '服务器错误'
        });
    }
};
exports.uploadQuestionSetFile = uploadQuestionSetFile;
