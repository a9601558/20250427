import { useState, useEffect, useCallback } from 'react';
import { IQuestionSet, Question } from '../types/index';
import { questionSetApi } from '../utils/api';
import { useSocket } from '../contexts/SocketContext';
import { SOCKET_EVENTS, URL_PARAMS, URL_MODES } from '../constants/quiz';

interface UseQuestionSetDataResult {
  questionSet: IQuestionSet | null;
  questions: Question[];
  originalQuestions: Question[];
  loading: boolean;
  error: string | null;
  shuffleQuestions: () => void;
  restoreOriginalOrder: () => void;
  isRandomMode: boolean;
}

// Helper function to get option label (A, B, C, D...)
const getOptionLabel = (index: number): string => {
  return String.fromCharCode(65 + index); // 65 is ASCII for 'A'
};

// Helper function to get questions from different API response formats
const getQuestions = (data: any): any[] => {
  // First check for new field name
  if (data.questionSetQuestions && data.questionSetQuestions.length > 0) {
    return data.questionSetQuestions;
  }
  // Then check for old field name
  if (data.questions && data.questions.length > 0) {
    return data.questions;
  }
  // Return empty array if neither exists
  return [];
};

export const useQuestionSetData = (questionSetId: string | undefined): UseQuestionSetDataResult => {
  const { socket } = useSocket();
  const [questionSet, setQuestionSet] = useState<IQuestionSet | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [originalQuestions, setOriginalQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRandomMode, setIsRandomMode] = useState(false);
  
  // Process question data - add labels and ensure correct format
  const processQuestions = useCallback((questionsData: any[]): Question[] => {
    return questionsData.map((q: any) => {
      // Ensure options exist
      if (!q.options || !Array.isArray(q.options)) {
        console.warn("Question missing options:", q.id);
        q.options = [];
      }
      
      // Process options - use fixed ID generation method
      const processedOptions = q.options.map((opt: any, index: number) => {
        // Use question ID and option index to generate consistent ID
        const optionId = opt.id || `q${q.id}-opt${index}`;
        return {
          id: optionId,
          text: opt.text,
          isCorrect: opt.isCorrect,
          label: getOptionLabel(index) // Add letter label
        };
      });
      
      return {
        ...q,
        options: processedOptions,
        // Ensure correctAnswer field matches option IDs
        correctAnswer: q.questionType === 'single'
          ? processedOptions.find((opt: any) => opt.isCorrect)?.id
          : processedOptions.filter((opt: any) => opt.isCorrect).map((opt: any) => opt.id)
      };
    });
  }, []);
  
  // Fetch question set data
  useEffect(() => {
    const fetchQuestionSet = async () => {
      if (!questionSetId) {
        setError('Invalid question set ID');
        setLoading(false);
        return;
      }
      
      try {
        setLoading(true);
        setError(null);
        
        // Parse URL parameters
        const urlParams = new URLSearchParams(window.location.search);
        const mode = urlParams.get(URL_PARAMS.MODE);
        const specificQuestions = urlParams.get(URL_PARAMS.QUESTIONS);
        
        // Fetch question set
        const response = await questionSetApi.getQuestionSetById(questionSetId);
        
        if (response.success && response.data) {
          // Create standardized question set object
          const questionSetData: IQuestionSet = {
            id: response.data.id,
            title: response.data.title,
            description: response.data.description,
            category: response.data.category,
            icon: response.data.icon,
            questions: getQuestions(response.data),
            isPaid: response.data.isPaid || false,
            price: response.data.price || 0,
            isFeatured: response.data.isFeatured || false,
            featuredCategory: response.data.featuredCategory,
            hasAccess: false,
            trialQuestions: response.data.trialQuestions,
            questionCount: getQuestions(response.data).length,
            createdAt: new Date(),
            updatedAt: new Date()
          };
          
          setQuestionSet(questionSetData);
          
          // Process questions from the question set
          const questionsData = getQuestions(questionSetData);
          if (questionsData.length > 0) {
            console.log(`[useQuestionSetData] Loaded ${questionsData.length} questions`);
            
            // Process and set questions
            const processedQuestions = processQuestions(questionsData);
            
            // Save original question order
            setOriginalQuestions(processedQuestions);
            
            // If in wrong-answers mode with specific questions, filter accordingly
            if (mode === URL_MODES.WRONG_ANSWERS && specificQuestions) {
              console.log('[useQuestionSetData] Wrong answers mode, filtering specified questions');
              const questionIds = specificQuestions.split(',');
              
              // Only keep specified question IDs
              const filteredQuestions = processedQuestions.filter((q: Question) => 
                questionIds.includes(String(q.id))
              );
              
              if (filteredQuestions.length > 0) {
                console.log(`[useQuestionSetData] Filtered to ${filteredQuestions.length} questions`);
                setQuestions(filteredQuestions);
              } else {
                // If no questions match, use all questions
                console.log('[useQuestionSetData] No matching questions found, using all questions');
                setQuestions(processedQuestions);
              }
            } else {
              setQuestions(processedQuestions);
            }
          } else {
            console.error("[useQuestionSetData] Question set contains no questions");
            setError('This question set does not contain any questions');
          }
        } else {
          setError('Failed to load question set data');
        }
      } catch (error) {
        console.error('[useQuestionSetData] Error fetching question set:', error);
        setError('Error loading question set data');
      } finally {
        setLoading(false);
      }
    };
    
    fetchQuestionSet();
  }, [questionSetId, processQuestions]);
  
  // Listen for question set updates via Socket.IO
  useEffect(() => {
    if (!socket || !questionSetId) return;
    
    const handleQuestionSetUpdate = (updatedQuestionSet: IQuestionSet) => {
      if (updatedQuestionSet.id === questionSetId) {
        setQuestionSet(updatedQuestionSet);
        
        // If questions are included, update them too
        const questionsData = getQuestions(updatedQuestionSet);
        if (questionsData && questionsData.length > 0) {
          const processedQuestions = processQuestions(questionsData);
          setOriginalQuestions(processedQuestions);
          
          // Maintain random mode if active
          if (isRandomMode) {
            const shuffled = [...processedQuestions].sort(() => Math.random() - 0.5);
            setQuestions(shuffled);
          } else {
            setQuestions(processedQuestions);
          }
        }
      }
    };
    
    socket.on(SOCKET_EVENTS.QUESTION_SET_UPDATE, handleQuestionSetUpdate);
    
    return () => {
      socket.off(SOCKET_EVENTS.QUESTION_SET_UPDATE, handleQuestionSetUpdate);
    };
  }, [socket, questionSetId, processQuestions, isRandomMode]);
  
  // Shuffle questions (for random mode)
  const shuffleQuestions = useCallback(() => {
    if (originalQuestions.length === 0) return;
    
    // Use Fisher-Yates algorithm to shuffle
    const shuffled = [...originalQuestions];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    
    setQuestions(shuffled);
    setIsRandomMode(true);
  }, [originalQuestions]);
  
  // Restore original question order
  const restoreOriginalOrder = useCallback(() => {
    setQuestions([...originalQuestions]);
    setIsRandomMode(false);
  }, [originalQuestions]);
  
  return {
    questionSet,
    questions,
    originalQuestions,
    loading,
    error,
    shuffleQuestions,
    restoreOriginalOrder,
    isRandomMode
  };
}; 