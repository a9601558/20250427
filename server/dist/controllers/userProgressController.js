"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateUserProgress = exports.getUserProgress = void 0;
const db_1 = __importDefault(require("../config/db"));
const uuid_1 = require("uuid");
/**
 * @desc    获取用户进度
 * @route   GET /api/progress
 * @access  Private
 */
const getUserProgress = async (req, res) => {
    try {
        const userId = req.user.id;
        // 查询用户的所有进度记录
        const [progressRecords] = await db_1.default.execute(`
      SELECT 
        up.id,
        up.question_set_id as questionSetId,
        up.completed_questions as completedQuestions,
        up.total_questions as totalQuestions,
        up.correct_answers as correctAnswers,
        up.last_accessed as lastAccessed,
        qs.title as questionSetTitle
      FROM 
        user_progress up
      JOIN
        question_sets qs ON up.question_set_id = qs.id
      WHERE 
        up.user_id = ?
    `, [userId]);
        res.status(200).json({
            success: true,
            data: progressRecords
        });
    }
    catch (error) {
        console.error('获取用户进度失败:', error);
        res.status(500).json({
            success: false,
            message: '获取用户进度失败',
            error: error.message
        });
    }
};
exports.getUserProgress = getUserProgress;
/**
 * @desc    更新用户进度
 * @route   POST /api/progress
 * @access  Private
 */
const updateUserProgress = async (req, res) => {
    try {
        const userId = req.user.id;
        const { questionSetId, completedQuestions, totalQuestions, correctAnswers } = req.body;
        if (!questionSetId) {
            return res.status(400).json({
                success: false,
                message: '题库ID不能为空'
            });
        }
        // 检查题库是否存在
        const [questionSets] = await db_1.default.execute('SELECT id FROM question_sets WHERE id = ?', [questionSetId]);
        if (Array.isArray(questionSets) && questionSets.length === 0) {
            return res.status(404).json({
                success: false,
                message: '题库不存在'
            });
        }
        // 检查用户是否已有该题库的进度记录
        const [existingProgress] = await db_1.default.execute('SELECT id FROM user_progress WHERE user_id = ? AND question_set_id = ?', [userId, questionSetId]);
        const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
        let progressId;
        if (Array.isArray(existingProgress) && existingProgress.length > 0) {
            // 更新现有记录
            progressId = existingProgress[0].id;
            await db_1.default.execute(`
        UPDATE user_progress 
        SET 
          completed_questions = ?,
          total_questions = ?,
          correct_answers = ?,
          last_accessed = ?
        WHERE 
          id = ?
      `, [completedQuestions, totalQuestions, correctAnswers, now, progressId]);
        }
        else {
            // 创建新记录
            progressId = (0, uuid_1.v4)();
            await db_1.default.execute(`
        INSERT INTO user_progress 
          (id, user_id, question_set_id, completed_questions, total_questions, correct_answers, last_accessed) 
        VALUES 
          (?, ?, ?, ?, ?, ?, ?)
      `, [progressId, userId, questionSetId, completedQuestions, totalQuestions, correctAnswers, now]);
        }
        res.status(200).json({
            success: true,
            message: '进度更新成功',
            data: {
                id: progressId,
                questionSetId,
                completedQuestions,
                totalQuestions,
                correctAnswers,
                lastAccessed: now
            }
        });
    }
    catch (error) {
        console.error('更新用户进度失败:', error);
        res.status(500).json({
            success: false,
            message: '更新用户进度失败',
            error: error.message
        });
    }
};
exports.updateUserProgress = updateUserProgress;
