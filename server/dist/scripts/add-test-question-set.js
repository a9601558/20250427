"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const QuestionSet_1 = __importDefault(require("../models/QuestionSet"));
const Question_1 = __importDefault(require("../models/Question"));
const Option_1 = __importDefault(require("../models/Option"));
const uuid_1 = require("uuid");
async function addTestQuestionSet() {
    try {
        console.log('开始创建测试题库...');
        // 创建一个测试题库
        const questionSet = await QuestionSet_1.default.create({
            id: (0, uuid_1.v4)(),
            title: '测试题库',
            description: '这是一个用于测试的题库',
            category: '测试分类',
            icon: '📚',
            isPaid: false,
            price: undefined,
            trialQuestions: 0,
            isFeatured: false
        });
        console.log(`测试题库创建成功，ID: ${questionSet.id}`);
        // 创建一些测试题目
        for (let i = 1; i <= 3; i++) {
            const question = await Question_1.default.create({
                id: (0, uuid_1.v4)(),
                questionSetId: questionSet.id,
                text: `测试题目 ${i}`,
                explanation: `这是测试题目 ${i} 的解析`,
                questionType: 'single',
                orderIndex: i - 1
            });
            console.log(`题目 ${i} 创建成功，ID: ${question.id}`);
            // 为每个题目创建选项
            const options = [
                { text: '選択肢A', isCorrect: i === 1, optionIndex: 'A' },
                { text: '選択肢B', isCorrect: i === 2, optionIndex: 'B' },
                { text: '選択肢C', isCorrect: i === 3, optionIndex: 'C' },
                { text: '選択肢D', isCorrect: false, optionIndex: 'D' }
            ];
            for (const option of options) {
                await Option_1.default.create({
                    id: (0, uuid_1.v4)(),
                    questionId: question.id,
                    text: option.text,
                    isCorrect: option.isCorrect,
                    optionIndex: option.optionIndex
                });
            }
            console.log(`题目 ${i} 的选项创建成功`);
        }
        console.log('创建测试题库完成。您现在可以在前端访问这个题库了。');
        process.exit(0);
    }
    catch (error) {
        console.error('创建测试题库失败:', error);
        process.exit(1);
    }
}
addTestQuestionSet();
