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
        as: 'progressQuestionSet', 
        attributes: ['id', 'title'],
        include: [{
          model: Question,
          as: 'questions',
          attributes: ['id']
        }]
      }
    ]
  });
}

export async function calculateProgressStats(userId: string, questionSetId: string): Promise<ProgressStats> {
  const progressStats = await getUserQuestionSetProgress(userId, questionSetId);
  
  // Get the total questions from the question set
  const questionSet = progressStats[0]?.get('progressQuestionSet') as any;
  const totalQuestions = questionSet?.questions?.length || 0;
  
  // Calculate other stats
  const completedQuestions = progressStats.length;
  const correctAnswers = progressStats.filter(p => p.isCorrect).length;
  const totalTimeSpent = progressStats.reduce((sum, p) => sum + p.timeSpent, 0);
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