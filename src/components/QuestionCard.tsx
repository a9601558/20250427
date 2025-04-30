import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Question } from '../types';
import QuestionOption from './QuestionOption';
import RedeemCodeForm from './RedeemCodeForm';

interface QuestionCardProps {
  question: Question;
  onNext: () => void;
  onAnswerSubmitted?: (isCorrect: boolean, selectedOption: string | string[]) => void;
  questionNumber: number;
  totalQuestions: number;
  quizTitle: string;
  userAnsweredQuestion?: { 
    index: number; 
    isCorrect: boolean; 
    selectedOption: string | string[];
  };
}

const QuestionCard = ({ 
  question, 
  onNext, 
  onAnswerSubmitted, 
  questionNumber, 
  totalQuestions, 
  quizTitle,
  userAnsweredQuestion 
}: QuestionCardProps) => {
  // 单选题选择一个选项，多选题选择多个选项
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [selectedOptions, setSelectedOptions] = useState<string[]>([]);
  const [isSubmitted, setIsSubmitted] = useState(!!userAnsweredQuestion);
  const [showExplanation, setShowExplanation] = useState(false);
  const [showRedeemCodeModal, setShowRedeemCodeModal] = useState(false);
  const navigate = useNavigate();
  let timeoutId: NodeJS.Timeout | undefined;

  // 检查答案是否正确
  const checkCorrectness = (): boolean => {
    if (!isSubmitted) return false;
    if (question.questionType === 'single') {
      return selectedOption === question.correctAnswer;
    } else {
      const correctAnswers = question.correctAnswer as string[];
      return selectedOptions.length === correctAnswers.length &&
        selectedOptions.every(o => correctAnswers.includes(o)) &&
        correctAnswers.every(o => selectedOptions.includes(o));
    }
  };

  const isCorrect = checkCorrectness();

  const handleOptionClick = (optionId: string) => {
    if (isSubmitted) return;

    if (question.questionType === 'single') {
      // 单选题
      setSelectedOption(optionId);
    } else {
      // 多选题
      setSelectedOptions(prev => {
        if (prev.includes(optionId)) {
          // 如果已选中，则移除
          return prev.filter(id => id !== optionId);
        } else {
          // 如果未选中，则添加
          return [...prev, optionId];
        }
      });
    }
  };

  const handleSubmit = () => {
    if (question.questionType === 'single' && selectedOption) {
      setIsSubmitted(true);
      // 通知父组件答题结果
      const isCorrect = selectedOption === question.correctAnswer;
      if (onAnswerSubmitted) {
        onAnswerSubmitted(isCorrect, selectedOption);
      }
      // 答对自动跳到下一题
      if (isCorrect) {
        timeoutId = setTimeout(() => {
          handleNext();
        }, 1000); // 延迟1秒后跳转，让用户看到正确反馈
      }
    } else if (question.questionType === 'multiple' && selectedOptions.length > 0) {
      setIsSubmitted(true);
      // 比较选中的选项和正确答案（数组比较）
      const correctAnswers = question.correctAnswer as string[];
      // 判断所选选项是否与正确答案完全一致
      const isCorrect = 
        selectedOptions.length === correctAnswers.length && 
        selectedOptions.every(option => correctAnswers.includes(option)) &&
        correctAnswers.every(option => selectedOptions.includes(option));
      
      if (onAnswerSubmitted) {
        onAnswerSubmitted(isCorrect, selectedOptions);
      }
      // 答对自动跳到下一题
      if (isCorrect) {
        timeoutId = setTimeout(() => {
          handleNext();
        }, 1000); // 延迟1秒后跳转，让用户看到正确反馈
      }
    }
  };

  const handleNext = () => {
    setSelectedOption(null);
    setSelectedOptions([]);
    setIsSubmitted(false);
    setShowExplanation(false);
    onNext();
  };

  // 清理定时器
  useEffect(() => {
    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, []);

  return (
    <div className="bg-white shadow-md rounded-lg p-6 max-w-3xl mx-auto">
      {/* 顶部导航和标题 */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6">
        <div>
          <button 
            onClick={() => navigate('/')} 
            className="text-blue-600 hover:text-blue-800 mb-2 sm:mb-0 flex items-center"
          >
            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            返回主页
          </button>
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setShowRedeemCodeModal(true)}
            className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
          >
            使用兑换码
          </button>
          <div className="bg-blue-100 text-blue-800 py-1 px-3 rounded-full text-sm">
            {quizTitle}
          </div>
        </div>
      </div>

      {/* 问题标题和进度 */}
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-semibold text-gray-800">问题 {questionNumber} / {totalQuestions}</h2>
        <span className="bg-gray-100 text-gray-600 px-2 py-1 rounded text-sm">
          {question.questionType === 'single' ? '单选题' : '多选题'}
        </span>
      </div>

      {/* 问题内容 */}
      <div className="mb-6">
        <p className="text-gray-700 text-lg mb-4">{question.question}</p>
      </div>

      {/* 选项 */}
      <div className="mb-6">
        {question.options.map((option, index) => (
          <QuestionOption
            key={option.id}
            option={option}
            index={index}
            isSelected={
              question.questionType === 'single' 
                ? selectedOption === option.id 
                : selectedOptions.includes(option.id)
            }
            isCorrect={
              isSubmitted
                ? question.questionType === 'single'
                  ? question.correctAnswer as string
                  : (question.correctAnswer as string[]).includes(option.id) ? option.id : null
                : null
            }
            isSubmitted={isSubmitted}
            isMultiple={question.questionType === 'multiple'}
            onClick={() => handleOptionClick(option.id)}
          />
        ))}
      </div>

      {/* 解析 */}
      {isSubmitted && (
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center">
              <span className={`inline-block w-5 h-5 rounded-full mr-2 ${isCorrect ? 'bg-green-500' : 'bg-red-500'}`}></span>
              <span className={`font-medium ${isCorrect ? 'text-green-600' : 'text-red-600'}`}>
                {isCorrect ? '回答正确!' : '回答错误!'}
                {!isCorrect && question.questionType === 'single' && 
                  ` 正确答案是 ${question.correctAnswer}`
                }
                {!isCorrect && question.questionType === 'multiple' && 
                  ` 正确答案是 ${(question.correctAnswer as string[]).join(', ')}`
                }
              </span>
            </div>
            <button
              onClick={() => setShowExplanation(!showExplanation)}
              className="text-blue-600 hover:text-blue-800 text-sm font-medium"
            >
              {showExplanation ? '隐藏解析' : '查看解析'}
            </button>
          </div>

          {showExplanation && (
            <div className="bg-gray-50 p-4 rounded-md mt-2">
              <h3 className="font-semibold text-gray-700 mb-2">解析:</h3>
              <p className="text-gray-600">{question.explanation}</p>
            </div>
          )}
        </div>
      )}

      {/* 按钮 */}
      <div className="flex justify-between">
        {!isSubmitted ? (
          <button
            onClick={handleSubmit}
            disabled={question.questionType === 'single' 
              ? !selectedOption 
              : selectedOptions.length === 0}
            className={`py-2 px-6 rounded-lg font-medium ${
              (question.questionType === 'single' ? selectedOption : selectedOptions.length > 0)
                ? 'bg-blue-600 text-white hover:bg-blue-700'
                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
            }`}
          >
            {question.questionType === 'single' 
              ? selectedOption 
                ? '提交答案' 
                : '请选择一个选项'
              : selectedOptions.length > 0
                ? '提交所有选项'
                : '请选择至少一个选项'}
          </button>
        ) : (
          !isCorrect && (
            <button
              onClick={handleNext}
              className="bg-green-600 hover:bg-green-700 text-white py-2 px-6 rounded-lg font-medium"
            >
              下一题
            </button>
          )
        )}
      </div>

      {/* Redeem Code Modal */}
      {showRedeemCodeModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold">题库兑换码</h2>
              <button
                onClick={() => setShowRedeemCodeModal(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <RedeemCodeForm onRedeemSuccess={(quizId) => {
              console.log(`[QuestionCard] 兑换码成功回调，题库ID: ${quizId}`);
              setShowRedeemCodeModal(false);
              
              // 更新界面
              setTimeout(() => {
                window.location.reload();
              }, 1000);
            }} />
          </div>
        </div>
      )}
    </div>
  );
};

export default QuestionCard; 