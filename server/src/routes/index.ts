import { Express, Request, Response, NextFunction } from 'express';
import userRoutes from './userRoutes';
import questionSetRoutes from './questionSetRoutes';
import questionRoutes from './questionRoutes';
import userProgressRoutes from './userProgressRoutes';
import purchaseRoutes from './purchaseRoutes';
import redeemCodeRoutes from './redeemCodeRoutes';
import homepageRoutes from './homepageRoutes';
import wrongAnswerRoutes from './wrongAnswerRoutes';
import { logger } from '../utils/logger';

/**
 * 配置所有API路由
 * @param app Express应用实例
 * @param req Express请求对象
 * @param res Express响应对象
 */
const configureRoutes = (
  app: Express, 
  req?: Request, 
  res?: Response
): void => {
  logger.info('配置API路由');

  // API路由
  app.use('/api/users', userRoutes);
  app.use('/api/question-sets', questionSetRoutes);
  app.use('/api/questions', questionRoutes);
  app.use('/api/user-progress', userProgressRoutes);
  app.use('/api/purchases', purchaseRoutes);
  app.use('/api/redeem-codes', redeemCodeRoutes);
  app.use('/api/homepage', homepageRoutes);
  app.use('/api/wrong-answers', wrongAnswerRoutes);

  // 最后的错误处理中间件
  app.use((err: any, req: Request, res: Response, next: NextFunction) => {
    logger.error('请求处理错误:', err);
    res.status(500).json({
      success: false,
      message: '服务器内部错误',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined,
    });
  });
};

export default configureRoutes; 
