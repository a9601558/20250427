import express, { Request, Response, RequestHandler } from 'express';
import { db, QueryResult } from '../db';

const router = express.Router();

// Get questions by question set ID
router.get('/', (async (req: Request, res: Response) => {
  try {
    const { questionSetId } = req.query;
    
    if (!questionSetId) {
      return res.status(400).json({ error: 'questionSetId is required' });
    }
    
    const questions: QueryResult = await db.query(
      `SELECT * FROM questions WHERE questionSetId = ? ORDER BY orderIndex`,
      [questionSetId]
    );
    
    // 获取每个问题的选项
    for (const question of questions) {
      const options = await db.query(
        `SELECT * FROM options WHERE questionId = ? ORDER BY optionIndex`,
        [question.id]
      );
      question.options = options;
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