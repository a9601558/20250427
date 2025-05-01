import UserProgress from '../models/UserProgress';
import QuestionSet from '../models/QuestionSet';
import Question from '../models/Question';

interface ProgressStats {
  totalQuestions: number;
  completedQuestions: number;
  correctAnswers: number;
  totalTimeSpent: number;
  averageTimeSpent: number;
  accuracy: number;
  total: number;
  correct: number;
  timeSpent: number;
}

export async function getUserQuestionSetProgress(userId: string, questionSetId: string) {
  return await UserProgress.findAll({
    where: { userId, questionSetId },
    include: [
      { 
        model: QuestionSet, 
        as: 'questionSet', 
        attributes: ['id', 'title'],
        include: [{
          model: Question,
          as: 'questionSetQuestions',
          attributes: ['id']
        }]
      }
    ]
  });
}

export async function calculateProgressStats(userId: string, questionSetId: string): Promise<ProgressStats> {
  // 获取题库总题数
  const questionSet = await QuestionSet.findByPk(questionSetId, {
    include: [{
      model: Question,
      as: 'questionSetQuestions',
      attributes: ['id']
    }]
  });
  const totalQuestions = questionSet?.questionSetQuestions?.length || 0;

  // 获取用户的所有答题记录
  const progressRecords = await UserProgress.findAll({
    where: { userId, questionSetId },
    attributes: ['isCorrect', 'timeSpent']
  });

  // 计算统计数据
  const completedQuestions = progressRecords.length;
  const correctAnswers = progressRecords.filter(p => p.isCorrect).length;
  const totalTimeSpent = progressRecords.reduce((sum, p) => sum + p.timeSpent, 0);
  const averageTimeSpent = completedQuestions > 0 ? totalTimeSpent / completedQuestions : 0;
  const accuracy = completedQuestions > 0 ? (correctAnswers / completedQuestions) * 100 : 0;

  return {
    totalQuestions,
    completedQuestions,
    correctAnswers,
    totalTimeSpent,
    averageTimeSpent,
    accuracy,
    // 兼容旧的字段名
    total: totalQuestions,
    correct: correctAnswers,
    timeSpent: totalTimeSpent
  };
} 