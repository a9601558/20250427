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
    
    res.json(questions);
  } catch (error) {
    console.error('Error fetching questions:', error);
    res.status(500).json({ error: 'Failed to fetch questions' });
  }
}) as RequestHandler);

export default router; 