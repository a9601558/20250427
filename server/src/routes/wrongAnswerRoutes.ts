import express from 'express';
import * as wrongAnswerController from '../controllers/wrongAnswerController';
import { authenticateJwt } from '../middlewares/auth';

const router = express.Router();

// 所有路由都需要身份验证
router.use(authenticateJwt);

// 获取用户的所有错题记录
router.get('/', wrongAnswerController.getWrongAnswers);

// 保存错题记录
router.post('/', wrongAnswerController.saveWrongAnswer);

// 删除错题记录
router.delete('/:id', wrongAnswerController.deleteWrongAnswer);

// 更新错题备注
router.patch('/:id', wrongAnswerController.updateMemo);

// 标记错题为已掌握
router.post('/:id/mastered', wrongAnswerController.markAsMastered);

// 批量删除错题
router.post('/bulk-delete', wrongAnswerController.bulkDeleteWrongAnswers);

// 获取题库下的错题
router.get('/by-question-set/:questionSetId', wrongAnswerController.getWrongAnswersByQuestionSet);

export default router; 
