import express, { Request, Response, RequestHandler } from 'express';
import { db, QueryResult } from '../db';

const router = express.Router();

// Get all question sets
router.get('/', (async (_req: Request, res: Response) => {
  try {
    const questionSets = await db.query(
      `SELECT * FROM question_sets ORDER BY title`
    );
    res.json(questionSets);
  } catch (error) {
    console.error('Error fetching question sets:', error);
    res.status(500).json({ error: 'Failed to fetch question sets' });
  }
}) as RequestHandler);

// Get a specific question set by ID
router.get('/:id', (async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const questionSets: QueryResult = await db.query(
      `SELECT * FROM question_sets WHERE id = ?`,
      [id]
    );
    
    // Handle array result properly
    const questionSet = questionSets.length > 0 ? questionSets[0] : null;
    
    if (!questionSet) {
      return res.status(404).json({ error: 'Question set not found' });
    }
    
    res.json(questionSet);
  } catch (error) {
    console.error(`Error fetching question set ${req.params.id}:`, error);
    res.status(500).json({ error: 'Failed to fetch question set' });
  }
}) as RequestHandler);

// Create a new question set
router.post('/', (async (req: Request, res: Response) => {
  try {
    const { 
      id, 
      title, 
      description, 
      category, 
      icon, 
      isPaid, 
      price, 
      trialQuestions,
      questions 
    } = req.body;
    
    // Validate required fields
    if (!id || !title || !category) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    // Insert question set
    await db.query(
      `INSERT INTO question_sets (
        id, title, description, category, icon, isPaid, price, trialQuestions, createdAt, updatedAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      [id, title, description || '', category, icon, isPaid ? 1 : 0, price || 0, trialQuestions || 0]
    );
    
    // Insert questions if provided
    if (questions && Array.isArray(questions) && questions.length > 0) {
      for (let i = 0; i < questions.length; i++) {
        const question = questions[i];
        
        // Insert question
        const questionId = `${id}-q${i+1}`;
        await db.query(
          `INSERT INTO questions (
            id, questionSetId, text, questionType, explanation, orderIndex, createdAt, updatedAt
          ) VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())`,
          [questionId, id, question.question, question.questionType, question.explanation, i]
        );
        
        // Insert options
        if (question.options && Array.isArray(question.options)) {
          for (let j = 0; j < question.options.length; j++) {
            const option = question.options[j];
            const isCorrect = question.questionType === 'single' 
              ? question.correctAnswer === option.id
              : (question.correctAnswer as string[]).includes(option.id);
              
            await db.query(
              `INSERT INTO options (
                id, questionId, text, isCorrect, optionIndex, createdAt, updatedAt
              ) VALUES (?, ?, ?, ?, ?, NOW(), NOW())`,
              [`${questionId}-o${j+1}`, questionId, option.text, isCorrect ? 1 : 0, option.id]
            );
          }
        }
      }
    }
    
    res.status(201).json({ id, message: 'Question set created successfully' });
  } catch (error) {
    console.error('Error creating question set:', error);
    res.status(500).json({ error: 'Failed to create question set' });
  }
}) as RequestHandler);

// Delete a question set
router.delete('/:id', (async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    // Check if question set exists
    const questionSets: QueryResult = await db.query(
      `SELECT id FROM question_sets WHERE id = ?`,
      [id]
    );
    
    if (questionSets.length === 0) {
      return res.status(404).json({ error: 'Question set not found' });
    }
    
    // Delete the question set (cascading delete will handle questions and options)
    await db.query(
      `DELETE FROM question_sets WHERE id = ?`,
      [id]
    );
    
    res.json({ message: 'Question set deleted successfully' });
  } catch (error) {
    console.error(`Error deleting question set ${req.params.id}:`, error);
    res.status(500).json({ error: 'Failed to delete question set' });
  }
}) as RequestHandler);

export default router; 