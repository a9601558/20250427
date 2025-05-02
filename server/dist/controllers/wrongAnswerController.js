
// Sequelize Instance Recovery - 自动添加于 2025-05-02T10:36:55.641Z
// 这段代码确保Sequelize模型总是有有效的实例，即使在模块导入失败的情况下
(function() {
  try {
    // 修复空的sequelize实例
    if (typeof global.sequelize === 'undefined' && 
        (typeof sequelize === 'undefined' || !sequelize)) {
      const { Sequelize } = require('sequelize');
      const path = require('path');
      const fs = require('fs');
      const dotenv = require('dotenv');
      
      // 加载环境变量
      const envPath = path.join(process.cwd(), '.env');
      if (fs.existsSync(envPath)) {
        console.log('Recovery: 加载环境变量文件', envPath);
        dotenv.config({ path: envPath });
      }
      
      console.log('Recovery: 创建应急Sequelize实例');
      global.sequelize = new Sequelize(
        process.env.DB_NAME || 'quiz_app',
        process.env.DB_USER || 'root',
        process.env.DB_PASSWORD || '',
        {
          host: process.env.DB_HOST || 'localhost',
          port: parseInt(process.env.DB_PORT || '3306'),
          dialect: 'mysql',
          logging: false,
          pool: { max: 5, min: 0, acquire: 30000, idle: 10000 }
        }
      );
      
      // 设置全局变量，避免"未定义"错误
      if (typeof sequelize === 'undefined') {
        global.sequelize = global.sequelize;
      }
    }
  } catch (error) {
    console.error('Recovery: Sequelize恢复机制出错', error);
  }
})();
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getWrongAnswersByQuestionSet = exports.bulkDeleteWrongAnswers = exports.markAsMastered = exports.updateMemo = exports.deleteWrongAnswer = exports.saveWrongAnswer = exports.getWrongAnswers = void 0;
const WrongAnswer_1 = __importDefault(require("../models/WrongAnswer"));
const QuestionSet_1 = __importDefault(require("../models/QuestionSet"));
const sequelize_1 = require("sequelize");
/**
 * 获取用户所有错题记录
 */
const getWrongAnswers = async (req, res) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ success: false, message: '未授权，请先登录' });
        }
        const wrongAnswers = await WrongAnswer_1.default.findAll({
            where: { userId },
            include: [
                {
                    model: QuestionSet_1.default,
                    as: 'questionSet',
                    attributes: ['id', 'title'],
                },
            ],
            order: [['createdAt', 'DESC']],
        });
        return res.json({
            success: true,
            data: wrongAnswers,
        });
    }
    catch (error) {
        console.error('获取错题记录失败:', error);
        return res.status(500).json({
            success: false,
            message: '服务器错误，获取错题记录失败',
        });
    }
};
exports.getWrongAnswers = getWrongAnswers;
/**
 * 保存错题记录
 */
const saveWrongAnswer = async (req, res) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ success: false, message: '未授权，请先登录' });
        }
        const { questionId, questionSetId, question, questionType, options, selectedOption, selectedOptions, correctOption, correctOptions, explanation, } = req.body;
        // 检查是否已存在相同的错题记录（防止重复添加）
        const existingWrongAnswer = await WrongAnswer_1.default.findOne({
            where: {
                userId,
                questionId,
                questionSetId,
            },
        });
        if (existingWrongAnswer) {
            // 更新已有记录
            await existingWrongAnswer.update({
                question,
                questionType,
                options,
                selectedOption,
                selectedOptions,
                correctOption,
                correctOptions,
                explanation,
            });
            return res.json({
                success: true,
                data: existingWrongAnswer,
                message: '错题记录已更新',
            });
        }
        // 创建新记录
        const wrongAnswer = await WrongAnswer_1.default.create({
            userId,
            questionId,
            questionSetId,
            question,
            questionType,
            options,
            selectedOption,
            selectedOptions,
            correctOption,
            correctOptions,
            explanation,
        });
        return res.status(201).json({
            success: true,
            data: wrongAnswer,
            message: '错题已保存',
        });
    }
    catch (error) {
        console.error('保存错题失败:', error);
        return res.status(500).json({
            success: false,
            message: '服务器错误，保存错题失败',
        });
    }
};
exports.saveWrongAnswer = saveWrongAnswer;
/**
 * 删除错题记录
 */
const deleteWrongAnswer = async (req, res) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ success: false, message: '未授权，请先登录' });
        }
        const { id } = req.params;
        const wrongAnswer = await WrongAnswer_1.default.findOne({
            where: {
                id,
                userId,
            },
        });
        if (!wrongAnswer) {
            return res.status(404).json({
                success: false,
                message: '错题记录不存在',
            });
        }
        await wrongAnswer.destroy();
        return res.json({
            success: true,
            message: '错题已删除',
        });
    }
    catch (error) {
        console.error('删除错题失败:', error);
        return res.status(500).json({
            success: false,
            message: '服务器错误，删除错题失败',
        });
    }
};
exports.deleteWrongAnswer = deleteWrongAnswer;
/**
 * 更新错题备注
 */
const updateMemo = async (req, res) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ success: false, message: '未授权，请先登录' });
        }
        const { id } = req.params;
        const { memo } = req.body;
        const wrongAnswer = await WrongAnswer_1.default.findOne({
            where: {
                id,
                userId,
            },
        });
        if (!wrongAnswer) {
            return res.status(404).json({
                success: false,
                message: '错题记录不存在',
            });
        }
        await wrongAnswer.update({ memo });
        return res.json({
            success: true,
            data: wrongAnswer,
            message: '备注已更新',
        });
    }
    catch (error) {
        console.error('更新备注失败:', error);
        return res.status(500).json({
            success: false,
            message: '服务器错误，更新备注失败',
        });
    }
};
exports.updateMemo = updateMemo;
/**
 * 标记错题为已掌握（删除）
 */
const markAsMastered = async (req, res) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ success: false, message: '未授权，请先登录' });
        }
        const { id } = req.params;
        const wrongAnswer = await WrongAnswer_1.default.findOne({
            where: {
                id,
                userId,
            },
        });
        if (!wrongAnswer) {
            return res.status(404).json({
                success: false,
                message: '错题记录不存在',
            });
        }
        await wrongAnswer.destroy();
        return res.json({
            success: true,
            message: '已标记为掌握，该题已从错题集中移除',
        });
    }
    catch (error) {
        console.error('标记为已掌握失败:', error);
        return res.status(500).json({
            success: false,
            message: '服务器错误，标记为已掌握失败',
        });
    }
};
exports.markAsMastered = markAsMastered;
/**
 * 批量删除错题
 */
const bulkDeleteWrongAnswers = async (req, res) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ success: false, message: '未授权，请先登录' });
        }
        const { ids } = req.body;
        if (!Array.isArray(ids) || ids.length === 0) {
            return res.status(400).json({
                success: false,
                message: '请提供要删除的错题ID列表',
            });
        }
        await WrongAnswer_1.default.destroy({
            where: {
                id: {
                    [sequelize_1.Op.in]: ids,
                },
                userId,
            },
        });
        return res.json({
            success: true,
            message: `成功删除${ids.length}条错题记录`,
        });
    }
    catch (error) {
        console.error('批量删除错题失败:', error);
        return res.status(500).json({
            success: false,
            message: '服务器错误，批量删除错题失败',
        });
    }
};
exports.bulkDeleteWrongAnswers = bulkDeleteWrongAnswers;
/**
 * 获取题库下的错题
 */
const getWrongAnswersByQuestionSet = async (req, res) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ success: false, message: '未授权，请先登录' });
        }
        const { questionSetId } = req.params;
        const wrongAnswers = await WrongAnswer_1.default.findAll({
            where: {
                userId,
                questionSetId,
            },
            order: [['createdAt', 'DESC']],
        });
        return res.json({
            success: true,
            data: wrongAnswers,
        });
    }
    catch (error) {
        console.error('获取题库错题失败:', error);
        return res.status(500).json({
            success: false,
            message: '服务器错误，获取题库错题失败',
        });
    }
};
exports.getWrongAnswersByQuestionSet = getWrongAnswersByQuestionSet;
