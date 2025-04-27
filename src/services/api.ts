import axios from 'axios';
import { Question, Option, QuestionType } from '../data/questions';
import { QuestionSet } from '../data/questionSets';

// Define types that match our database structure
interface DbOption {
  id: string;
  questionId: string;
  text: string;
  isCorrect: boolean;
  optionIndex: string;
}

interface DbQuestion {
  id: string;
  questionSetId: string;
  text: string;
  questionType: QuestionType;
  explanation: string;
  orderIndex: number;
}

interface DbQuestionSet {
  id: string;
  title: string;
  description: string;
  category: string;
  icon: string;
  isPaid: boolean;
  price?: number;
  trialQuestions?: number;
  isFeatured: boolean;
  featuredCategory?: string;
}

// API base URL - would come from environment config in a real app
const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Transform database question to front-end question
function transformDbQuestionToFrontend(dbQuestion: DbQuestion, dbOptions: DbOption[]): Question {
  const options: Option[] = dbOptions.map(opt => ({
    id: opt.optionIndex, // Use optionIndex (A, B, C, D) as the option ID in frontend
    text: opt.text,
  }));

  // For single-choice questions, find the optionIndex of the correct option
  // For multi-choice questions, collect all correct optionIndexes
  let correctAnswer: string | string[];
  
  if (dbQuestion.questionType === 'single') {
    const correctOption = dbOptions.find(opt => opt.isCorrect);
    correctAnswer = correctOption ? correctOption.optionIndex : '';
  } else {
    correctAnswer = dbOptions
      .filter(opt => opt.isCorrect)
      .map(opt => opt.optionIndex);
  }

  return {
    id: parseInt(dbQuestion.id), // Convert to number as frontend expects number IDs
    question: dbQuestion.text,
    options,
    questionType: dbQuestion.questionType,
    correctAnswer,
    explanation: dbQuestion.explanation,
  };
}

// Transform database question set to front-end question set with questions
async function transformDbQuestionSetToFrontend(
  dbQuestionSet: DbQuestionSet,
  dbQuestions: DbQuestion[],
  dbOptions: DbOption[]
): Promise<QuestionSet> {
  // Group options by questionId
  const optionsByQuestionId = dbOptions.reduce((acc, option) => {
    if (!acc[option.questionId]) {
      acc[option.questionId] = [];
    }
    acc[option.questionId].push(option);
    return acc;
  }, {} as Record<string, DbOption[]>);

  // Transform questions
  const questions = dbQuestions.map(q => 
    transformDbQuestionToFrontend(q, optionsByQuestionId[q.id] || [])
  );

  return {
    id: dbQuestionSet.id,
    title: dbQuestionSet.title,
    description: dbQuestionSet.description,
    category: dbQuestionSet.category,
    questions,
    icon: dbQuestionSet.icon,
    isPaid: dbQuestionSet.isPaid,
    price: dbQuestionSet.price,
    trialQuestions: dbQuestionSet.trialQuestions,
  };
}

// API methods
export const questionSetService = {
  // Get all question sets (without questions)
  async getAllQuestionSets(): Promise<QuestionSet[]> {
    const { data } = await api.get('/question-sets');
    return data;
  },

  // Get a specific question set with all its questions
  async getQuestionSetById(id: string): Promise<QuestionSet> {
    // Get the question set
    const { data: questionSet } = await api.get(`/question-sets/${id}`);
    
    // Get all questions for this set
    const { data: questions } = await api.get(`/questions?questionSetId=${id}`);
    
    // Get all options for these questions
    const questionIds = questions.map((q: DbQuestion) => q.id);
    const { data: options } = await api.get(`/options?questionIds=${questionIds.join(',')}`);
    
    // Transform the data
    return transformDbQuestionSetToFrontend(questionSet, questions, options);
  },
  
  // Additional methods as needed (create, update, delete)
};

export default {
  questionSetService
}; 