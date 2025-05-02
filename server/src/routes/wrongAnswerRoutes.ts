import express from 'express';
import * as wrongAnswerController from '../controllers/wrongAnswerController';
import { protect } from '../middleware/authMiddleware';

const router = express.Router();

// 保护所有路由，需要用户登录
router.use(protect);

// 获取用户的错题列表
router.get('/', wrongAnswerController.getUserWrongAnswers);

// 保存错题
router.post('/', wrongAnswerController.saveWrongAnswer);

// 获取错题详情
router.get('/:id', wrongAnswerController.getWrongAnswerById);

// 更新错题备注
router.patch('/:id', wrongAnswerController.updateWrongAnswerMemo);

// 删除错题
router.delete('/:id', wrongAnswerController.deleteWrongAnswer);

// 批量删除错题
router.post('/batch-delete', wrongAnswerController.bulkDeleteWrongAnswers);

// 标记错题为已掌握
router.post('/:id/mastered', wrongAnswerController.markAsMastered);

// 按题库获取错题
router.get('/by-question-set/:questionSetId', wrongAnswerController.getWrongAnswersByQuestionSet);

export default router; 