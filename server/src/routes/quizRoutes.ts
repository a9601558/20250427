import express from 'express';
import userProgressController from '../controllers/userProgressController';

const router = express.Router();

/**
 * @route   POST /api/quiz/submit
 * @desc    提交测验结果
 * @access  Public - 不需要身份验证，这是一个备用接口
 */
router.post('/submit', userProgressController.quizSubmit);

export default router; 