const UserProgress = require('../models/UserProgress');

/**
 * 重置用户特定题库的进度
 * @param {Object} req - 请求对象，包含用户ID和题库ID
 * @param {Object} res - 响应对象
 */
const resetUserProgress = async (req, res) => {
  try {
    const { userId, questionSetId } = req.body;
    
    // 校验参数
    if (!userId || !questionSetId) {
      return res.status(400).json({ success: false, message: '缺少必要参数' });
    }
    
    // 删除该用户该题库的所有进度记录
    const deletedCount = await UserProgress.destroy({
      where: {
        userId,
        questionSetId
      }
    });
    
    console.log(`[UserProgressController] 已重置用户 ${userId} 在题库 ${questionSetId} 的进度，删除了 ${deletedCount} 条记录`);
    
    return res.json({
      success: true,
      message: `成功重置进度，共删除${deletedCount}条记录`,
      deletedCount
    });
  } catch (error) {
    console.error('[UserProgressController] 重置进度失败:', error);
    return res.status(500).json({ success: false, message: '重置进度失败', error: error.message });
  }
};

// 添加占位引用，确保能够正确导出所有函数
const getUserProgress = () => {};
const getProgressByQuestionSetId = () => {};
const updateProgress = () => {};
const resetProgress = () => {};
const createDetailedProgress = () => {};
const getDetailedProgress = () => {};
const getProgressStats = () => {};
const deleteProgressRecord = () => {};
const getUserProgressStats = () => {};

module.exports = {
  // 确保保留现有的导出
  getUserProgress,
  getProgressByQuestionSetId,
  updateProgress,
  resetProgress,
  createDetailedProgress,
  getDetailedProgress,
  getProgressStats,
  deleteProgressRecord,
  getUserProgressStats,
  // 添加新函数导出
  resetUserProgress
}; 