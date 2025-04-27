import express, { Request, Response, RequestHandler } from 'express';
import { db, QueryResult } from '../db';

const router = express.Router();

// Get options by question IDs
router.get('/', (async (req: Request, res: Response) => {
  try {
    const { questionIds } = req.query;
    
    if (!questionIds) {
      return res.status(400).json({ error: 'questionIds is required' });
    }
    
    // Split comma-separated IDs
    const ids = (questionIds as string).split(',');
    
    // Use placeholders for each ID
    const placeholders = ids.map(() => '?').join(',');
    
    const options: QueryResult = await db.query(
      `SELECT * FROM options WHERE questionId IN (${placeholders}) ORDER BY questionId, optionIndex`,
      ids
    );
    
    res.json(options);
  } catch (error) {
    console.error('Error fetching options:', error);
    res.status(500).json({ error: 'Failed to fetch options' });
  }
}) as RequestHandler);

export default router; 