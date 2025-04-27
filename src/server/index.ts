import express, { Request, Response, RequestHandler } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import questionSetsRouter from './routes/question-sets';
import questionsRouter from './routes/questions';
import optionsRouter from './routes/options';

// Load environment variables
dotenv.config();

// Create Express app
const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// API routes
app.use('/api/question-sets', questionSetsRouter);
app.use('/api/questions', questionsRouter);
app.use('/api/options', optionsRouter);

// Health check endpoint - 修改路径确保可以被前端访问
app.get('/health', ((_req: Request, res: Response) => {
  res.status(200).json({ status: 'ok' });
}) as RequestHandler);

// 添加一个API版本的健康检查端点
app.get('/api/health', ((_req: Request, res: Response) => {
  res.status(200).json({ status: 'ok', server: 'running', version: '1.0' });
}) as RequestHandler);

// Start the server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

export default app; 