// @ts-nocheck - 禁用 TypeScript 未使用变量检查，这些变量和函数在完整 UI 中会被使用
import React, { useState, useEffect, useCallback } from 'react';
import { questionSets as defaultQuestionSets } from '../../data/questionSets';
import { Question as ClientQuestion, Option, QuestionType } from '../../data/questions';
import { QuestionSet as ClientQuestionSet } from '../../data/questionSets';
import { RedeemCode, QuestionSet as ApiQuestionSet } from '../../types';
import { useUser } from '../../contexts/UserContext';
import { questionSetApi } from '../../utils/api';
import axios from 'axios';  // 添加axios导入
import Modal from 'react-modal';
import { Alert, Form, Input, Radio, Button, Checkbox } from 'antd';
import { PlusOutlined, DeleteOutlined } from '@ant-design/icons';

// Function to convert API question sets to client format
const mapApiToClientQuestionSet = (apiSet: ApiQuestionSet): ClientQuestionSet => {
  return {
    id: apiSet.id,
    title: apiSet.title,
    description: apiSet.description || '',
    category: apiSet.category,
    icon: apiSet.icon || '📝',
    isPaid: apiSet.isPaid || false,
    price: apiSet.price || 0,
    trialQuestions: apiSet.trialQuestions || 0,
    questions: (apiSet.questions || []).map(q => ({
      id: typeof q.id === 'string' ? parseInt(q.id.replace(/\D/g, '')) || Date.now() : q.id || Date.now(),
      question: q.text || '',
      questionType: (q as any).questionType as QuestionType || 'single',
      options: (q.options || []).map(o => ({
        id: o.id || '',
        text: o.text
      })),
      correctAnswer: (q as any).correctAnswer || '',
      explanation: q.explanation || ''
    }))
  };
};

// Function to convert client question sets to API format
const mapClientToApiQuestionSet = (clientSet: ClientQuestionSet): Partial<ApiQuestionSet> => {
  return {
    id: clientSet.id,
    title: clientSet.title,
    description: clientSet.description,
    category: clientSet.category,
    icon: clientSet.icon,
    isPaid: clientSet.isPaid,
    price: clientSet.isPaid ? clientSet.price : undefined,
    trialQuestions: clientSet.isPaid ? clientSet.trialQuestions : undefined,
    questions: clientSet.questions.map(q => {
      // 检查ID是否是数字格式（前端生成的临时ID）
      const isTemporaryId = typeof q.id === 'number';
      
      return {
        // 如果是临时ID，不发送ID字段，让后端自动生成UUID
        ...(isTemporaryId ? {} : { id: q.id.toString() }),
        text: q.question,
        questionType: q.questionType,
        explanation: q.explanation,
        options: q.options.map(opt => ({
          // 选项ID保留，因为它们是A、B、C、D格式，用于匹配正确答案
          id: opt.id,
          text: opt.text,
          isCorrect: Array.isArray(q.correctAnswer) 
            ? q.correctAnswer.includes(opt.id)
            : q.correctAnswer === opt.id
        }))
      };
    })
  };
};

const AdminQuestionSets = () => {
  const { generateRedeemCode, getRedeemCodes } = useUser();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusMessage, setStatusMessage] = useState({ type: '', message: '' });
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showEditForm, setShowEditForm] = useState(false);
  const [localQuestionSets, setLocalQuestionSets] = useState<ClientQuestionSet[]>([]);
  const [currentQuestionSet, setCurrentQuestionSet] = useState<ClientQuestionSet | null>(null);
  const [formData, setFormData] = useState({
    id: '',
    title: '',
    description: '',
    category: '',
    icon: '📝',
    isPaid: false,
    price: 29.9,
    trialQuestions: 0,
    questions: [] as ClientQuestion[]
  });
  const [loading, setLoading] = useState(false);
  const [loadingQuestionSets, setLoadingQuestionSets] = useState(true);
  const [loadingAction, setLoadingAction] = useState('');

  // 新增状态 - 兑换码相关
  const [redeemCodes, setRedeemCodes] = useState<RedeemCode[]>([]);
  const [showRedeemCodeModal, setShowRedeemCodeModal] = useState(false);
  const [selectedQuizForCode, setSelectedQuizForCode] = useState<ClientQuestionSet | null>(null);
  const [codeDurationDays, setCodeDurationDays] = useState(30);
  const [generatedCode, setGeneratedCode] = useState<RedeemCode | null>(null);
  const [codeFilterStatus, setCodeFilterStatus] = useState('all');
  const [codeFilterQuizId, setCodeFilterQuizId] = useState<string | null>(null);

  // 新增状态 - 题目管理相关
  const [showQuestionModal, setShowQuestionModal] = useState(false);
  const [currentQuestion, setCurrentQuestion] = useState<ClientQuestion | null>(null);
  const [questionFormData, setQuestionFormData] = useState<{
    id: number;
    question: string;
    questionType: 'single' | 'multiple';
    options: Option[];
    correctAnswer: string | string[];
    explanation: string;
  }>({
    id: 0,
    question: '',
    questionType: 'single',
    options: [],
    correctAnswer: '',
    explanation: ''
  });
  const [optionInput, setOptionInput] = useState({ id: '', text: '' });
  const [questionIndex, setQuestionIndex] = useState<number>(-1);
  const [isAddingQuestion, setIsAddingQuestion] = useState(false);

  // 新增状态 - 文件上传相关
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // 加载所有兑换码
  useEffect(() => {
    const loadRedeemCodes = async () => {
      try {
        const codes = await getRedeemCodes();
        setRedeemCodes(codes);
      } catch (error) {
        console.error("加载兑换码失败:", error);
      }
    };
    
    loadRedeemCodes();
  }, [getRedeemCodes]);

  // 从API加载题库数据
  const loadQuestionSets = async () => {
    setLoadingQuestionSets(true);
    try {
      console.log("正在从API加载题库...");
      const response = await questionSetApi.getAllQuestionSets();
      console.log("API响应:", response);
      
      if (response.success && response.data) {
        // 确保response.data是数组
        if (Array.isArray(response.data)) {
          // Convert API format to client format
          const clientQuestionSets = response.data.map(mapApiToClientQuestionSet);
          setLocalQuestionSets(clientQuestionSets);
          console.log("成功加载题库:", clientQuestionSets.length);
        } else {
          console.error("API返回的题库数据不是数组:", response.data);
          showStatusMessage('error', '题库数据格式不正确');
          // 使用本地数据作为备份
          setLocalQuestionSets(defaultQuestionSets);
        }
      } else {
        console.error("加载题库失败:", response.error || response.message);
        showStatusMessage('error', `加载题库失败: ${response.error || response.message || '未知错误'}`);
        // 如果API加载失败，回退到本地数据
        setLocalQuestionSets(defaultQuestionSets);
      }
    } catch (error) {
      console.error("加载题库出错:", error);
      showStatusMessage('error', '加载题库时出现错误，使用本地数据');
      // 如果API加载失败，回退到本地数据
      setLocalQuestionSets(defaultQuestionSets);
    } finally {
      setLoadingQuestionSets(false);
    }
  };

  // 初始加载和自动刷新题库数据
  useEffect(() => {
    // 初始加载
    loadQuestionSets();
    
    // 设置定时器，每60秒自动刷新一次
    const refreshInterval = setInterval(() => {
      loadQuestionSets();
    }, 60000);
    
    // 在组件卸载时清除定时器
    return () => clearInterval(refreshInterval);
  }, []);

  // 搜索过滤题库
  const filteredQuestionSets = localQuestionSets.filter(set => 
    set.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
    set.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
    set.description.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // 显示状态消息
  const showStatusMessage = (type: string, message: string) => {
    setStatusMessage({ type, message });
    setTimeout(() => setStatusMessage({ type: '', message: '' }), 3000);
  };

  // 处理表单字段变化
  const handleFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    
    // 处理复选框
    if (type === 'checkbox') {
      const checked = (e.target as HTMLInputElement).checked;
      setFormData(prev => ({
        ...prev,
        [name]: checked
      }));
      return;
    }
    
    // 处理数字输入
    if (type === 'number') {
      const numberValue = parseFloat(value);
      setFormData(prev => ({
        ...prev,
        [name]: isNaN(numberValue) ? 0 : numberValue
      }));
      return;
    }
    
    // 处理普通文本输入
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // 处理创建题库提交 - 使用API
  const handleCreateSubmit = async () => {
    // 验证表单
    if (!formData.id || !formData.title || !formData.category) {
      showStatusMessage('error', '请填写所有必填字段');
      return;
    }

    // 检查ID是否已存在
    if (localQuestionSets.some(set => set.id === formData.id)) {
      showStatusMessage('error', 'ID已存在，请使用另一个ID');
      return;
    }

    // 验证付费题库的价格
    if (formData.isPaid && (formData.price <= 0 || isNaN(formData.price))) {
      showStatusMessage('error', '付费题库需要设置有效的价格');
      return;
    }

    // 准备API格式的问题数据
    const questionSetData = mapClientToApiQuestionSet({
      ...formData,
      questions: formData.questions
    });

    // 确保正确设置Content-Type
    const token = localStorage.getItem('token');
    const headers = {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {})
    };

    console.log('准备发送的题库数据:', JSON.stringify(questionSetData));
    console.log('请求头:', headers);

    setLoading(true);
    setLoadingAction('create');

    try {
      // 使用fetch直接发送请求，不使用axios
      const response = await fetch('/api/question-sets', {
        method: 'POST',
        headers: headers,
        body: JSON.stringify(questionSetData)
      });
      
      console.log('响应状态:', response.status);
      let responseData;
      
      try {
        responseData = await response.json();
        console.log('创建题库响应:', responseData);
      } catch (parseError) {
        console.error('解析JSON响应失败:', parseError);
        const textResponse = await response.text();
        console.log('原始响应文本:', textResponse);
        responseData = { success: false, message: '无法解析服务器响应' };
      }

      if (response.ok) {
        // 重新获取题库列表
        await loadQuestionSets();
        
        // 重置表单
        setFormData({
          id: '',
          title: '',
          description: '',
          category: '',
          icon: '📝',
          isPaid: false,
          price: 29.9,
          trialQuestions: 0,
          questions: []
        });
        
        showStatusMessage('success', '题库创建成功');
        setShowCreateForm(false); // 关闭模态框
      } else {
        showStatusMessage('error', responseData?.message || `服务器返回错误: ${response.status}`);
      }
    } catch (error) {
      console.error('创建题库错误:', error);
      showStatusMessage('error', error.message || '创建题库失败');
    } finally {
      setLoading(false);
      setLoadingAction('');
    }
  };

  // 打开编辑表单
  const handleEditClick = (questionSet: ClientQuestionSet) => {
    setCurrentQuestionSet(questionSet);
    setFormData({
      id: questionSet.id,
      title: questionSet.title,
      description: questionSet.description,
      category: questionSet.category,
      icon: questionSet.icon,
      isPaid: questionSet.isPaid || false,
      price: questionSet.price || 29.9,
      trialQuestions: questionSet.trialQuestions || 0,
      questions: questionSet.questions
    });
    setShowEditForm(true);
  };

  // 处理编辑题库提交 - 使用API
  const handleEditSubmit = async () => {
    if (!currentQuestionSet) return;
    
    // 验证表单
    if (!formData.title || !formData.category) {
      showStatusMessage('error', '请填写所有必填字段');
      return;
    }

    // 验证付费题库的价格
    if (formData.isPaid && (formData.price <= 0 || isNaN(formData.price))) {
      showStatusMessage('error', '付费题库需要设置有效的价格');
      return;
    }

    // 转换为API格式
    const questionSetData = mapClientToApiQuestionSet({
      ...formData,
      questions: formData.questions
    });

    setLoading(true);
    setLoadingAction('edit');
    
    try {
      const response = await questionSetApi.updateQuestionSet(formData.id, questionSetData);
      
      if (response.success && response.data) {
        // 获取最新的题库数据
        await loadQuestionSets();
        
        // 显示成功消息
        showStatusMessage('success', '题库更新成功！');
        
        // 重置表单并关闭
        setCurrentQuestionSet(null);
        setShowEditForm(false);
      } else {
        // 显示错误消息
        showStatusMessage('error', `更新题库失败: ${response.error || response.message || '未知错误'}`);
      }
    } catch (error) {
      console.error('更新题库时出错:', error);
      showStatusMessage('error', '更新题库时出现错误');
    } finally {
      setLoading(false);
      setLoadingAction('');
    }
  };

  // 处理删除题库 - 使用API
  const handleDeleteQuestionSet = async (id: string) => {
    if (window.confirm('确定要删除此题库吗？此操作不可逆。')) {
      setLoading(true);
      setLoadingAction('delete');
      
      try {
        // 直接使用axios而不是通过questionSetApi
        const response = await axios.delete(`/api/question-sets/${id}`, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          }
        });
        
        if (response.status === 200 || response.status === 204) {
          // 从列表中移除题库并刷新数据
          await loadQuestionSets();
          
          // 显示成功消息
          showStatusMessage('success', '题库删除成功！');
        } else {
          // 显示错误消息
          showStatusMessage('error', `删除题库失败: ${response.data?.message || '未知错误'}`);
        }
      } catch (error) {
        console.error('删除题库时出错:', error);
        // 提供更详细的错误信息
        const errorMessage = error.response?.data?.message || error.message || '删除题库时出现错误';
        showStatusMessage('error', errorMessage);
        
        // 如果是404错误（题库已被删除或不存在），仍然从本地移除并刷新数据
        if (error.response?.status === 404) {
          await loadQuestionSets();
          showStatusMessage('warning', '题库可能已被删除或不存在，已从列表中移除');
        }
      } finally {
        setLoading(false);
        setLoadingAction('');
      }
    }
  };

  // 可用的图标选项
  const iconOptions = ['📝', '📚', '🧠', '🔍', '💻', '🌐', '🔐', '📊', '⚙️', '🗄️', '📡', '🧮'];
  
  // 可用的分类选项
  const categoryOptions = ['网络协议', '编程语言', '计算机基础', '数据库', '操作系统', '安全技术', '云计算', '人工智能'];

  // 重新添加弹窗显示函数，并在按钮点击处调用
  const handleShowGenerateCodeModal = (questionSet: ClientQuestionSet) => {
    setSelectedQuizForCode(questionSet);
    setCodeDurationDays(30); // 默认30天
    setGeneratedCode(null);
    setShowRedeemCodeModal(true);
  };

  // 生成兑换码
  const handleGenerateCode = async () => {
    if (!selectedQuizForCode) return;
    
    try {
      // 添加quantity参数，默认生成1个兑换码
      const quantity = 1;
      const result = await generateRedeemCode(selectedQuizForCode.id, codeDurationDays, quantity);
      
      if (result.success && result.codes && result.codes.length > 0) {
        // 添加新生成的兑换码到列表中
        setRedeemCodes(prevCodes => [...prevCodes, ...(result.codes || [])]);
        // 显示第一个生成的码
        setGeneratedCode(result.codes[0]);
        showStatusMessage("success", `已成功生成兑换码: ${result.codes[0].code}`);
      } else {
        showStatusMessage("error", result.message || "生成兑换码失败");
      }
    } catch (error) {
      if (error instanceof Error) {
        showStatusMessage("error", error.message);
      } else {
        showStatusMessage("error", "生成兑换码失败");
      }
    }
  };

  // 显示题库管理界面，包含添加题目和查看题目功能
  const handleManageQuestions = (questionSet: ClientQuestionSet) => {
    setCurrentQuestionSet({...questionSet});
    setShowQuestionModal(true);
    setCurrentQuestion(null);
    setIsAddingQuestion(true);
    
    // 初始化新题目表单
    setQuestionFormData({
      id: Date.now(),
      question: '',
      questionType: 'single',
      options: [
        { id: 'A', text: '' },
        { id: 'B', text: '' },
        { id: 'C', text: '' },
        { id: 'D', text: '' },
      ],
      correctAnswer: '',
      explanation: ''
    });
  };

  // 处理添加新题目
  const handleAddQuestion = () => {
    setIsAddingQuestion(true);
    setCurrentQuestion(null);
    setQuestionIndex(-1); // 明确设置为-1表示是添加而不是编辑
    setQuestionFormData({
      id: Date.now(),
      question: '',
      questionType: 'single',
      options: [
        { id: 'A', text: '' },
        { id: 'B', text: '' },
        { id: 'C', text: '' },
        { id: 'D', text: '' },
      ],
      correctAnswer: '',
      explanation: ''
    });
  };

  // 处理编辑题目
  const handleEditQuestion = (question: ClientQuestion, index: number) => {
    setIsAddingQuestion(false);
    setCurrentQuestion(question);
    setQuestionIndex(index);
    setQuestionFormData({
      id: question.id,
      question: question.question,
      questionType: question.questionType,
      options: [...question.options],
      correctAnswer: question.correctAnswer,
      explanation: question.explanation
    });
  };

  // 处理删除题目 - 直接调用API
  const handleDeleteQuestion = (index: number) => {
    if (!currentQuestionSet) return;
    
    if (window.confirm('确定要删除这个题目吗？此操作不可逆。')) {
      const questionId = currentQuestionSet.questions[index].id;
      // 直接调用API删除
      handleDirectDeleteQuestion(questionId);
    }
  };

  // 处理题目表单字段变化
  const handleQuestionFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setQuestionFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // 处理添加选项
  const handleAddOption = () => {
    if (!optionInput.text.trim()) {
      showStatusMessage('error', '选项内容不能为空');
      return;
    }
    
    // 生成选项ID，使用字母A, B, C, D等
    const nextOptionId = String.fromCharCode(65 + questionFormData.options.length); // A=65 in ASCII
    
    const newOption: Option = {
      id: nextOptionId,
      text: optionInput.text
    };
    
    // 添加新选项
    const updatedOptions = [...questionFormData.options, newOption];
    
    // 如果是第一个选项，自动设为正确答案
    let updatedCorrectAnswer = questionFormData.correctAnswer;
    if (questionFormData.options.length === 0) {
      if (questionFormData.questionType === 'single') {
        updatedCorrectAnswer = newOption.id;
      } else {
        updatedCorrectAnswer = [newOption.id];
      }
    }
    
    setQuestionFormData(prev => ({
      ...prev,
      options: updatedOptions,
      correctAnswer: updatedCorrectAnswer
    }));
    
    // 重置选项输入
    setOptionInput({ id: '', text: '' });
  };
  
  // 处理选项文本变更
  const handleOptionChange = (index: number, newText: string) => {
    const updatedOptions = [...questionFormData.options];
    updatedOptions[index] = {
      ...updatedOptions[index],
      text: newText
    };
    
    setQuestionFormData(prev => ({
      ...prev,
      options: updatedOptions
    }));
  };

  // 处理选项被选为正确答案
  const handleSelectCorrectAnswer = (optionId: string) => {
    if (questionFormData.questionType === 'single') {
      // 单选题：设置正确答案为选中的选项ID
      setQuestionFormData(prev => ({
        ...prev,
        correctAnswer: optionId
      }));
    } else {
      // 多选题：将选项ID添加/移除到正确答案数组
      const currentAnswers = Array.isArray(questionFormData.correctAnswer) 
        ? [...questionFormData.correctAnswer] 
        : [];
      
      const index = currentAnswers.indexOf(optionId);
      if (index === -1) {
        // 添加到正确答案
        currentAnswers.push(optionId);
      } else {
        // 从正确答案中移除
        currentAnswers.splice(index, 1);
      }
      
      setQuestionFormData(prev => ({
        ...prev,
        correctAnswer: currentAnswers
      }));
    }
  };

  // 处理问题类型变更（单选/多选）
  const handleQuestionTypeChange = (type: QuestionType) => {
    // 如果从多选变为单选，且有多个正确答案，只保留第一个
    let newCorrectAnswer = questionFormData.correctAnswer;
    
    if (type === 'single' && Array.isArray(questionFormData.correctAnswer) && questionFormData.correctAnswer.length > 0) {
      newCorrectAnswer = questionFormData.correctAnswer[0];
    } else if (type === 'multiple' && !Array.isArray(questionFormData.correctAnswer)) {
      // 从单选变多选，将单个答案转为数组
      newCorrectAnswer = questionFormData.correctAnswer ? [questionFormData.correctAnswer] : [];
    }
    
    setQuestionFormData(prev => ({
      ...prev,
      questionType: type,
      correctAnswer: newCorrectAnswer
    }));
  };

  // 处理删除选项
  const handleDeleteOption = (index: number) => {
    const updatedOptions = [...questionFormData.options];
    const removedOption = updatedOptions[index];
    updatedOptions.splice(index, 1);
    
    // 更新正确答案
    let updatedCorrectAnswer = questionFormData.correctAnswer;
    
    if (questionFormData.questionType === 'single' && questionFormData.correctAnswer === removedOption.id) {
      // 如果删除的是单选题的正确答案，则清空正确答案
      updatedCorrectAnswer = '';
    } else if (questionFormData.questionType === 'multiple' && Array.isArray(questionFormData.correctAnswer)) {
      // 如果删除的是多选题的某个正确答案，则从正确答案数组中移除
      updatedCorrectAnswer = questionFormData.correctAnswer.filter(id => id !== removedOption.id);
    }
    
    setQuestionFormData(prev => ({
      ...prev,
      options: updatedOptions,
      correctAnswer: updatedCorrectAnswer
    }));
  };

  // 新增函数：关闭题目模态框并重置状态
  const handleCloseQuestionModal = () => {
    setShowQuestionModal(false);
    setIsAddingQuestion(true); // 确保下次打开时默认是添加模式
    setQuestionIndex(-1);
    setCurrentQuestion(null);
  };

  // 保存题目到题库 - 直接调用API
  const handleSaveQuestion = async () => {
    try {
      if (currentQuestion) {
        // 如果是编辑现有题目，调用更新API
        await handleDirectUpdateQuestion();
      } else {
        // 如果是添加新题目，调用添加API
        await handleDirectAddQuestion();
      }
    } catch (error) {
      console.error("保存题目失败:", error);
      showStatusMessage('error', '保存题目失败');
    }
  };

  // 刷新题库数据
  const handleSaveAllChanges = async () => {
    try {
      setLoadingAction('saveAll');
      setLoading(true);
      
      // 直接刷新数据，不进行批量更新
      await loadQuestionSets();
      showStatusMessage('success', '题库数据已刷新！');
    } catch (error) {
      console.error('刷新题库失败:', error);
      showStatusMessage('error', '刷新题库失败: ' + (error.response?.data?.message || error.message || '请重试'));
    } finally {
      setLoading(false);
      setLoadingAction('');
    }
  };

  // 直接通过API添加题目
  const handleDirectAddQuestion = async () => {
    try {
      // 验证表单
      if (!questionFormData.question || questionFormData.options.length < 2) {
        showStatusMessage('error', '请完整填写题目信息，至少需要两个选项');
        return;
      }

      // 验证答案
      if (
        (questionFormData.questionType === 'single' && !questionFormData.correctAnswer) ||
        (questionFormData.questionType === 'multiple' && 
         (!Array.isArray(questionFormData.correctAnswer) || questionFormData.correctAnswer.length === 0))
      ) {
        showStatusMessage('error', '请选择至少一个正确答案');
        return;
      }
      
      if (!currentQuestionSet?.id) {
        showStatusMessage('error', '题库ID不能为空');
        return;
      }
      
      // 生成唯一ID
      const uniqueId = `temp-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
      
      // 准备请求数据
      const requestData = {
        questionSetId: currentQuestionSet.id,
        content: questionFormData.question,
        type: questionFormData.questionType,
        explanation: questionFormData.explanation || '',
        options: questionFormData.options.map(opt => ({
          id: opt.id,
          text: opt.text,
          isCorrect: questionFormData.questionType === 'single' 
            ? questionFormData.correctAnswer === opt.id
            : Array.isArray(questionFormData.correctAnswer) && questionFormData.correctAnswer.includes(opt.id)
        })),
      };
      
      setLoading(true);
      setLoadingAction('addQuestion');
      
      // 调用API添加题目
      const response = await axios.put(`/api/questions/${uniqueId}`, requestData);
      
      if (response.status === 200 || response.status === 201) {
        showStatusMessage('success', '题目添加成功');
        
        // 刷新题库列表以获取最新的题目数量
        await loadQuestionSets();
        
        // 重置表单
        setIsAddingQuestion(false);
        setCurrentQuestion(null);
      } else {
        showStatusMessage('error', '题目添加失败');
      }
    } catch (error) {
      console.error('添加题目出错:', error);
      showStatusMessage('error', '添加题目失败: ' + (error.response?.data?.message || error.message));
    } finally {
      setLoading(false);
      setLoadingAction('');
    }
  };

  // 直接通过API更新题目
  const handleDirectUpdateQuestion = async () => {
    try {
      // 验证表单
      if (!questionFormData.question || questionFormData.options.length < 2) {
        showStatusMessage('error', '请完整填写题目信息，至少需要两个选项');
        return;
      }

      // 验证答案
      if (
        (questionFormData.questionType === 'single' && !questionFormData.correctAnswer) ||
        (questionFormData.questionType === 'multiple' && 
         (!Array.isArray(questionFormData.correctAnswer) || questionFormData.correctAnswer.length === 0))
      ) {
        showStatusMessage('error', '请选择至少一个正确答案');
        return;
      }
      
      if (!currentQuestion?.id) {
        showStatusMessage('error', '题目ID不能为空');
        return;
      }
      
      if (!currentQuestionSet?.id) {
        showStatusMessage('error', '题库ID不能为空');
        return;
      }
      
      // 准备请求数据
      const requestData = {
        questionSetId: currentQuestionSet.id,
        content: questionFormData.question,
        type: questionFormData.questionType,
        explanation: questionFormData.explanation || '',
        options: questionFormData.options.map(opt => ({
          id: opt.id,
          text: opt.text,
          isCorrect: questionFormData.questionType === 'single' 
            ? questionFormData.correctAnswer === opt.id
            : Array.isArray(questionFormData.correctAnswer) && questionFormData.correctAnswer.includes(opt.id)
        })),
      };
      
      setLoading(true);
      setLoadingAction('updateQuestion');
      
      // 调用API更新题目
      const response = await axios.put(`/api/questions/${currentQuestion.id}`, requestData);
      
      if (response.status === 200) {
        showStatusMessage('success', '题目更新成功');
        
        // 刷新题库列表以获取最新的题目数量
        await loadQuestionSets();
        
        // 重置表单
        setIsAddingQuestion(false);
        setCurrentQuestion(null);
      } else {
        showStatusMessage('error', '题目更新失败');
      }
    } catch (error) {
      console.error('更新题目出错:', error);
      showStatusMessage('error', '更新题目失败: ' + (error.response?.data?.message || error.message));
    } finally {
      setLoading(false);
      setLoadingAction('');
    }
  };
  
  // 直接通过API删除题目
  const handleDirectDeleteQuestion = async (questionId) => {
    try {
      if (!questionId) {
        showStatusMessage('error', '题目ID不能为空');
        return;
      }
      
      setLoading(true);
      setLoadingAction('deleteQuestion');
      
      // 调用API删除题目
      const response = await axios.delete(`/api/questions/${questionId}`);
      
      if (response.status === 200) {
        showStatusMessage('success', '题目删除成功');
        
        // 刷新题库列表以获取最新的题目数量
        await loadQuestionSets();
      } else {
        showStatusMessage('error', '题目删除失败');
      }
    } catch (error) {
      console.error('删除题目出错:', error);
      showStatusMessage('error', '删除题目失败: ' + (error.response?.data?.message || error.message));
    } finally {
      setLoading(false);
      setLoadingAction('');
    }
  };

  // 过滤兑换码
  const filterRedeemCodes = useCallback(() => {
    return redeemCodes.filter(code => {
      // 按状态过滤
      if (codeFilterStatus === 'used' && !code.usedAt) {
        return false;
      }
      if (codeFilterStatus === 'unused' && code.usedAt) {
        return false;
      }
      
      // 按题目集过滤
      if (codeFilterQuizId && code.questionSetId !== codeFilterQuizId) {
        return false;
      }
      
      return true;
    });
  }, [redeemCodes, codeFilterStatus, codeFilterQuizId]);
  
  // 计算过滤后的兑换码
  const filteredCodes = filterRedeemCodes();

  // 在renderQuestionSets函数中添加添加题目按钮
  const renderQuestionSets = () => {
    if (filteredQuestionSets.length === 0) {
      return (
        <div className="text-center py-10">
          <p className="text-gray-500">未找到匹配的题库</p>
        </div>
      );
    }

    return (
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ID</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">标题</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">分类</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">付费</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">题目数</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">操作</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {filteredQuestionSets.map((set) => (
              <tr 
                key={set.id} 
                className="hover:bg-gray-50 cursor-pointer"
                onClick={() => handleManageQuestions(set)}
              >
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{set.id}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{set.title}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{set.category}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {set.isPaid ? (
                    <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                      付费 (¥{set.price})
                    </span>
                  ) : (
                    <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-gray-100 text-gray-800">
                      免费
                    </span>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{set.questions?.length || 0}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 space-x-2" onClick={(e) => e.stopPropagation()}>
                  <button
                    className="text-indigo-600 hover:text-indigo-900"
                    onClick={() => handleEditClick(set)}
                  >
                    编辑
                  </button>
                  <button
                    className="text-green-600 hover:text-green-900"
                    onClick={() => handleManageQuestions(set)}
                  >
                    管理题目
                  </button>
                  <button
                    className="text-red-600 hover:text-red-900"
                    onClick={() => handleDeleteQuestionSet(set.id)}
                  >
                    删除
                  </button>
                  {set.isPaid && (
                    <button
                      className="text-yellow-600 hover:text-yellow-900"
                      onClick={() => handleShowGenerateCodeModal(set)}
                    >
                      生成兑换码
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
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
        onCancel={handleCloseQuestionModal}
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
                    onChange={e => setQuestionFormData({...questionFormData, question: e.target.value})}
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
                    onChange={e => setQuestionFormData({...questionFormData, explanation: e.target.value})}
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
                      { label: '多选题', value: 'multiple' }
                    ]}
                    onChange={e => {
                      const newType = e.target.value;
                      setQuestionFormData({
                        ...questionFormData,
                        questionType: newType,
                        correctAnswer: newType === 'single' ? '' : []
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
            
            {generatedCode && (
              <Alert
                message="兑换码已生成"
                description={
                  <div>
                    <p>兑换码: <strong>{generatedCode.code}</strong></p>
                    <p>有效期至: {new Date(generatedCode.expiryDate).toLocaleString()}</p>
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
                loading={loading && loadingAction === 'generateCode'}
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
                {categoryOptions.map(category => (
                  <option key={category} value={category}>{category}</option>
                ))}
              </select>
            </Form.Item>
            
            <Form.Item 
              label="图标" 
              className="mb-3"
            >
              <div className="flex flex-wrap gap-2">
                {iconOptions.map(icon => (
                  <div
                    key={icon}
                    onClick={() => setFormData({...formData, icon})}
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
                {categoryOptions.map(category => (
                  <option key={category} value={category}>{category}</option>
                ))}
              </select>
            </Form.Item>
            
            <Form.Item 
              label="图标" 
              className="mb-3"
            >
              <div className="flex flex-wrap gap-2">
                {iconOptions.map(icon => (
                  <div
                    key={icon}
                    onClick={() => setFormData({...formData, icon})}
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