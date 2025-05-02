const express = require('express');
const router = express.Router();
const userProgressController = require('../controllers/userProgressController');
const { authenticateToken } = require('../middleware/auth');

// 获取用户进度
router.get('/:userId', authenticateToken, userProgressController.getUserProgress);

// 获取用户在特定题库的进度
router.get('/:userId/:questionSetId', authenticateToken, userProgressController.getProgressByQuestionSetId);

// 更新用户进度
router.post('/update', authenticateToken, userProgressController.updateProgress);

// 重置用户进度
router.post('/reset', authenticateToken, userProgressController.resetProgress);

// 创建详细进度记录
router.post('/detail', authenticateToken, userProgressController.createDetailedProgress);

// 获取用户详细进度
router.get('/detail/:userId/:questionSetId', authenticateToken, userProgressController.getDetailedProgress);

// 获取进度统计
router.get('/stats/:userId/:questionSetId', authenticateToken, userProgressController.getProgressStats);

// 删除进度记录
router.delete('/:userId/:questionSetId', authenticateToken, userProgressController.deleteProgressRecord);

// 获取用户所有题库的进度统计
router.get('/stats/:userId', authenticateToken, userProgressController.getUserProgressStats);

// 重置用户特定题库的全部进度
router.post('/reset-all', authenticateToken, userProgressController.resetUserProgress);

module.exports = router; 