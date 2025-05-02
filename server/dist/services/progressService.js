"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getUserQuestionSetProgress = getUserQuestionSetProgress;
exports.calculateProgressStats = calculateProgressStats;
const UserProgress_1 = __importDefault(require("../models/UserProgress"));
const QuestionSet_1 = __importDefault(require("../models/QuestionSet"));
const Question_1 = __importDefault(require("../models/Question"));
async function getUserQuestionSetProgress(userId, questionSetId) {
    return await UserProgress_1.default.findAll({
        where: { userId, questionSetId },
        include: [
            {
                model: QuestionSet_1.default,
                as: 'questionSet',
                attributes: ['id', 'title'],
                include: [{
                        model: Question_1.default,
                        as: 'questionSetQuestions',
                        attributes: ['id'],
                    }],
            },
        ],
    });
}
async function calculateProgressStats(userId, questionSetId) {
    // 获取题库总题数
    const questionSet = await QuestionSet_1.default.findByPk(questionSetId, {
        include: [{
                model: Question_1.default,
                as: 'questionSetQuestions',
                attributes: ['id'],
            }],
    });
    const totalQuestions = questionSet?.questionSetQuestions?.length || 0;
    // 获取用户的所有答题记录
    const progressRecords = await UserProgress_1.default.findAll({
        where: { userId, questionSetId },
        attributes: ['isCorrect', 'timeSpent'],
    });
    // 计算统计数据
    const completedQuestions = progressRecords.length;
    const correctAnswers = progressRecords.filter((p) => p.isCorrect).length;
    const totalTimeSpent = progressRecords.reduce((sum, p) => sum + p.timeSpent, 0);
    const averageTimeSpent = completedQuestions > 0 ? totalTimeSpent / completedQuestions : 0;
    const accuracy = completedQuestions > 0 ? (correctAnswers / completedQuestions) * 100 : 0;
    return {
        totalQuestions,
        completedQuestions,
        correctAnswers,
        totalTimeSpent,
        averageTimeSpent,
        accuracy,
        // 兼容旧的字段名
        total: totalQuestions,
        correct: correctAnswers,
        timeSpent: totalTimeSpent,
    };
}
