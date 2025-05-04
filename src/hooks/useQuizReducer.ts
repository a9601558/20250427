import { useReducer } from 'react';
import { Question } from '../types';

// Define quiz state type
export interface QuizState {
  currentQuestionIndex: number;
  selectedOptions: string[];
  answeredQuestions: AnsweredQuestion[];
  correctAnswers: number;
  quizComplete: boolean;
  showExplanation: boolean;
  isRandomMode: boolean;
  quizStartTime: number;
  quizTotalTime: number;
  isTimerActive: boolean;
}

// Define the types of actions that can be dispatched
export type QuizAction =
  | { type: 'SELECT_OPTION'; optionId: string; isMultiChoice: boolean }
  | { type: 'SUBMIT_ANSWER'; isCorrect: boolean; selectedOption: string | string[]; questionIndex: number }
  | { type: 'NEXT_QUESTION'; isLastQuestion: boolean }
  | { type: 'JUMP_TO_QUESTION'; index: number }
  | { type: 'RESET_QUIZ'; questions: Question[] }
  | { type: 'COMPLETE_QUIZ'; timeSpent: number }
  | { type: 'TOGGLE_EXPLANATION' }
  | { type: 'TOGGLE_RANDOM_MODE'; originalQuestions: Question[] }
  | { type: 'RESTORE_ORIGINAL_ORDER'; originalQuestions: Question[] }
  | { type: 'UPDATE_TIMER'; timeSpent: number }
  | { type: 'SET_QUIZ_PROGRESS'; progress: Partial<QuizState> }
  | { type: 'INITIALIZE_QUIZ'; startTime: number }
  | { type: 'LOAD_ANSWERED_QUESTIONS'; answeredQuestions: AnsweredQuestion[] };

// Define the answered question interface
export interface AnsweredQuestion {
  index: number;
  questionIndex?: number;
  isCorrect: boolean;
  selectedOption: string | string[];
  selectedOptionId?: string | string[];
}

// Reducer function to handle state transitions
const quizReducer = (state: QuizState, action: QuizAction): QuizState => {
  switch (action.type) {
    case 'SELECT_OPTION':
      if (action.isMultiChoice) {
        // For multiple choice questions, toggle the option in the array
        return {
          ...state,
          selectedOptions: state.selectedOptions.includes(action.optionId)
            ? state.selectedOptions.filter(id => id !== action.optionId)
            : [...state.selectedOptions, action.optionId]
        };
      } else {
        // For single choice questions, replace the selection
        return {
          ...state,
          selectedOptions: [action.optionId]
        };
      }

    case 'SUBMIT_ANSWER': {
      // Convert selectedOption to array if it's not already
      const optionIds = Array.isArray(action.selectedOption) 
        ? action.selectedOption 
        : [action.selectedOption];

      // Check if this question has already been answered
      const existingAnswerIndex = state.answeredQuestions.findIndex(
        q => q.questionIndex === action.questionIndex
      );

      let updatedAnsweredQuestions;
      if (existingAnswerIndex !== -1) {
        // Update existing answer
        updatedAnsweredQuestions = [...state.answeredQuestions];
        updatedAnsweredQuestions[existingAnswerIndex] = {
          ...updatedAnsweredQuestions[existingAnswerIndex],
          isCorrect: action.isCorrect,
          selectedOption: optionIds
        };
      } else {
        // Add new answer
        updatedAnsweredQuestions = [
          ...state.answeredQuestions,
          {
            index: state.answeredQuestions.length,
            questionIndex: action.questionIndex,
            isCorrect: action.isCorrect,
            selectedOption: optionIds
          }
        ];
      }

      // Calculate new correct answers count
      const correctCount = updatedAnsweredQuestions.filter(q => q.isCorrect).length;

      return {
        ...state,
        answeredQuestions: updatedAnsweredQuestions,
        correctAnswers: correctCount,
        showExplanation: true
      };
    }

    case 'NEXT_QUESTION':
      // If it's the last question, complete the quiz
      if (action.isLastQuestion) {
        return {
          ...state,
          quizComplete: true,
          isTimerActive: false,
          showExplanation: false,
          selectedOptions: []
        };
      }
      // Otherwise move to the next question
      return {
        ...state,
        currentQuestionIndex: state.currentQuestionIndex + 1,
        selectedOptions: [],
        showExplanation: false
      };

    case 'JUMP_TO_QUESTION':
      return {
        ...state,
        currentQuestionIndex: action.index,
        selectedOptions: [],
        showExplanation: false
      };

    case 'RESET_QUIZ':
      return {
        ...state,
        currentQuestionIndex: 0,
        selectedOptions: [],
        answeredQuestions: [],
        correctAnswers: 0,
        quizComplete: false,
        showExplanation: false,
        quizStartTime: Date.now(),
        isTimerActive: true,
        quizTotalTime: 0
      };

    case 'COMPLETE_QUIZ':
      return {
        ...state,
        quizComplete: true,
        isTimerActive: false,
        quizTotalTime: action.timeSpent
      };

    case 'TOGGLE_EXPLANATION':
      return {
        ...state,
        showExplanation: !state.showExplanation
      };

    case 'TOGGLE_RANDOM_MODE':
      // Create a shuffled copy of the original questions
      const shuffled = [...action.originalQuestions].sort(() => Math.random() - 0.5);
      
      return {
        ...state,
        isRandomMode: true,
        currentQuestionIndex: 0,
        selectedOptions: [],
        showExplanation: false
      };

    case 'RESTORE_ORIGINAL_ORDER':
      return {
        ...state,
        isRandomMode: false,
        currentQuestionIndex: 0,
        selectedOptions: [],
        showExplanation: false
      };

    case 'UPDATE_TIMER':
      return {
        ...state,
        quizTotalTime: action.timeSpent
      };

    case 'SET_QUIZ_PROGRESS':
      return {
        ...state,
        ...action.progress
      };

    case 'INITIALIZE_QUIZ':
      return {
        ...state,
        quizStartTime: action.startTime,
        isTimerActive: true
      };

    case 'LOAD_ANSWERED_QUESTIONS':
      return {
        ...state,
        answeredQuestions: action.answeredQuestions,
        correctAnswers: action.answeredQuestions.filter(q => q.isCorrect).length
      };

    default:
      return state;
  }
};

// Initial quiz state
const initialQuizState: QuizState = {
  currentQuestionIndex: 0,
  selectedOptions: [],
  answeredQuestions: [],
  correctAnswers: 0,
  quizComplete: false,
  showExplanation: false,
  isRandomMode: false,
  quizStartTime: 0,
  quizTotalTime: 0,
  isTimerActive: false
};

// Custom hook to use the quiz reducer
export const useQuizReducer = () => {
  const [quizState, dispatch] = useReducer(quizReducer, initialQuizState);

  return {
    quizState,
    dispatch
  };
}; 