import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { questionSets } from '../data/questionSets';
import QuestionCard from './QuestionCard';
import LoginModal from './LoginModal';
import PaymentModal from './PaymentModal';
import RedeemCodeForm from './RedeemCodeForm';
import { useUser } from '../contexts/UserContext';
import { QuizProgress } from '../contexts/UserContext';

const QuizPage = () => {
  const { quizId } = useParams<{ quizId: string }>();
  const navigate = useNavigate();
  const { user, addProgress, hasPurchased, getPurchaseExpiry } = useUser();
  
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const quizSet = questionSets.find(set => set.id === quizId);
  const [isRandomMode, setIsRandomMode] = useState(false);
  const [questionsOrder, setQuestionsOrder] = useState<number[]>([]);
  const [answeredQuestions, setAnsweredQuestions] = useState<{
    index: number;
    isCorrect: boolean;
    selectedOption: string | string[];
  }[]>([]);
  const [showAnsweredQuestions, setShowAnsweredQuestions] = useState(false);
  const [onlyShowWrongAnswers, setOnlyShowWrongAnswers] = useState(false);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [hasAccessToFullQuiz, setHasAccessToFullQuiz] = useState(false);
  const [expiryDate, setExpiryDate] = useState<string | null>(null);
  const [paymentSuccess, setPaymentSuccess] = useState(false);
  const [showRedeemForm, setShowRedeemForm] = useState(false);
  const [redeemSuccess, setRedeemSuccess] = useState(false);
  
  // 初始化题目顺序和检查付费权限
  useEffect(() => {
    if (!quizSet) return;
    
    // 初始化题目顺序
    initQuestionsOrder();
    
    // 检查付费权限
    checkPaymentAccess();
  }, [quizSet, quizId, user]);
  
  // 检查用户是否有权限访问完整题库
  const checkPaymentAccess = async () => {
    if (!quizSet) return;
    
    // 免费题库直接可以访问
    if (!quizSet.isPaid) {
      setHasAccessToFullQuiz(true);
      return;
    }
    
    // 检查用户是否购买过此题库
    if (user) {
      try {
        const hasPurchasedResult = await hasPurchased(quizSet.id);
        setHasAccessToFullQuiz(hasPurchasedResult);
        
        if (hasPurchasedResult) {
          // 获取过期时间
          const expiry = await getPurchaseExpiry(quizSet.id);
          if (expiry) {
            setExpiryDate(expiry.toISOString());
          } else {
            setExpiryDate(null);
          }
        } else {
          setExpiryDate(null);
        }
      } catch (error) {
        // 在生产环境中应使用适当的错误记录服务
        // console.error("检查购买状态失败:", error);
        setHasAccessToFullQuiz(false);
        setExpiryDate(null);
      }
    } else {
      setHasAccessToFullQuiz(false);
      setExpiryDate(null);
    }
  };
  
  // 初始化题目顺序
  const initQuestionsOrder = () => {
    if (!quizSet) return;
    
    const totalQuestionsCount = quizSet.questions.length;
    if (isRandomMode) {
      // 随机模式：生成随机顺序
      const randomOrder = Array.from({ length: totalQuestionsCount }, (_, i) => i)
        .sort(() => Math.random() - 0.5);
      setQuestionsOrder(randomOrder);
    } else {
      // 顺序模式：按原始顺序
      setQuestionsOrder(Array.from({ length: totalQuestionsCount }, (_, i) => i));
    }
  };

  // 重新初始化顺序（当模式切换时）
  useEffect(() => {
    initQuestionsOrder();
  }, [isRandomMode]);

  // 离开页面或完成所有题目时保存进度
  useEffect(() => {
    // 组件卸载时保存进度
    return () => {
      saveProgress();
    };
  }, [answeredQuestions]);

  if (!quizSet) {
    return (
      <div className="min-h-screen flex justify-center items-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">找不到题库</h2>
          <button 
            onClick={() => navigate('/')}
            className="bg-blue-600 text-white py-2 px-4 rounded-lg"
          >
            返回主页
          </button>
        </div>
      </div>
    );
  }

  const totalQuestions = quizSet.questions.length;
  
  // 获取当前实际的问题索引（基于顺序或随机模式）
  const currentActualQuestionIndex = questionsOrder[currentQuestionIndex] || 0;

  // 保存用户答题进度
  const saveProgress = async () => {
    if (!quizSet || answeredQuestions.length === 0) return;
    
    const progress: QuizProgress = {
      questionSetId: quizSet.id,
      answeredQuestions: answeredQuestions.map(answer => ({
        questionId: typeof answer.index === 'number' 
          ? String(quizSet.questions[answer.index].id)
          : Array.isArray(answer.selectedOption) 
            ? answer.selectedOption.join(',')
            : answer.selectedOption,
        selectedOptionId: typeof answer.selectedOption === 'string' 
          ? answer.selectedOption 
          : answer.selectedOption.join(','),
        isCorrect: answer.isCorrect
      })),
      score: Math.round(
        (answeredQuestions.filter(a => a.isCorrect).length / answeredQuestions.length) * 100
      ),
      lastAttemptDate: new Date()
    };
    
    // 调用addProgress保存进度
    try {
      await addProgress(progress);
      console.log('学习进度保存成功');
    } catch (error) {
      console.error("保存进度失败:", error);
    }
  };

  const handleNextQuestion = () => {
    if (currentQuestionIndex < questionsOrder.length - 1) {
      // 检查下一题是否可访问
      const nextQuestionIndex = currentQuestionIndex + 1;
      const nextActualIndex = questionsOrder[nextQuestionIndex];
      
      if (!isTrialQuestion(nextActualIndex) && !hasAccessToFullQuiz) {
        // 如果下一题需要付费且用户未购买，显示付费弹窗
        setShowPaymentModal(true);
        return;
      }
      
      setCurrentQuestionIndex(nextQuestionIndex);
    } else {
      // 所有问题都已回答完毕
      saveProgress(); // 保存完整进度
      alert('恭喜你完成了所有问题！');
      // 返回主页
      navigate('/');
    }
  };

  const handleAnswerSubmitted = (questionIndex: number, isCorrect: boolean, selectedOption: string | string[]) => {
    // 记录用户回答
    setAnsweredQuestions([
      ...answeredQuestions, 
      { 
        index: questionIndex, 
        isCorrect, 
        selectedOption 
      }
    ]);
  };

  const toggleMode = () => {
    // 如果是付费题库且用户未购买，禁止使用随机模式
    if (quizSet.isPaid && !hasAccessToFullQuiz && !isRandomMode) {
      setShowPaymentModal(true);
      return;
    }
    
    setIsRandomMode(!isRandomMode);
    setCurrentQuestionIndex(0); // 切换模式时重置到第一题
  };

  const toggleShowAnswered = () => {
    setShowAnsweredQuestions(!showAnsweredQuestions);
    setOnlyShowWrongAnswers(false); // 重置错题筛选
  };

  // 切换仅显示错题
  const toggleShowOnlyWrong = () => {
    setOnlyShowWrongAnswers(!onlyShowWrongAnswers);
  };

  // 切换到指定题目
  const jumpToQuestion = (index: number) => {
    // 检查该题是否需要付费
    const actualIndex = questionsOrder[index];
    if (!isTrialQuestion(actualIndex) && !hasAccessToFullQuiz) {
      setShowPaymentModal(true);
      return;
    }
    
    setCurrentQuestionIndex(index);
    setShowAnsweredQuestions(false);
  };

  // 计算错题数量
  const wrongAnswersCount = answeredQuestions.filter(q => !q.isCorrect).length;

  // 筛选要显示的答题记录
  const filteredAnsweredQuestions = onlyShowWrongAnswers 
    ? answeredQuestions.filter(q => !q.isCorrect)
    : answeredQuestions;

  // 检查是否是付费题库且用户未购买且不在试用范围内
  const isTrialQuestion = (index: number) => {
    if (!quizSet.isPaid) return true; // 免费题库
    if (hasAccessToFullQuiz) return true; // 已购买
    
    // 如果没有设置试用题目数，默认为0
    const trialCount = quizSet.trialQuestions || 0;
    
    // 试用题目范围内的题目
    return index < trialCount;
  };

  // 处理购买完成
  const handlePurchaseSuccess = async () => {
    setShowPaymentModal(false);
    setHasAccessToFullQuiz(true);
    
    // 重新检查购买状态获取更新的过期时间
    try {
      const hasPurchasedResult = await hasPurchased(quizSet.id);
      if (hasPurchasedResult) {
        // 获取过期时间
        const expiry = await getPurchaseExpiry(quizSet.id);
        if (expiry) {
          setExpiryDate(expiry.toISOString());
        } else {
          setExpiryDate(null);
        }
      }
    } catch (error) {
      // 在生产环境中应使用适当的错误记录服务
      // console.error("获取购买信息失败:", error);
    }
    
    // 显示支付成功提示
    setPaymentSuccess(true);
    // 3秒后关闭提示
    setTimeout(() => {
      setPaymentSuccess(false);
    }, 3000);
  };

  // 格式化到期日期为更友好的格式
  const formatExpiryDate = (dateString: string | null) => {
    if (!dateString) return '';
    
    const date = new Date(dateString);
    return date.toLocaleDateString();
  };

  // 计算剩余天数
  const calculateRemainingDays = (dateString: string | null) => {
    if (!dateString) return 0;
    
    const expiryDate = new Date(dateString);
    const today = new Date();
    const diffTime = expiryDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    return diffDays > 0 ? diffDays : 0;
  };

  // 处理兑换成功
  const handleRedeemSuccess = async (redeemedQuizId: string) => {
    if (redeemedQuizId === quizSet?.id) {
      // 兑换码兑换成功，重新检查权限
      await checkPaymentAccess();
      // 显示成功消息
      setRedeemSuccess(true);
      setShowRedeemForm(false);
      // 3秒后关闭成功提示
      setTimeout(() => {
        setRedeemSuccess(false);
      }, 3000);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 py-8 px-4 sm:py-12 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        {/* 支付成功提示 */}
        {paymentSuccess && (
          <div className="fixed top-4 right-4 bg-green-50 border-l-4 border-green-500 p-4 z-50 shadow-md animate-fade-in">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm text-green-700">
                  支付成功！您现在可以访问完整题库内容
                </p>
              </div>
            </div>
          </div>
        )}

        {/* 兑换成功提示 */}
        {redeemSuccess && (
          <div className="fixed top-4 right-4 bg-green-50 border-l-4 border-green-500 p-4 z-50 shadow-md animate-fade-in">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm text-green-700">
                  兑换码兑换成功！您现在可以访问完整题库内容
                </p>
              </div>
            </div>
          </div>
        )}

        {/* 剩余有效期提示 */}
        {expiryDate && (
          <div className="bg-blue-50 border-l-4 border-blue-500 p-4 mb-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm text-blue-700">
                  您已购买此题库，剩余有效期: <span className="font-medium">{calculateRemainingDays(expiryDate)} 天</span> (到期日期: {formatExpiryDate(expiryDate)})
                </p>
              </div>
            </div>
          </div>
        )}

        {/* 付费题库提示 */}
        {quizSet.isPaid && !hasAccessToFullQuiz && (
          <div className="bg-blue-50 border-l-4 border-blue-500 p-4 mb-4">
            <div className="flex flex-col space-y-4">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3 flex-1 md:flex md:justify-between">
                  <p className="text-sm text-blue-700">
                    此题库为付费内容，价格: ¥{quizSet.price}
                    {quizSet.trialQuestions && quizSet.trialQuestions > 0
                      ? `，您可以免费试用前 ${quizSet.trialQuestions} 道题。`
                      : '，此题库不提供试用。'
                    }
                    <span className="font-medium ml-1">注意：随机模式只对付费用户开放</span>
                  </p>
                  <p className="mt-3 text-sm md:mt-0 md:ml-6">
                    <button
                      onClick={() => setShowPaymentModal(true)}
                      className="whitespace-nowrap font-medium text-blue-700 hover:text-blue-600"
                    >
                      购买完整题库 <span aria-hidden="true">&rarr;</span>
                    </button>
                  </p>
                </div>
              </div>
              
              {/* 兑换码选项 */}
              {user && (
                <div className="border-t border-blue-300 pt-3">
                  <div className="flex flex-col sm:flex-row justify-between items-center">
                    <div className="mb-3 sm:mb-0">
                      <h3 className="text-sm font-medium text-blue-700">有兑换码？</h3>
                      <p className="text-xs text-blue-600">
                        您可以输入兑换码来获取此题库的访问权限
                      </p>
                    </div>
                    <button 
                      onClick={() => setShowRedeemForm(!showRedeemForm)}
                      className="inline-flex items-center px-3 py-1.5 border border-blue-500 rounded-md shadow-sm text-sm font-medium text-blue-700 bg-white hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                    >
                      <svg className="h-4 w-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                      </svg>
                      {showRedeemForm ? '关闭兑换' : '使用兑换码'}
                    </button>
                  </div>
                  
                  {showRedeemForm && (
                    <div className="mt-3">
                      <RedeemCodeForm onRedeemSuccess={handleRedeemSuccess} />
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* 模式切换和答题情况按钮 */}
        <div className="bg-white shadow rounded-lg p-4 mb-6">
          <div className="flex flex-wrap items-center justify-between">
            <div className="flex items-center mb-3 sm:mb-0">
              <span className="text-gray-600 mr-3">模式:</span>
              <button 
                onClick={toggleMode}
                className={`px-3 py-1 rounded-md mr-2 ${!isRandomMode 
                  ? 'bg-blue-600 text-white' 
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}
              >
                顺序
              </button>
              <button 
                onClick={toggleMode}
                className={`px-3 py-1 rounded-md ${isRandomMode 
                  ? 'bg-blue-600 text-white' 
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}
              >
                随机
              </button>
            </div>
            
            <div className="flex items-center">
              <button 
                onClick={toggleShowAnswered}
                className={`px-3 py-1 rounded-md mr-2 ${showAnsweredQuestions 
                  ? 'bg-blue-600 text-white' 
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}
              >
                {showAnsweredQuestions ? '返回答题' : '查看答题情况'}
              </button>
              
              {answeredQuestions.length > 0 && (
                <span className="text-sm text-gray-600">
                  已答: {answeredQuestions.length}/{totalQuestions} | 错题: {wrongAnswersCount}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* 显示已答题目列表 */}
        {showAnsweredQuestions && (
          <div className="bg-white shadow rounded-lg overflow-hidden mb-6">
            <div className="p-4 border-b">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium text-gray-900">答题记录</h3>
                
                {answeredQuestions.length > 0 && wrongAnswersCount > 0 && (
                  <button 
                    onClick={toggleShowOnlyWrong}
                    className={`px-3 py-1 text-sm rounded-md ${onlyShowWrongAnswers 
                      ? 'bg-red-600 text-white' 
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}
                  >
                    {onlyShowWrongAnswers ? '显示全部题目' : '只看错题'}
                  </button>
                )}
              </div>
            </div>
            
            {filteredAnsweredQuestions.length > 0 ? (
              <div className="divide-y divide-gray-200">
                {filteredAnsweredQuestions.map((answer, idx) => {
                  const question = quizSet.questions[answer.index];
                  return (
                    <div key={idx} className="p-4 hover:bg-gray-50">
                      <div className="flex items-start">
                        <div 
                          className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center mr-3 ${
                            answer.isCorrect ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'
                          }`}
                        >
                          {answer.isCorrect ? (
                            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                          ) : (
                            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                            </svg>
                          )}
                        </div>
                        <div className="flex-1">
                          <button 
                            onClick={() => jumpToQuestion(answer.index)}
                            className="text-left w-full"
                          >
                            <p className="font-medium text-gray-800">
                              题目 {answer.index + 1}: {question.question}
                            </p>
                            <p className="mt-1 text-sm text-gray-600">
                              {answer.isCorrect ? '正确答案' : '你的答案'}: {typeof answer.selectedOption === 'string' 
                                ? question.options.find(opt => opt.id === answer.selectedOption)?.text || answer.selectedOption
                                : answer.selectedOption.map(id => question.options.find(opt => opt.id === id)?.text || id).join(', ')
                              }
                            </p>
                            {!answer.isCorrect && (
                              <p className="mt-1 text-sm text-green-600">
                                正确答案: {Array.isArray(question.correctAnswer)
                                  ? question.correctAnswer.map(id => question.options.find(opt => opt.id === id)?.text || id).join(', ')
                                  : question.options.find(opt => opt.id === question.correctAnswer)?.text || question.correctAnswer
                                }
                              </p>
                            )}
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="p-4 text-center text-gray-500">
                {onlyShowWrongAnswers ? '没有错题记录' : '暂无答题记录'}
              </div>
            )}
          </div>
        )}

        {/* 问题卡片 */}
        {!showAnsweredQuestions && (
          <>
            <div className="bg-white shadow rounded-lg overflow-hidden mb-6">
              <div className="p-4 sm:p-6">
                <div className="flex justify-between items-center mb-4">
                  <span className="text-sm font-medium text-gray-500">
                    题目 {currentQuestionIndex + 1} / {totalQuestions}
                  </span>
                  
                  <span className="text-sm font-medium text-gray-500">
                    {quizSet.title}
                  </span>
                </div>
                
                <QuestionCard
                  question={quizSet.questions[currentActualQuestionIndex]}
                  onAnswerSubmitted={(isCorrect, selectedOption) => 
                    handleAnswerSubmitted(currentActualQuestionIndex, isCorrect, selectedOption)
                  }
                  onNext={handleNextQuestion}
                  questionNumber={currentQuestionIndex + 1}
                  totalQuestions={totalQuestions}
                  quizTitle={quizSet.title}
                  userAnsweredQuestion={answeredQuestions.find(q => q.index === currentActualQuestionIndex)}
                />
              </div>
            </div>
            
            {/* 题目导航 */}
            <div className="bg-white shadow rounded-lg overflow-hidden">
              <div className="p-4 border-b">
                <h3 className="text-lg font-medium text-gray-900">题目导航</h3>
              </div>
              
              <div className="p-4 grid grid-cols-5 sm:grid-cols-8 md:grid-cols-10 gap-2">
                {questionsOrder.map((actualQuestionIndex, index) => {
                  const isAnswered = answeredQuestions.some(q => q.index === actualQuestionIndex);
                  const answer = answeredQuestions.find(q => q.index === actualQuestionIndex);
                  const isCurrentQuestion = index === currentQuestionIndex;
                  const needPayment = !isTrialQuestion(actualQuestionIndex) && !hasAccessToFullQuiz;
                  
                  let buttonClasses = 'w-full h-10 flex items-center justify-center rounded-md font-medium ';
                  
                  if (isCurrentQuestion) {
                    buttonClasses += 'ring-2 ring-offset-2 ring-blue-500 ';
                  }
                  
                  if (needPayment) {
                    buttonClasses += 'bg-gray-100 text-gray-400 cursor-not-allowed ';
                  } else if (isAnswered) {
                    buttonClasses += answer && answer.isCorrect 
                      ? 'bg-green-100 text-green-800 hover:bg-green-200 ' 
                      : 'bg-red-100 text-red-800 hover:bg-red-200 ';
                  } else {
                    buttonClasses += 'bg-gray-100 text-gray-800 hover:bg-gray-200 ';
                  }
                  
                  return (
                    <button
                      key={index}
                      className={buttonClasses}
                      onClick={() => jumpToQuestion(index)}
                      disabled={needPayment}
                    >
                      {index + 1}
                      {needPayment && (
                        <svg className="w-3 h-3 ml-1" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                        </svg>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </>
        )}
        
        {/* 用户未登录提示 */}
        {!user && (
          <div className="mt-6 bg-yellow-50 border-l-4 border-yellow-400 p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm text-yellow-700">
                  您尚未登录，答题进度无法保存。
                  <button
                    onClick={() => setIsLoginModalOpen(true)}
                    className="font-medium text-yellow-700 underline ml-1"
                  >
                    点击登录
                  </button>
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
      
      {/* 登录模态框 */}
      <LoginModal
        isOpen={isLoginModalOpen}
        onClose={() => setIsLoginModalOpen(false)}
      />
      
      {/* 支付模态框 */}
      <PaymentModal
        isOpen={showPaymentModal}
        onClose={() => setShowPaymentModal(false)}
        questionSet={quizSet}
        onSuccess={handlePurchaseSuccess}
      />
    </div>
  );
};

export default QuizPage; 