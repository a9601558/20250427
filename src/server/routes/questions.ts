import express, { Request, Response, RequestHandler } from 'express';
import { db, QueryResult } from '../db';

const router = express.Router();

// 调试中间件 - 记录所有请求
router.use((req, _res, next) => {
  console.log('题目路由收到请求:', req.method, req.originalUrl);
  console.log('请求参数:', req.query);
  next();
});

// Get questions by question set ID
router.get('/', (async (req: Request, res: Response) => {
  try {
    const { questionSetId } = req.query;
    
    if (!questionSetId) {
      return res.status(400).json({ 
        success: false,
        error: 'questionSetId is required' 
      });
    }
    
    // 获取问题列表
    console.log(`获取题库 ${questionSetId} 的题目`);
    const questions: QueryResult = await db.query(
      `SELECT * FROM questions WHERE questionSetId = ? ORDER BY orderIndex`,
      [questionSetId]
    );
    
    console.log(`找到 ${questions.length} 个题目`);
    
    // 获取每个问题的选项
    for (const question of questions) {
      const options = await db.query(
        `SELECT * FROM options WHERE questionId = ? ORDER BY optionIndex`,
        [question.id]
      );
      question.options = options;
      console.log(`问题 ${question.id} 有 ${options.length} 个选项`);
    }
    
    res.json({
      success: true,
      data: questions
    });
  } catch (error) {
    console.error('Error fetching questions:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to fetch questions' 
    });
  }
}) as RequestHandler);

export default router; 