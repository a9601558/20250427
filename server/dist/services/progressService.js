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
                        as: 'questions',
                        attributes: ['id']
                    }]
            }
        ]
    });
}
async function calculateProgressStats(userId, questionSetId) {
    const progressStats = await getUserQuestionSetProgress(userId, questionSetId);
    // Get the total questions from the question set
    const questionSet = progressStats[0]?.get('questionSet');
    const totalQuestions = questionSet?.questions?.length || 0;
    // Calculate other stats
    const completedQuestions = progressStats.length;
    const correctAnswers = progressStats.filter(p => p.isCorrect).length;
    const totalTimeSpent = progressStats.reduce((sum, p) => sum + p.timeSpent, 0);
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
        timeSpent: totalTimeSpent
    };
}
