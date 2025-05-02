// Import type from proper sources and add necessary types
import React, { useState, useEffect, useCallback, ChangeEvent, FormEvent } from 'react';
import { Question, Option, QuestionSet } from '../../types';
import { useUser } from '../../contexts/UserContext';
import { questionSetApi, questionApi, redeemCodeApi } from '../../utils/api';
import axios from 'axios';
// @ts-expect-error The import below might not be found, which is acceptable in this context
import Modal from 'react-modal';
import { Alert, Form, Input, Radio, Button, Checkbox } from 'antd';
import { PlusOutlined, DeleteOutlined } from '@ant-design/icons';
import { logger } from '../../utils/logger';

type QuestionType = 'single' | 'multiple';

interface ClientQuestion {
  id: string;
  question: string;
  questionType: QuestionType;
  options: Option[];
  correctAnswer: string | string[];
  explanation: string;
}

interface ApiQuestion {
  id: string;
  text: string;
  questionType: QuestionType;
  options: Array<{
    id: string;
    text: string;
    isCorrect: boolean;
  }>;
  explanation: string;
  correctAnswer?: string | string[];
  [key: string]: unknown;
}

// Use imported type instead of redefining
// interface RedeemCode {
//   id: string;
//   code: string;
//   questionSetId: string;
//   expiryDate: string;
//   isUsed: boolean;
//   [key: string]: unknown;
// }

interface QuestionFormData {
  id: string;
  question: string;
  questionType: QuestionType;
  options: Option[];
  correctAnswer: string | string[];
  explanation: string;
}

interface FormData {
  id: string;
  title: string;
  description: string;
  category: string;
  icon: string;
  isPaid: boolean;
  price: number;
  trialQuestions: number;
  questions: Question[];
}

interface StatusMessage {
  type: string;
  message: string;
}

// Helper type for safer API response handling
interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// 转换API格式的题目到前端使用的格式
const mapApiToClientQuestion = (question: ApiQuestion): ClientQuestion => {
  return {
    id: question.id,
    question: question.text || '',
    questionType: question.questionType || 'single',
    options: (question.options || []).map((o) => ({
      id: o.id || '',
      text: o.text,
    })),
    correctAnswer: question.correctAnswer || '',
    explanation: question.explanation || '',
  };
};

// 转换前端格式的题目到API使用的格式
const mapClientToApiQuestion = (question: ClientQuestion): ApiQuestion => {
  return {
    id: question.id,
    text: question.question,
    questionType: question.questionType,
    explanation: question.explanation,
    options: question.options.map((opt) => ({
      id: opt.id,
      text: opt.text,
      isCorrect: Array.isArray(question.correctAnswer) 
        ? question.correctAnswer.includes(opt.id)
        : question.correctAnswer === opt.id,
    })),
  };
};

const AdminQuestionSets = () => {
  const { isAdmin } = useUser();
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [statusMessage, setStatusMessage] = useState<StatusMessage>({ type: '', message: '' });
  const [showCreateForm, setShowCreateForm] = useState<boolean>(false);
  const [showEditForm, setShowEditForm] = useState<boolean>(false);
  const [questionSets, setQuestionSets] = useState<QuestionSet[]>([]);
  const [currentQuestionSet, setCurrentQuestionSet] = useState<QuestionSet | null>(null);
  const [formData, setFormData] = useState<FormData>({
    id: '',
    title: '',
    description: '',
    category: '',
    icon: '📝',
    isPaid: false,
    price: 29.9,
    trialQuestions: 0,
    questions: [] as Question[],
  });
  const [loading, setLoading] = useState<boolean>(false);
  const [loadingQuestionSets, setLoadingQuestionSets] = useState<boolean>(true);
  const [loadingAction, setLoadingAction] = useState<string>('');

  // 兑换码相关
  const [redeemCodes, setRedeemCodes] = useState<any[]>([]);
  const [showRedeemCodeModal, setShowRedeemCodeModal] = useState<boolean>(false);
  const [selectedQuizForCode, setSelectedQuizForCode] = useState<QuestionSet | null>(null);
  const [codeDurationDays, setCodeDurationDays] = useState<number>(30);
  const [codeQuantity, setCodeQuantity] = useState<number>(1);
  const [generatedCodes, setGeneratedCodes] = useState<any[]>([]);
  const [codeFilterStatus, setCodeFilterStatus] = useState<string>('all');
  const [codeFilterQuizId, setCodeFilterQuizId] = useState<string | null>(null);

  // 题目管理相关
  const [showQuestionModal, setShowQuestionModal] = useState<boolean>(false);
  const [currentQuestion, setCurrentQuestion] = useState<ClientQuestion | null>(null);
  const [questionFormData, setQuestionFormData] = useState<QuestionFormData>({
    id: '',
    question: '',
    questionType: 'single',
    options: [],
    correctAnswer: '',
    explanation: '',
  });
  const [optionInput, setOptionInput] = useState<{ id: string; text: string }>({ id: '', text: '' });
  const [questionIndex, setQuestionIndex] = useState<number>(-1);
  const [isAddingQuestion, setIsAddingQuestion] = useState<boolean>(false);

  // 文件上传相关
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  
  // 状态消息
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [successMessage, setSuccessMessage] = useState<string>('');

  // 可选的分类和图标
  const categoryOptions = [
    '前端开发',
    '后端开发',
    '全栈开发',
    '移动开发',
    '数据库',
    '人工智能',
    '网络安全',
    '操作系统',
    '软件工程',
    '计算机基础',
    '网络协议',
    '云计算',
    '区块链',
    '大数据',
    '服务器运维',
    '其他',
  ];
  
  const iconOptions = [
    '📝', '📚', '💻', '🔍', '🧩', '⚙️', '📊', '🔐', '📡', '🛠️',
    '🧪', '🔬', '📱', '🌐', '🤖', '🧠', '🔥', '💾', '⚡', '☁️',
  ];

  // 显示状态消息
  const showStatusMessage = (type: string, message: string): void => {
    setStatusMessage({ type, message });
    // 根据消息类型设置对应的状态
    if (type === 'error') {
      setErrorMessage(message);
      setSuccessMessage('');
    } else if (type === 'success') {
      setSuccessMessage(message);
      setErrorMessage('');
    }
    
    // 5秒后自动清除消息
    setTimeout(() => {
      setStatusMessage({ type: '', message: '' });
      setErrorMessage('');
      setSuccessMessage('');
    }, 5000);
  };

  // 加载所有兑换码
  const loadRedeemCodes = async (): Promise<void> => {
    try {
      const response = await redeemCodeApi.getAllRedeemCodes();
      if (response.success && response.data) {
        // Use any type to prevent type conflicts
        setRedeemCodes(response.data);
      } else {
        logger.error('加载兑换码失败:', response.error);
      }
    } catch (error) {
      logger.error('加载兑换码出错:', error);
    }
  };

  // 从API加载题库数据
  const loadQuestionSets = async (): Promise<void> => {
    setLoadingQuestionSets(true);
    try {
      logger.info('正在从API加载题库...');
      const response = await questionSetApi.getAllQuestionSets();
      
      if (response.success && response.data) {
        // 确保response.data是数组
        if (Array.isArray(response.data)) {
          setQuestionSets(response.data);
          logger.info('成功加载题库:', response.data.length);
        } else {
          logger.error('API返回的题库数据不是数组:', response.data);
          showStatusMessage('error', '题库数据格式不正确');
        }
      } else {
        logger.error('加载题库失败:', response.error || response.message);
        showStatusMessage('error', `加载题库失败: ${response.error || response.message || '未知错误'}`);
      }
    } catch (error) {
      logger.error('加载题库出错:', error);
      showStatusMessage('error', '加载题库时出现错误');
    } finally {
      setLoadingQuestionSets(false);
    }
  };

  // 初始加载题库和兑换码数据
  useEffect(() => {
    loadQuestionSets();
    loadRedeemCodes();
    
    // 设置定时器，每60秒自动刷新一次题库数据
    const refreshInterval = setInterval(loadQuestionSets, 60000);
    
    // 在组件卸载时清除定时器
    return () => clearInterval(refreshInterval);
  }, []);

  // 搜索过滤题库
  const filteredQuestionSets = questionSets.filter((set) => 
    set.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
    set.category.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // 处理表单输入变化
  const handleFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>): void => {
    const { name, value, type, checked } = e.target as HTMLInputElement;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  // 创建新题库
  const handleCreateSubmit = async (): Promise<void> => {
    setLoading(true);
    setLoadingAction('create');
    
    try {
      // 创建前校验表单
      if (!formData.title || !formData.category) {
        showStatusMessage('error', '题库标题和分类不能为空');
        setLoading(false);
        return;
      }
      
      const newQuestionSet = {
        title: formData.title,
        description: formData.description,
        category: formData.category,
        icon: formData.icon || '📝',
        isPaid: formData.isPaid,
        price: formData.isPaid ? parseFloat(formData.price.toString()) : undefined,
        trialQuestions: formData.isPaid ? parseInt(formData.trialQuestions.toString()) : undefined,
        questions: [],
      };
      
      // 调用API创建题库
      const response = await questionSetApi.createQuestionSet(newQuestionSet);
      
      if (response.success && response.data) {
        showStatusMessage('success', '题库创建成功');
        setShowCreateForm(false);
        await loadQuestionSets();  // 重新加载全部题库
        
        // 重置表单数据
        setFormData({
          id: '',
          title: '',
          description: '',
          category: '',
          icon: '📝',
          isPaid: false,
          price: 29.9,
          trialQuestions: 0,
          questions: [],
        });
      } else {
        showStatusMessage('error', `创建题库失败: ${response.error || '未知错误'}`);
      }
    } catch (error) {
      logger.error('创建题库出错:', error);
      showStatusMessage('error', '创建题库时发生错误');
    } finally {
      setLoading(false);
      setLoadingAction('');
    }
  };

  // 点击编辑题库按钮
  const handleEditClick = (questionSet: QuestionSet): void => {
    setCurrentQuestionSet(questionSet);
    setFormData({
      id: questionSet.id as string,
      title: questionSet.title,
      description: questionSet.description || '',
      category: questionSet.category,
      icon: questionSet.icon || '📝',
      isPaid: questionSet.isPaid || false,
      price: questionSet.price || 29.9,
      trialQuestions: questionSet.trialQuestions || 0,
      questions: questionSet.questions || [],
    });
    setShowEditForm(true);
  };

  // 提交编辑题库
  const handleEditSubmit = async (): Promise<void> => {
    setLoading(true);
    setLoadingAction('edit');
    
    try {
      // 编辑前校验表单
      if (!formData.title || !formData.category) {
        showStatusMessage('error', '题库标题和分类不能为空');
        setLoading(false);
        return;
      }
      
      const updatedQuestionSet = {
        title: formData.title,
        description: formData.description,
        category: formData.category,
        icon: formData.icon,
        isPaid: formData.isPaid,
        price: formData.isPaid ? parseFloat(formData.price.toString()) : undefined,
        trialQuestions: formData.isPaid ? parseInt(formData.trialQuestions.toString()) : undefined,
      };
      
      // 调用API更新题库
      const response = await questionSetApi.updateQuestionSet(formData.id, updatedQuestionSet);
      
      if (response.success && response.data) {
        showStatusMessage('success', '题库更新成功');
        setShowEditForm(false);
        await loadQuestionSets();  // 重新加载全部题库
      } else {
        showStatusMessage('error', `更新题库失败: ${response.error || '未知错误'}`);
      }
    } catch (error) {
      logger.error('更新题库出错:', error);
      showStatusMessage('error', '更新题库时发生错误');
    } finally {
      setLoading(false);
      setLoadingAction('');
    }
  };

  // 删除题库
  const handleDeleteQuestionSet = async (id: string): Promise<void> => {
    if (!window.confirm('确定要删除此题库吗？此操作不可恢复！')) {
      return;
    }
    
    setLoading(true);
    setLoadingAction(`delete-${id}`);
    
    try {
      // 调用API删除题库
      const response = await questionSetApi.deleteQuestionSet(id);
      
      if (response.success) {
        showStatusMessage('success', '题库删除成功');
        await loadQuestionSets();  // 重新加载全部题库
      } else {
        showStatusMessage('error', `删除题库失败: ${response.error || '未知错误'}`);
      }
    } catch (error) {
      logger.error('删除题库出错:', error);
      showStatusMessage('error', '删除题库时发生错误');
    } finally {
      setLoading(false);
      setLoadingAction('');
    }
  };

  // 显示生成兑换码模态框
  const handleShowGenerateCodeModal = (questionSet: QuestionSet): void => {
    setSelectedQuizForCode(questionSet);
    setShowRedeemCodeModal(true);
    setCodeDurationDays(30);
    setCodeQuantity(1);
    setGeneratedCodes([]);
  };

  // 生成兑换码
  const handleGenerateCode = async (): Promise<void> => {
    if (!selectedQuizForCode) return;
    
    setLoading(true);
    setLoadingAction('generate-code');
    
    try {
      // 调用API生成兑换码
      const response = await redeemCodeApi.generateRedeemCodes(
        selectedQuizForCode.id as string, 
        codeDurationDays,
        codeQuantity
      );
      
      if (response.success && response.data) {
        // Use any type to avoid conflicts
        setGeneratedCodes(response.data);
        showStatusMessage('success', `成功生成${response.data.length}个兑换码`);
        await loadRedeemCodes();  // 重新加载兑换码
      } else {
        showStatusMessage('error', `生成兑换码失败: ${response.error || '未知错误'}`);
      }
    } catch (error) {
      logger.error('生成兑换码出错:', error);
      showStatusMessage('error', '生成兑换码时发生错误');
    } finally {
      setLoading(false);
      setLoadingAction('');
    }
  };

  // 初始化添加问题的表单
  const handleAddQuestion = (): void => {
    // 重置问题表单
    setQuestionFormData({
      id: '',
      question: '',
      questionType: 'single',
      options: [
        { id: 'opt1', text: '' },
        { id: 'opt2', text: '' },
      ],
      correctAnswer: '',
      explanation: '',
    });
    setIsAddingQuestion(true);
    setCurrentQuestion(null);
    setShowQuestionModal(true);
  };

  // 编辑问题
  const handleEditQuestion = (question: ClientQuestion | Question, index: number): void => {
    setQuestionIndex(index);
    
    // Convert Question to ClientQuestion if needed
    const clientQuestion = isClientQuestion(question) 
      ? question 
      : {
          id: question.id as string,
          question: question.text || '',
          questionType: question.questionType as QuestionType || 'single',
          options: question.options || [],
          correctAnswer: question.correctAnswer || '',
          explanation: question.explanation || '',
        };
        
    setCurrentQuestion(clientQuestion);
    setQuestionFormData({
      id: clientQuestion.id,
      question: clientQuestion.question,
      questionType: clientQuestion.questionType,
      options: clientQuestion.options,
      correctAnswer: clientQuestion.correctAnswer,
      explanation: clientQuestion.explanation,
    });
    setShowQuestionModal(true);
  };
  
  // Helper to check if a question is ClientQuestion
  const isClientQuestion = (question: any): question is ClientQuestion => {
    return 'question' in question && typeof question.question === 'string';
  };

  // 删除问题
  const handleDeleteQuestion = (index: number): void => {
    if (!currentQuestionSet) return;
    
    if (!window.confirm('确定要删除此问题吗？此操作不可恢复！')) {
      return;
    }
    
    // Ensure questions is an array
    const questions = currentQuestionSet.questions || [];
    const updatedQuestions = [...questions] as Question[];
    updatedQuestions.splice(index, 1);
    
    setCurrentQuestionSet({
      ...currentQuestionSet,
      questions: updatedQuestions,
    });
    
    // 直接更新题库中的问题列表
    handleUpdateQuestions(updatedQuestions);
  };

  // 选择正确答案
  const handleSelectCorrectAnswer = (optionId: string): void => {
    if (questionFormData.questionType === 'single') {
      setQuestionFormData({
        ...questionFormData,
        correctAnswer: optionId,
      });
    } else {
      const currentAnswers = Array.isArray(questionFormData.correctAnswer) 
        ? [...questionFormData.correctAnswer] 
        : [];
      
      if (currentAnswers.includes(optionId)) {
        setQuestionFormData({
          ...questionFormData,
          correctAnswer: currentAnswers.filter((id) => id !== optionId),
        });
      } else {
        setQuestionFormData({
          ...questionFormData,
          correctAnswer: [...currentAnswers, optionId],
        });
      }
    }
  };

  // 修改选项文本
  const handleOptionChange = (index: number, text: string): void => {
    const updatedOptions = [...questionFormData.options];
    updatedOptions[index] = {
      ...updatedOptions[index],
      text,
    };
    
    setQuestionFormData({
      ...questionFormData,
      options: updatedOptions,
    });
  };

  // 添加新选项
  const handleAddOption = (): void => {
    const newOptionId = `opt${questionFormData.options.length + 1}`;
    setQuestionFormData({
      ...questionFormData,
      options: [...questionFormData.options, { id: newOptionId, text: '' }],
    });
  };

  // 删除选项
  const handleDeleteOption = (index: number): void => {
    if (questionFormData.options.length <= 2) return;
    
    const updatedOptions = [...questionFormData.options];
    const deletedOption = updatedOptions[index];
    updatedOptions.splice(index, 1);
    
    // 如果删除的是正确答案，需要更新correctAnswer
    let updatedCorrectAnswer = questionFormData.correctAnswer;
    
    if (questionFormData.questionType === 'single' && questionFormData.correctAnswer === deletedOption.id) {
      updatedCorrectAnswer = '';
    } else if (questionFormData.questionType === 'multiple' && Array.isArray(questionFormData.correctAnswer)) {
      updatedCorrectAnswer = questionFormData.correctAnswer.filter((id) => id !== deletedOption.id);
    }
    
    setQuestionFormData({
      ...questionFormData,
      options: updatedOptions,
      correctAnswer: updatedCorrectAnswer,
    });
  };

  // 直接添加问题到服务器
  const handleDirectAddQuestion = async (): Promise<void> => {
    if (!currentQuestionSet) return;
    
    // 验证表单
    if (!questionFormData.question) {
      showStatusMessage('error', '问题内容不能为空');
      return;
    }
    
    if (questionFormData.options.length < 2) {
      showStatusMessage('error', '至少需要两个选项');
      return;
    }
    
    if (questionFormData.options.some((opt) => !opt.text.trim())) {
      showStatusMessage('error', '选项内容不能为空');
      return;
    }
    
    if (
      (questionFormData.questionType === 'single' && !questionFormData.correctAnswer) ||
      (questionFormData.questionType === 'multiple' && 
       (!Array.isArray(questionFormData.correctAnswer) || questionFormData.correctAnswer.length === 0))
    ) {
      showStatusMessage('error', '请选择正确答案');
      return;
    }
    
    setLoading(true);
    setLoadingAction('addQuestion');
    
    try {
      // 转换问题格式为API格式
      const questionData = mapClientToApiQuestion(questionFormData);
      
      // 重要: 确保传入当前题库的ID
      const response = await questionApi.addQuestion(currentQuestionSet.id as string, questionData);
      
      if (response.success && response.data) {
        // 将API返回的问题转换为前端格式并添加到当前题库
        const apiQuestion = response.data as ApiQuestion;
        const clientQuestion = mapApiToClientQuestion(apiQuestion);
        
        // Ensure questions is an array
        const currentQuestions = currentQuestionSet.questions || [];
        // Use type assertion to avoid type conflicts
        const updatedQuestions = [...currentQuestions, clientQuestion as unknown as Question] as Question[];
        
        setCurrentQuestionSet({
          ...currentQuestionSet,
          questions: updatedQuestions,
        });
        
        showStatusMessage('success', '问题添加成功');
        setIsAddingQuestion(false);
        setShowQuestionModal(false);
        
        // 重置表单
        setQuestionFormData({
          id: '',
          question: '',
          questionType: 'single',
          options: [
            { id: 'opt1', text: '' },
            { id: 'opt2', text: '' },
          ],
          correctAnswer: '',
          explanation: '',
        });
      } else {
        showStatusMessage('error', `添加问题失败: ${response.error || '未知错误'}`);
      }
    } catch (error) {
      logger.error('添加问题出错:', error);
      showStatusMessage('error', '添加问题时发生错误');
    } finally {
      setLoading(false);
      setLoadingAction('');
    }
  };

  // 更新题库的问题列表
  const handleUpdateQuestions = async (questions: Question[]): Promise<void> => {
    if (!currentQuestionSet) return;
    
    setLoading(true);
    setLoadingAction('updateQuestions');
    
    try {
      // 更新题库中的问题列表
      const updatedQuestionSet = {
        ...currentQuestionSet,
        questions,
      };
      
      const response = await questionSetApi.updateQuestionSet(
        currentQuestionSet.id as string, 
        updatedQuestionSet
      );
      
      if (response.success && response.data) {
        showStatusMessage('success', '问题列表更新成功');
        // 更新本地状态
        setCurrentQuestionSet(response.data);
      } else {
        showStatusMessage('error', `更新问题列表失败: ${response.error || '未知错误'}`);
      }
    } catch (error) {
      logger.error('更新问题列表出错:', error);
      showStatusMessage('error', '更新问题列表时发生错误');
    } finally {
      setLoading(false);
      setLoadingAction('');
    }
  };

  // 直接更新问题
  const handleDirectUpdateQuestion = async (): Promise<void> => {
    if (!currentQuestionSet || !currentQuestion) return;
    
    // 验证表单
    if (!questionFormData.question) {
      showStatusMessage('error', '问题内容不能为空');
      return;
    }
    
    if (questionFormData.options.length < 2) {
      showStatusMessage('error', '至少需要两个选项');
      return;
    }
    
    if (questionFormData.options.some((opt) => !opt.text.trim())) {
      showStatusMessage('error', '选项内容不能为空');
      return;
    }
    
    if (
      (questionFormData.questionType === 'single' && !questionFormData.correctAnswer) ||
      (questionFormData.questionType === 'multiple' && 
       (!Array.isArray(questionFormData.correctAnswer) || questionFormData.correctAnswer.length === 0))
    ) {
      showStatusMessage('error', '请选择正确答案');
      return;
    }
    
    setLoading(true);
    setLoadingAction('updateQuestion');
    
    try {
      // 转换问题格式为API格式
      const questionData = mapClientToApiQuestion(questionFormData);
      
      // 调用API更新问题
      const response = await questionApi.updateQuestion(questionFormData.id, questionData);
      
      if (response.success && response.data) {
        // 将API返回的问题转换为前端格式
        const apiQuestion = response.data as ApiQuestion;
        const updatedQuestion = mapApiToClientQuestion(apiQuestion);
        
        // 更新题库中的问题
        const questions = currentQuestionSet.questions || [];
        const updatedQuestions = [...questions] as Question[];
        // Use double type assertion to avoid type conflicts
        updatedQuestions[questionIndex] = updatedQuestion as unknown as Question;
        
        setCurrentQuestionSet({
          ...currentQuestionSet,
          questions: updatedQuestions,
        });
        
        showStatusMessage('success', '问题更新成功');
        setCurrentQuestion(null);
        setShowQuestionModal(false);
      } else {
        showStatusMessage('error', `更新问题失败: ${response.error || '未知错误'}`);
      }
    } catch (error) {
      logger.error('更新问题出错:', error);
      showStatusMessage('error', '更新问题时发生错误');
    } finally {
      setLoading(false);
      setLoadingAction('');
    }
  };

  // 保存所有更改
  const handleSaveAllChanges = async (): Promise<void> => {
    setLoading(true);
    setLoadingAction('saveAll');
    
    try {
      await loadQuestionSets();
      showStatusMessage('success', '数据刷新成功');
    } catch (error) {
      logger.error('刷新数据出错:', error);
      showStatusMessage('error', '刷新数据时发生错误');
    } finally {
      setLoading(false);
      setLoadingAction('');
    }
  };

  // 渲染题库列表
  const renderQuestionSets = () => {
    if (filteredQuestionSets.length === 0) {
      return (
        <div className="text-center py-10 bg-gray-50 rounded">
          <p className="text-gray-500">没有找到匹配的题库</p>
        </div>
      );
    }
    
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredQuestionSets.map((questionSet) => (
          <div 
            key={questionSet.id as string} 
            className="bg-white p-5 rounded-lg shadow hover:shadow-md transition-shadow border border-gray-200"
          >
            <div className="flex justify-between items-start mb-4">
              <div className="flex items-center">
                <span className="text-2xl mr-2">{questionSet.icon || '📝'}</span>
                <h3 className="text-lg font-medium">{questionSet.title}</h3>
              </div>
              <div>
                {questionSet.isPaid && (
                  <span className="inline-block bg-yellow-100 text-yellow-800 text-xs px-2 py-1 rounded mr-1">
                    付费
                  </span>
                )}
                <span className="inline-block bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded">
                  {questionSet.category}
                </span>
              </div>
            </div>
            
            <p className="text-gray-600 text-sm mb-3 line-clamp-2">
              {questionSet.description || '没有描述'}
            </p>
            
            <div className="flex justify-between items-center text-sm text-gray-500 mb-4">
              <span>题目数量: {questionSet.questions?.length || 0}</span>
              <span>ID: {questionSet.id}</span>
            </div>
            
            <div className="flex justify-between pt-3 border-t border-gray-100">
              <div>
                <button 
                  className="text-blue-600 hover:text-blue-800 mr-3"
                  onClick={() => {
                    setCurrentQuestionSet(questionSet);
                    setShowQuestionModal(true);
                  }}
                >
                  管理题目
                </button>
                <button 
                  className="text-indigo-600 hover:text-indigo-800"
                  onClick={() => handleShowGenerateCodeModal(questionSet)}
                >
                  生成兑换码
                </button>
              </div>
              <div>
                <button 
                  className="text-green-600 hover:text-green-800 mr-3"
                  onClick={() => handleEditClick(questionSet)}
                >
                  编辑
                </button>
                <button 
                  className="text-red-600 hover:text-red-800"
                  onClick={() => handleDeleteQuestionSet(questionSet.id as string)}
                >
                  删除
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  };

  // 组件的返回语句 - 实际 UI 部分
  return (
    <div>
      {/* 问题管理模态框 */}
      <Modal
        title={currentQuestion ? '编辑题目' : '添加题目'}
        visible={showQuestionModal}
        onCancel={() => setShowQuestionModal(false)}
        footer={null}
        width={800}
        maskClosable={false}
      >
        <div className="mb-4">
          {errorMessage && <Alert message={errorMessage} type="error" className="mb-3" />}
          {successMessage && <Alert message={successMessage} type="success" className="mb-3" />}
          
          {/* 添加标题和题库信息 */}
          {currentQuestionSet && (
            <div className="mb-4">
              <h2 className="text-lg font-medium">
                题库: {currentQuestionSet.title} 
                <span className="ml-2 text-sm text-gray-500">
                  {currentQuestionSet.questions?.length || 0} 个问题
                </span>
              </h2>
            </div>
          )}
          
          {/* 添加问题列表 */}
          {currentQuestionSet && currentQuestionSet.questions && currentQuestionSet.questions.length > 0 && (
            <div className="mb-4">
              <h3 className="text-md font-medium mb-2">问题列表</h3>
              <div className="bg-gray-50 p-2 rounded max-h-60 overflow-y-auto">
                <table className="min-w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 px-3 w-8">#</th>
                      <th className="text-left py-2 px-3">问题内容</th>
                      <th className="text-left py-2 px-3 w-24">问题类型</th>
                      <th className="text-left py-2 px-3 w-24">操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {currentQuestionSet.questions.map((question, index) => (
                      <tr key={question.id} className="border-b hover:bg-gray-100">
                        <td className="py-2 px-3">{index + 1}</td>
                        <td className="py-2 px-3">
                          <div className="truncate max-w-md" title={question.question}>
                            {question.question}
                          </div>
                        </td>
                        <td className="py-2 px-3">
                          {question.questionType === 'single' ? '单选题' : '多选题'}
                        </td>
                        <td className="py-2 px-3">
                          <button 
                            className="text-blue-600 hover:text-blue-800 mr-2"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleEditQuestion(question, index);
                            }}
                          >
                            编辑
                          </button>
                          <button 
                            className="text-red-600 hover:text-red-800"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteQuestion(index);
                            }}
                          >
                            删除
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              
              <div className="mt-3 mb-4">
                <Button 
                  type="primary" 
                  onClick={handleAddQuestion}
                  icon={<PlusOutlined />}
                >
                  添加新问题
                </Button>
              </div>
              
              <div className="border-t border-gray-200 my-4"></div>
            </div>
          )}
          
          {/* 当前没有问题时显示提示 */}
          {currentQuestionSet && (!currentQuestionSet.questions || currentQuestionSet.questions.length === 0) && !currentQuestion && (
            <div className="text-center py-4 mb-4 bg-gray-50 rounded">
              <p className="text-gray-500 mb-3">当前题库还没有问题</p>
              <Button 
                type="primary" 
                onClick={handleAddQuestion}
                icon={<PlusOutlined />}
              >
                添加第一个问题
              </Button>
            </div>
          )}
          
          {/* 问题表单 - 当添加或编辑问题时显示 */}
          {(isAddingQuestion || currentQuestion) && (
            <div>
              <h3 className="text-md font-medium mb-2">
                {currentQuestion ? '编辑问题' : '添加新问题'}
              </h3>
              
              <Form layout="vertical">
                <Form.Item 
                  label="题目内容" 
                  required 
                  className="mb-3"
                >
                  <Input.TextArea
                    rows={4}
                    value={questionFormData.question}
                    onChange={(e) => setQuestionFormData({ ...questionFormData, question: e.target.value })}
                    placeholder="请输入题目内容"
                  />
                </Form.Item>
                
                <Form.Item 
                  label="题目解释（可选）" 
                  className="mb-3"
                >
                  <Input.TextArea
                    rows={2}
                    value={questionFormData.explanation}
                    onChange={(e) => setQuestionFormData({ ...questionFormData, explanation: e.target.value })}
                    placeholder="请输入题目解释（当用户答错时显示）"
                  />
                </Form.Item>
                
                <Form.Item 
                  label="题目类型" 
                  required
                  className="mb-3"
                >
                  <Radio.Group
                    options={[
                      { label: '单选题', value: 'single' },
                      { label: '多选题', value: 'multiple' },
                    ]}
                    onChange={(e) => {
                      const newType = e.target.value;
                      setQuestionFormData({
                        ...questionFormData,
                        questionType: newType,
                        correctAnswer: newType === 'single' ? '' : [],
                      });
                    }}
                    value={questionFormData.questionType}
                    optionType="button"
                  />
                </Form.Item>
                
                <Form.Item 
                  label="选项" 
                  required
                  className="mb-3"
                >
                  <div className="mb-2">
                    {questionFormData.options.map((option, index) => (
                      <div key={option.id} className="flex items-center mb-2">
                        <div className="mr-2 w-6">
                          {questionFormData.questionType === 'single' ? (
                            <Radio
                              checked={questionFormData.correctAnswer === option.id}
                              onChange={(e) => handleSelectCorrectAnswer(option.id)}
                            />
                          ) : (
                            <Checkbox
                              checked={Array.isArray(questionFormData.correctAnswer) && 
                                     questionFormData.correctAnswer.includes(option.id)}
                              onChange={(e) => handleSelectCorrectAnswer(option.id)}
                            />
                          )}
                        </div>
                        <Input
                          value={option.text}
                          onChange={(e) => handleOptionChange(index, e.target.value)}
                          placeholder={`选项 ${index + 1}`}
                          className="flex-1 mr-2"
                        />
                        <Button
                          type="text"
                          danger
                          icon={<DeleteOutlined />}
                          onClick={() => handleDeleteOption(index)}
                          disabled={questionFormData.options.length <= 2}
                        />
                      </div>
                    ))}
                  </div>
                  <Button 
                    type="dashed" 
                    onClick={handleAddOption} 
                    block
                    icon={<PlusOutlined />}
                  >
                    添加选项
                  </Button>
                </Form.Item>
                
                {/* 表单底部按钮 */}
                <div className="mt-6 flex justify-end">
                  <Button 
                    onClick={() => {
                      setIsAddingQuestion(false);
                      setCurrentQuestion(null);
                    }} 
                    className="mr-2"
                    disabled={loading}
                  >
                    取消
                  </Button>
                  {currentQuestion ? (
                    <Button
                      type="primary"
                      onClick={handleDirectUpdateQuestion}
                      loading={loading && loadingAction === 'updateQuestion'}
                    >
                      更新题目
                    </Button>
                  ) : (
                    <Button
                      type="primary"
                      onClick={handleDirectAddQuestion}
                      loading={loading && loadingAction === 'addQuestion'}
                    >
                      添加题目
                    </Button>
                  )}
                </div>
              </Form>
            </div>
          )}
        </div>
      </Modal>
      
      {/* 兑换码生成模态框 */}
      <Modal
        title="生成兑换码"
        visible={showRedeemCodeModal}
        onCancel={() => setShowRedeemCodeModal(false)}
        footer={null}
        width={600}
      >
        <div className="mb-4">
          {errorMessage && <Alert message={errorMessage} type="error" className="mb-3" />}
          {successMessage && <Alert message={successMessage} type="success" className="mb-3" />}
          
          <Form layout="vertical">
            <Form.Item
              label="题库"
              className="mb-3"
            >
              <Input 
                disabled 
                value={selectedQuizForCode?.title || ''}
              />
            </Form.Item>
            
            <Form.Item
              label="有效期(天)"
              className="mb-3"
            >
              <Input
                type="number"
                min={1}
                max={365}
                value={codeDurationDays}
                onChange={(e) => setCodeDurationDays(parseInt(e.target.value) || 30)}
              />
            </Form.Item>
            
            {generatedCodes.length > 0 && (
              <Alert
                message="兑换码已生成"
                description={
                  <div>
                    <p>兑换码: <strong>{generatedCodes.map((code) => code.code).join(', ')}</strong></p>
                    <p>有效期至: {generatedCodes.map((code) => new Date(code.expiryDate).toLocaleString()).join(', ')}</p>
                  </div>
                }
                type="success"
                className="mb-4"
              />
            )}
            
            <div className="flex justify-end">
              <Button
                onClick={() => setShowRedeemCodeModal(false)}
                className="mr-2"
              >
                关闭
              </Button>
              <Button
                type="primary"
                onClick={handleGenerateCode}
                loading={loading && loadingAction === 'generate-code'}
                disabled={!selectedQuizForCode}
              >
                生成兑换码
              </Button>
            </div>
          </Form>
        </div>
      </Modal>

      {/* 创建题库模态框 */}
      <Modal
        title="创建新题库"
        visible={showCreateForm}
        onCancel={() => setShowCreateForm(false)}
        footer={null}
        width={700}
      >
        <div className="mb-4">
          {errorMessage && <Alert message={errorMessage} type="error" className="mb-3" />}
          {successMessage && <Alert message={successMessage} type="success" className="mb-3" />}
          
          <Form layout="vertical">
            <Form.Item 
              label="题库ID" 
              required 
              className="mb-3"
            >
              <Input
                name="id"
                value={formData.id}
                onChange={handleFormChange}
                placeholder="请输入唯一ID，例如：network-101"
              />
            </Form.Item>
            
            <Form.Item 
              label="标题" 
              required 
              className="mb-3"
            >
              <Input
                name="title"
                value={formData.title}
                onChange={handleFormChange}
                placeholder="请输入题库标题"
              />
            </Form.Item>
            
            <Form.Item 
              label="描述" 
              className="mb-3"
            >
              <Input.TextArea
                rows={3}
                name="description"
                value={formData.description}
                onChange={handleFormChange}
                placeholder="请输入题库描述（可选）"
              />
            </Form.Item>
            
            <Form.Item 
              label="分类" 
              required 
              className="mb-3"
            >
              <select
                name="category"
                value={formData.category}
                onChange={handleFormChange}
                className="w-full border border-gray-300 rounded px-3 py-2"
              >
                <option value="">选择分类</option>
                {categoryOptions.map((category) => (
                  <option key={category} value={category}>{category}</option>
                ))}
              </select>
            </Form.Item>
            
            <Form.Item 
              label="图标" 
              className="mb-3"
            >
              <div className="flex flex-wrap gap-2">
                {iconOptions.map((icon) => (
                  <div
                    key={icon}
                    onClick={() => setFormData({ ...formData, icon })}
                    className={`text-2xl p-2 border rounded cursor-pointer ${formData.icon === icon ? 'border-blue-500 bg-blue-50' : 'border-gray-300'}`}
                  >
                    {icon}
                  </div>
                ))}
              </div>
            </Form.Item>
            
            <Form.Item 
              label="付费设置" 
              className="mb-3"
            >
              <div className="mb-2">
                <input
                  type="checkbox"
                  name="isPaid"
                  checked={formData.isPaid}
                  onChange={handleFormChange}
                  id="isPaid"
                  className="mr-2"
                />
                <label htmlFor="isPaid">设为付费题库</label>
              </div>
              
              {formData.isPaid && (
                <>
                  <div className="ml-5 mb-2">
                    <label htmlFor="price" className="block mb-1">价格 (¥)</label>
                    <Input
                      type="number"
                      name="price"
                      value={formData.price}
                      onChange={handleFormChange}
                      placeholder="请输入价格"
                      min={0.01}
                      step={0.01}
                    />
                  </div>
                  
                  <div className="ml-5">
                    <label htmlFor="trialQuestions" className="block mb-1">试用题目数量</label>
                    <Input
                      type="number"
                      name="trialQuestions"
                      value={formData.trialQuestions}
                      onChange={handleFormChange}
                      placeholder="免费试用的题目数量"
                      min={0}
                    />
                  </div>
                </>
              )}
            </Form.Item>
            
            <div className="flex justify-end mt-4">
              <Button 
                onClick={() => setShowCreateForm(false)} 
                className="mr-2"
              >
                取消
              </Button>
              <Button 
                type="primary" 
                onClick={handleCreateSubmit}
                loading={loading && loadingAction === 'create'}
              >
                创建题库
              </Button>
            </div>
          </Form>
        </div>
      </Modal>
      
      {/* 编辑题库模态框 */}
      <Modal
        title="编辑题库"
        visible={showEditForm}
        onCancel={() => setShowEditForm(false)}
        footer={null}
        width={700}
      >
        <div className="mb-4">
          {errorMessage && <Alert message={errorMessage} type="error" className="mb-3" />}
          {successMessage && <Alert message={successMessage} type="success" className="mb-3" />}
          
          <Form layout="vertical">
            <Form.Item 
              label="题库ID" 
              required 
              className="mb-3"
            >
              <Input
                name="id"
                value={formData.id}
                disabled={true}  // 编辑时不允许修改ID
                placeholder="题库ID"
              />
            </Form.Item>
            
            <Form.Item 
              label="标题" 
              required 
              className="mb-3"
            >
              <Input
                name="title"
                value={formData.title}
                onChange={handleFormChange}
                placeholder="请输入题库标题"
              />
            </Form.Item>
            
            <Form.Item 
              label="描述" 
              className="mb-3"
            >
              <Input.TextArea
                rows={3}
                name="description"
                value={formData.description}
                onChange={handleFormChange}
                placeholder="请输入题库描述（可选）"
              />
            </Form.Item>
            
            <Form.Item 
              label="分类" 
              required 
              className="mb-3"
            >
              <select
                name="category"
                value={formData.category}
                onChange={handleFormChange}
                className="w-full border border-gray-300 rounded px-3 py-2"
              >
                <option value="">选择分类</option>
                {categoryOptions.map((category) => (
                  <option key={category} value={category}>{category}</option>
                ))}
              </select>
            </Form.Item>
            
            <Form.Item 
              label="图标" 
              className="mb-3"
            >
              <div className="flex flex-wrap gap-2">
                {iconOptions.map((icon) => (
                  <div
                    key={icon}
                    onClick={() => setFormData({ ...formData, icon })}
                    className={`text-2xl p-2 border rounded cursor-pointer ${formData.icon === icon ? 'border-blue-500 bg-blue-50' : 'border-gray-300'}`}
                  >
                    {icon}
                  </div>
                ))}
              </div>
            </Form.Item>
            
            <Form.Item 
              label="付费设置" 
              className="mb-3"
            >
              <div className="mb-2">
                <input
                  type="checkbox"
                  name="isPaid"
                  checked={formData.isPaid}
                  onChange={handleFormChange}
                  id="editIsPaid"
                  className="mr-2"
                />
                <label htmlFor="editIsPaid">设为付费题库</label>
              </div>
              
              {formData.isPaid && (
                <>
                  <div className="ml-5 mb-2">
                    <label htmlFor="editPrice" className="block mb-1">价格 (¥)</label>
                    <Input
                      type="number"
                      name="price"
                      value={formData.price}
                      onChange={handleFormChange}
                      placeholder="请输入价格"
                      min={0.01}
                      step={0.01}
                      id="editPrice"
                    />
                  </div>
                  
                  <div className="ml-5">
                    <label htmlFor="editTrialQuestions" className="block mb-1">试用题目数量</label>
                    <Input
                      type="number"
                      name="trialQuestions"
                      value={formData.trialQuestions}
                      onChange={handleFormChange}
                      placeholder="免费试用的题目数量"
                      min={0}
                      id="editTrialQuestions"
                    />
                  </div>
                </>
              )}
            </Form.Item>
            
            <div className="flex justify-end mt-4">
              <Button 
                onClick={() => setShowEditForm(false)} 
                className="mr-2"
              >
                取消
              </Button>
              <Button 
                type="primary" 
                onClick={handleEditSubmit}
                loading={loading && loadingAction === 'edit'}
              >
                保存修改
              </Button>
            </div>
          </Form>
        </div>
      </Modal>
      
      {/* 主要UI内容 */}
      <div className="container mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold">题库管理</h1>
          <div className="flex space-x-2">
            <Button 
              type="primary"
              onClick={handleSaveAllChanges}
              loading={loading && loadingAction === 'saveAll'}
              className="mr-2"
            >
              刷新题库数据
            </Button>
            <Button
              type="primary" 
              onClick={() => setShowCreateForm(true)}
            >
              添加题库
            </Button>
          </div>
        </div>
        
        {/* 状态消息显示 */}
        {statusMessage.type && (
          <Alert
            message={statusMessage.message}
            type={statusMessage.type as any}
            className="mb-4"
            closable
          />
        )}
        
        {/* 搜索栏 */}
        <div className="mb-6">
          <Input
            placeholder="搜索题库..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full max-w-md"
          />
        </div>
        
        {/* 题库列表 */}
        {loadingQuestionSets ? (
          <div className="text-center py-10">
            <p className="text-gray-500">加载中...</p>
          </div>
        ) : (
          renderQuestionSets()
        )}
      </div>
    </div>
  );
};

export default AdminQuestionSets;
