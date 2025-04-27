import React, { useState, useEffect, useCallback } from 'react';
import { questionSets as defaultQuestionSets } from '../../data/questionSets';
import { Question as ClientQuestion, Option, QuestionType } from '../../data/questions';
import { QuestionSet as ClientQuestionSet } from '../../data/questionSets';
import { RedeemCode, QuestionSet as ApiQuestionSet } from '../../types';
import { useUser } from '../../contexts/UserContext';
import { questionSetApi } from '../../utils/api';
import axios from 'axios';  // 添加axios导入

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
    questions: clientSet.questions.map(q => ({
      id: q.id.toString(),
      text: q.question,
      questionType: q.questionType,
      explanation: q.explanation,
      options: q.options.map(opt => ({
        id: opt.id,
        text: opt.text,
        isCorrect: Array.isArray(q.correctAnswer) 
          ? q.correctAnswer.includes(opt.id)
          : q.correctAnswer === opt.id
      }))
    }))
  };
};

const AdminQuestionSets: React.FC = () => {
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
  useEffect(() => {
    const loadQuestionSets = async () => {
      setLoadingQuestionSets(true);
      try {
        console.log("正在从API加载题库...");
        const response = await questionSetApi.getAllQuestionSets();
        console.log("API响应:", response);
        
        if (response.success && response.data) {
          // Convert API format to client format
          const clientQuestionSets = response.data.map(mapApiToClientQuestionSet);
          setLocalQuestionSets(clientQuestionSets);
          console.log("成功加载题库:", clientQuestionSets.length);
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
    
    loadQuestionSets();
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

    setLoading(true);
    setLoadingAction('create');
    
    try {
      const response = await questionSetApi.createQuestionSet(questionSetData);
      
      if (response.success && response.data) {
        // 转换为客户端格式并更新本地列表
        const clientQuestionSet = mapApiToClientQuestionSet(response.data);
        setLocalQuestionSets(prev => [...prev, clientQuestionSet]);
        
        // 显示成功消息
        showStatusMessage('success', '题库创建成功！');
        
        // 重置表单并关闭
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
        setShowCreateForm(false);
      } else {
        // 显示错误消息
        showStatusMessage('error', `创建题库失败: ${response.error || response.message || '未知错误'}`);
      }
    } catch (error) {
      console.error('创建题库时出错:', error);
      showStatusMessage('error', '创建题库时出现错误');
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
        // 转换为客户端格式并更新本地列表
        const clientQuestionSet = mapApiToClientQuestionSet(response.data);
        setLocalQuestionSets(prev => 
          prev.map(set => set.id === formData.id ? clientQuestionSet : set)
        );
        
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
        const response = await questionSetApi.deleteQuestionSet(id);
        
        if (response.success) {
          // 从列表中移除题库
          setLocalQuestionSets(prev => prev.filter(set => set.id !== id));
          
          // 显示成功消息
          showStatusMessage('success', '题库删除成功！');
        } else {
          // 显示错误消息
          showStatusMessage('error', `删除题库失败: ${response.error || response.message || '未知错误'}`);
        }
      } catch (error) {
        console.error('删除题库时出错:', error);
        showStatusMessage('error', '删除题库时出现错误');
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

  // 打开题目管理模态框
  const handleManageQuestions = (questionSet: ClientQuestionSet) => {
    setCurrentQuestionSet(questionSet);
    setShowQuestionModal(true);
  };

  // 处理添加新题目
  const handleAddQuestion = () => {
    setIsAddingQuestion(true);
    setCurrentQuestion(null);
    setQuestionFormData({
      id: Date.now(),
      question: '',
      questionType: 'single',
      options: [],
      correctAnswer: '',
      explanation: ''
    });
    setOptionInput({ id: '', text: '' });
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
    setOptionInput({ id: '', text: '' });
  };

  // 处理删除题目
  const handleDeleteQuestion = (index: number) => {
    if (!currentQuestionSet) return;
    
    if (window.confirm('确定要删除这个题目吗？此操作不可逆。')) {
      const updatedQuestions = [...currentQuestionSet.questions];
      updatedQuestions.splice(index, 1);
      
      const updatedQuestionSet = {
        ...currentQuestionSet,
        questions: updatedQuestions
      };
      
      setCurrentQuestionSet(updatedQuestionSet);
      
      // 更新本地题库数据
      const updatedQuestionSets = localQuestionSets.map(set => 
        set.id === currentQuestionSet.id ? updatedQuestionSet : set
      );
      
      setLocalQuestionSets(updatedQuestionSets);
      showStatusMessage('success', '题目删除成功！');
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

  // 处理保存题目
  const handleSaveQuestion = async () => {
    if (!currentQuestionSet) return;
    
    // 验证表单
    if (!questionFormData.question.trim()) {
      showStatusMessage('error', '题目内容不能为空');
      return;
    }
    
    if (questionFormData.options.length < 2) {
      showStatusMessage('error', '每个题目至少需要两个选项');
      return;
    }
    
    // 检查是否有正确答案
    const hasCorrectAnswer = questionFormData.questionType === 'single' 
      ? !!questionFormData.correctAnswer
      : Array.isArray(questionFormData.correctAnswer) && questionFormData.correctAnswer.length > 0;
    
    if (!hasCorrectAnswer) {
      showStatusMessage('error', '请至少标记一个正确答案');
      return;
    }
    
    const updatedQuestion: ClientQuestion = {
      id: questionFormData.id,
      question: questionFormData.question,
      questionType: questionFormData.questionType,
      options: questionFormData.options,
      correctAnswer: questionFormData.correctAnswer,
      explanation: questionFormData.explanation
    };
    
    let updatedQuestions;
    
    if (isAddingQuestion) {
      // 添加新题目
      updatedQuestions = [...currentQuestionSet.questions, updatedQuestion];
    } else {
      // 更新现有题目
      updatedQuestions = [...currentQuestionSet.questions];
      updatedQuestions[questionIndex] = updatedQuestion;
    }
    
    const updatedQuestionSet = {
      ...currentQuestionSet,
      questions: updatedQuestions
    };
    
    setCurrentQuestionSet(updatedQuestionSet);
    
    // 更新本地题库数据
    const updatedQuestionSets = localQuestionSets.map(set => 
      set.id === currentQuestionSet.id ? updatedQuestionSet : set
    );
    
    setLocalQuestionSets(updatedQuestionSets);
    
    // 立即将更改保存到数据库
    setLoading(true);
    
    try {
      // 转换为API格式
      const questionSetData = mapClientToApiQuestionSet(updatedQuestionSet);
      
      // 调用API更新题库
      const response = await questionSetApi.updateQuestionSet(
        updatedQuestionSet.id, 
        questionSetData
      );
      
      if (response.success) {
        showStatusMessage('success', isAddingQuestion ? '题目添加成功并已保存到数据库！' : '题目更新成功并已保存到数据库！');
      } else {
        showStatusMessage('error', `保存失败：${response.error || response.message || '未知错误'}`);
      }
    } catch (error) {
      console.error('保存题目时出错:', error);
      showStatusMessage('error', '保存题目到数据库时出错，但已更新本地数据。建议点击"保存所有更改"按钮再次尝试。');
    } finally {
      setLoading(false);
    }
    
    // 重置状态
    setIsAddingQuestion(false);
    setCurrentQuestion(null);
    setQuestionFormData({
      id: 0,
      question: '',
      questionType: 'single',
      options: [],
      correctAnswer: '',
      explanation: ''
    });
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

  // 保存所有更改到API
  const handleSaveAllChanges = async () => {
    setLoading(true);
    setLoadingAction('saveAll');
    
    try {
      // 先获取最新的题库列表，以确保数据是完整的
      const questionSetsResponse = await questionSetApi.getAllQuestionSets();
      
      // 合并远程数据和本地数据，确保保留问题数据
      let mergedQuestionSets = [...localQuestionSets];
      
      // 如果已有远程数据，确保合并
      if (questionSetsResponse.success && questionSetsResponse.data) {
        // 将远程题库映射为客户端格式
        const remoteQuestionSets = questionSetsResponse.data.map(mapApiToClientQuestionSet);
        
        // 合并数据，本地数据优先
        mergedQuestionSets = localQuestionSets.map(localSet => {
          // 查找远程对应的数据
          const remoteSet = remoteQuestionSets.find(set => set.id === localSet.id);
          if (remoteSet) {
            // 确保本地编辑的题目数据不会丢失
            return {
              ...localSet,
              // 如果本地题目数组为空但远程不为空，使用远程题目
              questions: localSet.questions.length > 0 ? localSet.questions : remoteSet.questions
            };
          }
          return localSet;
        });
      }
      
      // 转换为API格式，确保包含所有题目
      const apiQuestionSets = mergedQuestionSets.map(set => {
        const apiSet = mapClientToApiQuestionSet(set);
        console.log(`准备上传题库 ${set.id}，题目数量: ${set.questions.length}`);
        return apiSet;
      });
      
      // 使用批量上传API
      const response = await questionSetApi.uploadQuestionSets(apiQuestionSets);
      
      if (response.success) {
        showStatusMessage('success', '所有题库更改已成功保存！');
      } else {
        showStatusMessage('error', `保存失败: ${response.error || response.message || '未知错误'}`);
      }
    } catch (error) {
      console.error('保存题库时出错:', error);
      showStatusMessage('error', '保存时出现错误');
    } finally {
      setLoading(false);
      setLoadingAction('');
    }
  };

  // 处理文件选择
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setUploadFile(e.target.files[0]);
    }
  };

  // 处理文件上传
  const handleFileUpload = async () => {
    if (!uploadFile) {
      showStatusMessage('error', '请先选择文件');
      return;
    }

    const formData = new FormData();
    formData.append('file', uploadFile);

    setIsUploading(true);
    setUploadProgress(0);

    try {
      const response = await axios.post('/api/question-sets/upload/file', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        },
        onUploadProgress: (progressEvent) => {
          const percentCompleted = Math.round((progressEvent.loaded * 100) / (progressEvent.total || 1));
          setUploadProgress(percentCompleted);
        }
      });

      if (response.data.success) {
        showStatusMessage('success', '题库文件上传成功');
        // 重新加载题库列表
        const questionSetsResponse = await questionSetApi.getAllQuestionSets();
        if (questionSetsResponse.success && questionSetsResponse.data) {
          const clientQuestionSets = questionSetsResponse.data.map(mapApiToClientQuestionSet);
          setLocalQuestionSets(clientQuestionSets);
        }
        // 清除文件选择
        setUploadFile(null);
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      } else {
        showStatusMessage('error', `上传失败：${response.data.message || '未知错误'}`);
      }
    } catch (error: any) {
      console.error('文件上传错误:', error);
      showStatusMessage('error', `上传失败：${error.response?.data?.message || error.message || '服务器错误'}`);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="px-4 py-5 sm:p-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
        <h2 className="text-lg leading-6 font-medium text-gray-900">题库管理</h2>
        
        {/* 文件上传区域 */}
        <div className="w-full sm:w-auto flex flex-col sm:flex-row gap-4">
          <div className="p-3 bg-white border border-gray-300 rounded-md flex flex-col sm:flex-row gap-2 items-center">
            <input
              ref={fileInputRef}
              type="file"
              accept=".json,.csv,.xlsx,.xls"
              onChange={handleFileChange}
              className="text-sm w-full flex-grow"
            />
            <button
              onClick={handleFileUpload}
              disabled={isUploading || !uploadFile}
              className={`w-full sm:w-auto px-3 py-2 text-sm rounded-md ${
                isUploading || !uploadFile
                  ? 'bg-gray-300 text-gray-700 cursor-not-allowed'
                  : 'bg-green-600 text-white hover:bg-green-700'
              } whitespace-nowrap`}
            >
              {isUploading ? `上传中 ${uploadProgress}%` : '上传文件'}
            </button>
          </div>
        
          <div className="flex gap-2 w-full sm:w-auto">
            <input
              type="text"
              placeholder="搜索题库..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="shadow-sm focus:ring-blue-500 focus:border-blue-500 block w-full sm:text-sm border-gray-300 rounded-md"
            />
            <button
              onClick={() => setShowCreateForm(true)}
              disabled={loading}
              className={`whitespace-nowrap inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white ${loading ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'} focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500`}
            >
              <svg className="mr-2 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              创建新题库
            </button>
          </div>
        </div>
      </div>
      
      <div className="mb-2">
        <button
          onClick={handleSaveAllChanges}
          disabled={loading}
          className={`inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white ${loading && loadingAction === 'saveAll' ? 'bg-gray-400 cursor-not-allowed' : 'bg-green-600 hover:bg-green-700'} focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500`}
        >
          {loading && loadingAction === 'saveAll' ? (
            <>
              <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              保存中...
            </>
          ) : (
            <>
              <svg className="mr-2 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
              </svg>
              保存所有更改
            </>
          )}
        </button>
      </div>
      
      {statusMessage.message && (
        <div 
          className={`mb-4 p-4 rounded-md ${
            statusMessage.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
          }`}
        >
          {statusMessage.message}
        </div>
      )}
      
      {/* Loading indicator for question sets */}
      {loadingQuestionSets && (
        <div className="flex justify-center items-center py-8">
          <svg className="animate-spin h-8 w-8 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <span className="ml-2 text-gray-700">加载题库中...</span>
        </div>
      )}
      
      {!loadingQuestionSets && (
        <div className="mt-4">
          <div className="overflow-hidden shadow ring-1 ring-black ring-opacity-5 sm:rounded-lg">
            <table className="min-w-full divide-y divide-gray-300">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900">标题</th>
                  <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">分类</th>
                  <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">付费状态</th>
                  <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">题目数量</th>
                  <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">描述</th>
                  <th scope="col" className="relative py-3.5 pl-3 pr-4">
                    <span className="sr-only">操作</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {filteredQuestionSets.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-4 text-center text-sm text-gray-500">
                      没有找到匹配的题库
                    </td>
                  </tr>
                ) : (
                  filteredQuestionSets.map(set => (
                    <tr key={set.id}>
                      <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-gray-900">
                        <div className="flex items-center">
                          <span className="mr-2 text-xl">{set.icon}</span>
                          {set.title}
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-sm font-medium bg-blue-100 text-blue-800">
                          {set.category}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-3 py-4 text-sm">
                        {set.isPaid ? (
                          <div>
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-sm font-medium bg-green-100 text-green-800">
                              付费 ¥{set.price}
                            </span>
                            {set.trialQuestions && set.trialQuestions > 0 && (
                              <p className="text-xs text-gray-500 mt-1">
                                可试用{set.trialQuestions}题
                              </p>
                            )}
                          </div>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-sm font-medium bg-gray-100 text-gray-800">
                            免费
                          </span>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                        {set.questions.length}
                      </td>
                      <td className="px-3 py-4 text-sm text-gray-500 max-w-md truncate">
                        {set.description}
                      </td>
                      <td className="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium">
                        <button
                          className="text-blue-600 hover:text-blue-900 mr-3 disabled:opacity-50 disabled:cursor-not-allowed"
                          onClick={() => handleEditClick(set)}
                          disabled={loading}
                        >
                          编辑
                        </button>
                        <button
                          className="text-green-600 hover:text-green-900 mr-3 disabled:opacity-50 disabled:cursor-not-allowed"
                          onClick={() => handleShowGenerateCodeModal(set)}
                          disabled={loading}
                        >
                          生成兑换码
                        </button>
                        <button
                          className="text-red-600 hover:text-red-900 disabled:opacity-50 disabled:cursor-not-allowed"
                          onClick={() => handleDeleteQuestionSet(set.id)}
                          disabled={loading}
                        >
                          {loading && loadingAction === 'delete' ? '删除中...' : '删除'}
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          
          <div className="mt-4 text-sm text-gray-500">
            共 {filteredQuestionSets.length} 个题库
          </div>
        </div>
      )}
      
      {/* 创建题库表单 - 添加加载状态 */}
      {showCreateForm && (
        <div className="mb-8 bg-gray-50 p-6 rounded-lg border border-gray-200">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-medium text-gray-900">创建新题库</h3>
            <button
              onClick={() => setShowCreateForm(false)}
              className="text-gray-500 hover:text-gray-700"
              disabled={loading && loadingAction === 'create'}
            >
              <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          
          <div className="grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-6">
            <div className="sm:col-span-3">
              <label htmlFor="id" className="block text-sm font-medium text-gray-700">
                ID <span className="text-red-500">*</span>
              </label>
              <div className="mt-1">
                <input
                  type="text"
                  name="id"
                  id="id"
                  value={formData.id}
                  onChange={handleFormChange}
                  placeholder="唯一标识符，如 'network'"
                  className="shadow-sm focus:ring-blue-500 focus:border-blue-500 block w-full sm:text-sm border-gray-300 rounded-md"
                  required
                />
              </div>
            </div>

            <div className="sm:col-span-3">
              <label htmlFor="title" className="block text-sm font-medium text-gray-700">
                标题 <span className="text-red-500">*</span>
              </label>
              <div className="mt-1">
                <input
                  type="text"
                  name="title"
                  id="title"
                  value={formData.title}
                  onChange={handleFormChange}
                  placeholder="如 '网络协议'"
                  className="shadow-sm focus:ring-blue-500 focus:border-blue-500 block w-full sm:text-sm border-gray-300 rounded-md"
                  required
                />
              </div>
            </div>

            <div className="sm:col-span-3">
              <label htmlFor="category" className="block text-sm font-medium text-gray-700">
                分类 <span className="text-red-500">*</span>
              </label>
              <div className="mt-1">
                <select
                  id="category"
                  name="category"
                  value={formData.category}
                  onChange={handleFormChange}
                  className="shadow-sm focus:ring-blue-500 focus:border-blue-500 block w-full sm:text-sm border-gray-300 rounded-md"
                  required
                >
                  <option value="">选择分类...</option>
                  {categoryOptions.map(category => (
                    <option key={category} value={category}>{category}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="sm:col-span-3">
              <label htmlFor="icon" className="block text-sm font-medium text-gray-700">
                图标
              </label>
              <div className="mt-1">
                <select
                  id="icon"
                  name="icon"
                  value={formData.icon}
                  onChange={handleFormChange}
                  className="shadow-sm focus:ring-blue-500 focus:border-blue-500 block w-full sm:text-sm border-gray-300 rounded-md"
                >
                  {iconOptions.map(icon => (
                    <option key={icon} value={icon}>{icon}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="sm:col-span-6">
              <div className="flex items-center">
                <input
                  id="isPaid"
                  name="isPaid"
                  type="checkbox"
                  checked={formData.isPaid}
                  onChange={handleFormChange}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label htmlFor="isPaid" className="ml-2 block text-sm text-gray-700">
                  设为付费题库
                </label>
              </div>
            </div>

            {formData.isPaid && (
              <>
                <div className="sm:col-span-3">
                  <label htmlFor="price" className="block text-sm font-medium text-gray-700">
                    价格（元） <span className="text-red-500">*</span>
                  </label>
                  <div className="mt-1">
                    <input
                      type="number"
                      name="price"
                      id="price"
                      min="0"
                      step="0.1"
                      value={formData.price}
                      onChange={handleFormChange}
                      className="shadow-sm focus:ring-blue-500 focus:border-blue-500 block w-full sm:text-sm border-gray-300 rounded-md"
                      required
                    />
                  </div>
                  <p className="mt-1 text-xs text-gray-500">用户需支付此金额才能使用完整题库，有效期为6个月</p>
                </div>

                <div className="sm:col-span-3">
                  <label htmlFor="trialQuestions" className="block text-sm font-medium text-gray-700">
                    免费试用题目数量
                  </label>
                  <div className="mt-1">
                    <input
                      type="number"
                      name="trialQuestions"
                      id="trialQuestions"
                      min="0"
                      step="1"
                      value={formData.trialQuestions}
                      onChange={handleFormChange}
                      className="shadow-sm focus:ring-blue-500 focus:border-blue-500 block w-full sm:text-sm border-gray-300 rounded-md"
                    />
                  </div>
                  <p className="mt-1 text-xs text-gray-500">设置为0表示不提供试用题目</p>
                </div>
              </>
            )}

            <div className="sm:col-span-6">
              <label htmlFor="description" className="block text-sm font-medium text-gray-700">
                描述
              </label>
              <div className="mt-1">
                <textarea
                  id="description"
                  name="description"
                  rows={3}
                  value={formData.description}
                  onChange={handleFormChange}
                  placeholder="题库的简短描述"
                  className="shadow-sm focus:ring-blue-500 focus:border-blue-500 block w-full sm:text-sm border-gray-300 rounded-md"
                />
              </div>
            </div>
          </div>

          <div className="mt-6 flex justify-end">
            <button
              type="button"
              onClick={() => setShowCreateForm(false)}
              className="mr-3 bg-white py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              disabled={loading && loadingAction === 'create'}
            >
              取消
            </button>
            <button
              type="button"
              onClick={handleCreateSubmit}
              disabled={loading && loadingAction === 'create'}
              className={`inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white ${loading && loadingAction === 'create' ? 'bg-blue-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'} focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500`}
            >
              {loading && loadingAction === 'create' ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  创建中...
                </>
              ) : '创建'}
            </button>
          </div>
        </div>
      )}
      
      {/* 编辑题库表单 - 添加加载状态 */}
      {showEditForm && currentQuestionSet && (
        <div className="mb-8 bg-gray-50 p-6 rounded-lg border border-gray-200">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-medium text-gray-900">编辑题库</h3>
            <button
              onClick={() => setShowEditForm(false)}
              className="text-gray-500 hover:text-gray-700"
              disabled={loading && loadingAction === 'edit'}
            >
              <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          
          <div className="grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-6">
            <div className="sm:col-span-3">
              <label htmlFor="edit-title" className="block text-sm font-medium text-gray-700">
                标题 <span className="text-red-500">*</span>
              </label>
              <div className="mt-1">
                <input
                  type="text"
                  name="title"
                  id="edit-title"
                  value={formData.title}
                  onChange={handleFormChange}
                  className="shadow-sm focus:ring-blue-500 focus:border-blue-500 block w-full sm:text-sm border-gray-300 rounded-md"
                  required
                />
              </div>
            </div>

            <div className="sm:col-span-3">
              <label htmlFor="edit-category" className="block text-sm font-medium text-gray-700">
                分类 <span className="text-red-500">*</span>
              </label>
              <div className="mt-1">
                <select
                  id="edit-category"
                  name="category"
                  value={formData.category}
                  onChange={handleFormChange}
                  className="shadow-sm focus:ring-blue-500 focus:border-blue-500 block w-full sm:text-sm border-gray-300 rounded-md"
                  required
                >
                  <option value="">选择分类...</option>
                  {categoryOptions.map(category => (
                    <option key={category} value={category}>{category}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="sm:col-span-3">
              <label htmlFor="edit-icon" className="block text-sm font-medium text-gray-700">
                图标
              </label>
              <div className="mt-1">
                <select
                  id="edit-icon"
                  name="icon"
                  value={formData.icon}
                  onChange={handleFormChange}
                  className="shadow-sm focus:ring-blue-500 focus:border-blue-500 block w-full sm:text-sm border-gray-300 rounded-md"
                >
                  {iconOptions.map(icon => (
                    <option key={icon} value={icon}>{icon}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="sm:col-span-6">
              <div className="flex items-center">
                <input
                  id="edit-isPaid"
                  name="isPaid"
                  type="checkbox"
                  checked={formData.isPaid}
                  onChange={handleFormChange}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label htmlFor="edit-isPaid" className="ml-2 block text-sm text-gray-700">
                  设为付费题库
                </label>
              </div>
            </div>

            {formData.isPaid && (
              <>
                <div className="sm:col-span-3">
                  <label htmlFor="edit-price" className="block text-sm font-medium text-gray-700">
                    价格（元） <span className="text-red-500">*</span>
                  </label>
                  <div className="mt-1">
                    <input
                      type="number"
                      name="price"
                      id="edit-price"
                      min="0"
                      step="0.1"
                      value={formData.price}
                      onChange={handleFormChange}
                      className="shadow-sm focus:ring-blue-500 focus:border-blue-500 block w-full sm:text-sm border-gray-300 rounded-md"
                      required
                    />
                  </div>
                  <p className="mt-1 text-xs text-gray-500">用户需支付此金额才能使用完整题库，有效期为6个月</p>
                </div>

                <div className="sm:col-span-3">
                  <label htmlFor="edit-trialQuestions" className="block text-sm font-medium text-gray-700">
                    免费试用题目数量
                  </label>
                  <div className="mt-1">
                    <input
                      type="number"
                      name="trialQuestions"
                      id="edit-trialQuestions"
                      min="0"
                      step="1"
                      value={formData.trialQuestions}
                      onChange={handleFormChange}
                      className="shadow-sm focus:ring-blue-500 focus:border-blue-500 block w-full sm:text-sm border-gray-300 rounded-md"
                    />
                  </div>
                  <p className="mt-1 text-xs text-gray-500">设置为0表示不提供试用题目</p>
                </div>
              </>
            )}

            <div className="sm:col-span-6">
              <label htmlFor="edit-description" className="block text-sm font-medium text-gray-700">
                描述
              </label>
              <div className="mt-1">
                <textarea
                  id="edit-description"
                  name="description"
                  rows={3}
                  value={formData.description}
                  onChange={handleFormChange}
                  className="shadow-sm focus:ring-blue-500 focus:border-blue-500 block w-full sm:text-sm border-gray-300 rounded-md"
                />
              </div>
            </div>
          </div>

          <div className="mt-4 mb-2">
            <p className="text-sm text-gray-600">题目数量：{currentQuestionSet.questions.length}</p>
            <button
              type="button"
              onClick={() => handleManageQuestions(currentQuestionSet)}
              className="mt-2 text-sm text-blue-600 hover:text-blue-800"
            >
              管理题目 »
            </button>
          </div>

          <div className="mt-6 flex justify-end">
            <button
              type="button"
              onClick={() => setShowEditForm(false)}
              className="mr-3 bg-white py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              disabled={loading && loadingAction === 'edit'}
            >
              取消
            </button>
            <button
              type="button"
              onClick={handleEditSubmit}
              disabled={loading && loadingAction === 'edit'}
              className={`inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white ${loading && loadingAction === 'edit' ? 'bg-blue-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'} focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500`}
            >
              {loading && loadingAction === 'edit' ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  保存中...
                </>
              ) : '保存更改'}
            </button>
          </div>
        </div>
      )}

      {/* 生成兑换码弹窗 */}
      {showRedeemCodeModal && selectedQuizForCode && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg overflow-hidden shadow-xl transform transition-all sm:max-w-lg sm:w-full">
            <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
              <div className="sm:flex sm:items-start">
                <div className="mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-green-100 sm:mx-0 sm:h-10 sm:w-10">
                  <svg className="h-6 w-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
                  </svg>
                </div>
                <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left">
                  <h3 className="text-lg leading-6 font-medium text-gray-900">
                    为 <span className="text-blue-600">{selectedQuizForCode.title}</span> 生成兑换码
                  </h3>
                  <div className="mt-4">
                    <div className="mb-4">
                      <label htmlFor="duration" className="block text-sm font-medium text-gray-700">
                        有效期 (天)
                      </label>
                      <input
                        type="number"
                        name="duration"
                        id="duration"
                        min="1"
                        max="365"
                        value={codeDurationDays}
                        onChange={(e) => setCodeDurationDays(Math.max(1, parseInt(e.target.value) || 30))}
                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                      />
                    </div>
                    
                    {generatedCode && (
                      <div className="mt-4 p-4 bg-green-50 rounded-md border border-green-200">
                        <div className="flex justify-between items-center">
                          <span className="text-green-800 font-medium">生成的兑换码:</span>
                          <button
                            onClick={() => navigator.clipboard.writeText(generatedCode.code)}
                            className="text-xs bg-green-100 hover:bg-green-200 text-green-800 py-1 px-2 rounded-md"
                          >
                            复制
                          </button>
                        </div>
                        <div className="mt-2 text-xl font-mono text-center text-green-700 select-all py-2 px-4 bg-white rounded border border-green-200">
                          {generatedCode.code}
                        </div>
                        <p className="mt-2 text-sm text-green-700">
                          此兑换码可兑换 {selectedQuizForCode.title} 题库 {codeDurationDays} 天的使用权限
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
            <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
              {!generatedCode ? (
                <button
                  type="button"
                  onClick={handleGenerateCode}
                  className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-green-600 text-base font-medium text-white hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 sm:ml-3 sm:w-auto sm:text-sm"
                >
                  生成兑换码
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setGeneratedCode(null);
                    setCodeDurationDays(30);
                  }}
                  className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-green-600 text-base font-medium text-white hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 sm:ml-3 sm:w-auto sm:text-sm"
                >
                  生成新兑换码
                </button>
              )}
              <button
                type="button"
                onClick={() => setShowRedeemCodeModal(false)}
                className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
              >
                关闭
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* 兑换码列表 */}
      <div className="mt-6 border p-4 rounded-lg">
        <h2 className="text-xl font-bold mb-4">兑换码列表</h2>
        
        {/* 筛选控制 */}
        <div className="flex gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium mb-1">状态</label>
            <select
              className="border rounded p-2 w-full"
              value={codeFilterStatus}
              onChange={(e) => setCodeFilterStatus(e.target.value)}
            >
              <option value="all">全部</option>
              <option value="used">已使用</option>
              <option value="unused">未使用</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">题目集</label>
            <select
              className="border rounded p-2 w-full"
              value={codeFilterQuizId || ''}
              onChange={(e) => setCodeFilterQuizId(e.target.value || null)}
            >
              <option value="">全部题目集</option>
              {localQuestionSets.map((set) => (
                <option key={set.id} value={set.id}>
                  {set.title}
                </option>
              ))}
            </select>
          </div>
        </div>
        
        {filteredCodes.length === 0 ? (
          <p className="text-gray-500 text-center py-4">没有符合条件的兑换码</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full bg-white">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">兑换码</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">题目集</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">有效期(天)</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">创建日期</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">状态</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">使用日期</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">使用者</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredCodes.map((code) => (
                  <tr key={code.code}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{code.code}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {localQuestionSets.find(q => q.id === code.questionSetId)?.title || '未找到题目集'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{code.validityDays}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{new Date(code.createdAt).toLocaleDateString()}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {code.usedAt ? '已使用' : '未使用'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {code.usedAt ? new Date(code.usedAt).toLocaleDateString() : '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {code.usedBy ? code.usedBy : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 题目管理模态框 */}
      {showQuestionModal && currentQuestionSet && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg overflow-hidden shadow-xl transform transition-all sm:max-w-4xl sm:w-full">
            <div className="bg-white px-4 pt-5 pb-4 sm:p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg leading-6 font-medium text-gray-900">
                  {currentQuestionSet.title} - 题目管理
                </h3>
                <button
                  onClick={() => setShowQuestionModal(false)}
                  className="text-gray-400 hover:text-gray-500"
                >
                  <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* 题目列表和编辑区域 */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* 题目列表 */}
                <div className="border rounded-md p-4 bg-gray-50">
                  <div className="flex justify-between items-center mb-4">
                    <h4 className="text-md font-medium text-gray-700">题目列表</h4>
                    <button
                      onClick={handleAddQuestion}
                      className="inline-flex items-center px-3 py-1 border border-transparent text-sm leading-5 font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-500 focus:outline-none focus:border-indigo-700 focus:shadow-outline-indigo"
                    >
                      <svg className="-ml-1 mr-1 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                      </svg>
                      添加题目
                    </button>
                  </div>

                  {currentQuestionSet.questions.length === 0 ? (
                    <p className="text-center text-gray-500 py-8">暂无题目，请点击"添加题目"按钮</p>
                  ) : (
                    <div className="overflow-y-auto" style={{ maxHeight: '500px' }}>
                      <ul className="divide-y divide-gray-200">
                        {currentQuestionSet.questions.map((question, index) => (
                          <li key={question.id} className="py-3">
                            <div className="flex justify-between items-start">
                              <div className="flex-1 min-w-0 pr-4">
                                <p className="text-sm font-medium text-gray-900 truncate">
                                  {index + 1}. {question.question}
                                </p>
                                <p className="text-xs text-gray-500 mt-1">
                                  {question.options.length}个选项 | {question.questionType === 'single' ? '单选题' : '多选题'}
                                </p>
                              </div>
                              <div className="flex space-x-2">
                                <button 
                                  onClick={() => handleEditQuestion(question, index)}
                                  className="text-xs bg-blue-100 hover:bg-blue-200 text-blue-800 py-1 px-2 rounded"
                                >
                                  编辑
                                </button>
                                <button 
                                  onClick={() => handleDeleteQuestion(index)}
                                  className="text-xs bg-red-100 hover:bg-red-200 text-red-800 py-1 px-2 rounded"
                                >
                                  删除
                                </button>
                              </div>
                            </div>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>

                {/* 编辑区域 */}
                {(isAddingQuestion || currentQuestion) && (
                  <div className="border rounded-md p-4">
                    <h4 className="text-md font-medium text-gray-700 mb-4">
                      {isAddingQuestion ? '添加新题目' : '编辑题目'}
                    </h4>
                    
                    <div className="space-y-4">
                      {/* 题目内容 */}
                      <div>
                        <label htmlFor="question" className="block text-sm font-medium text-gray-700">
                          题目 <span className="text-red-500">*</span>
                        </label>
                        <textarea
                          id="question"
                          name="question"
                          rows={3}
                          value={questionFormData.question}
                          onChange={handleQuestionFormChange}
                          className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                          placeholder="请输入题目内容"
                        />
                      </div>

                      {/* 题目类型 */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700">
                          题目类型 <span className="text-red-500">*</span>
                        </label>
                        <div className="mt-1 flex space-x-4">
                          <label className="inline-flex items-center">
                            <input
                              type="radio"
                              name="questionType"
                              value="single"
                              checked={questionFormData.questionType === 'single'}
                              onChange={() => handleQuestionTypeChange('single')}
                              className="focus:ring-indigo-500 h-4 w-4 text-indigo-600 border-gray-300"
                            />
                            <span className="ml-2 text-sm text-gray-700">单选题</span>
                          </label>
                          <label className="inline-flex items-center">
                            <input
                              type="radio"
                              name="questionType"
                              value="multiple"
                              checked={questionFormData.questionType === 'multiple'}
                              onChange={() => handleQuestionTypeChange('multiple')}
                              className="focus:ring-indigo-500 h-4 w-4 text-indigo-600 border-gray-300"
                            />
                            <span className="ml-2 text-sm text-gray-700">多选题</span>
                          </label>
                        </div>
                      </div>

                      {/* 选项列表 */}
                      <div>
                        <div className="flex justify-between items-center mb-2">
                          <label className="block text-sm font-medium text-gray-700">
                            选项列表 <span className="text-red-500">*</span>
                          </label>
                          <p className="text-xs text-gray-500">
                            {questionFormData.questionType === 'single' ? '点击"正确答案"单选按钮选择正确答案' : '可以选择多个正确答案'}
                          </p>
                        </div>
                        
                        {questionFormData.options.length > 0 ? (
                          <ul className="space-y-2 mb-3">
                            {questionFormData.options.map((option, index) => {
                              // 检查该选项是否是正确答案
                              const isCorrect = questionFormData.questionType === 'single'
                                ? questionFormData.correctAnswer === option.id
                                : Array.isArray(questionFormData.correctAnswer) && questionFormData.correctAnswer.includes(option.id);
                              
                              return (
                                <li key={option.id} className="flex items-center space-x-3 p-2 border rounded-md">
                                  <div className="flex-shrink-0 text-gray-500 w-6">
                                    {option.id}.
                                  </div>
                                  <div className="flex-grow">
                                    {option.text}
                                  </div>
                                  <div className="flex items-center space-x-2">
                                    <label className="inline-flex items-center">
                                      {questionFormData.questionType === 'single' ? (
                                        <input
                                          type="radio"
                                          name="correctOption"
                                          checked={isCorrect}
                                          onChange={() => handleSelectCorrectAnswer(option.id)}
                                          className="focus:ring-green-500 h-4 w-4 text-green-600 border-gray-300"
                                        />
                                      ) : (
                                        <input
                                          type="checkbox"
                                          checked={isCorrect}
                                          onChange={() => handleSelectCorrectAnswer(option.id)}
                                          className="focus:ring-green-500 h-4 w-4 text-green-600 border-gray-300 rounded"
                                        />
                                      )}
                                      <span className="ml-2 text-sm text-gray-700">正确答案</span>
                                    </label>
                                    <button
                                      type="button"
                                      onClick={() => handleDeleteOption(index)}
                                      className="text-xs text-red-600 hover:text-red-900"
                                    >
                                      删除
                                    </button>
                                  </div>
                                </li>
                              );
                            })}
                          </ul>
                        ) : (
                          <p className="text-center text-gray-500 py-3 border rounded-md">
                            暂无选项，请添加选项
                          </p>
                        )}

                        {/* 添加选项表单 */}
                        <div className="mt-3 flex items-end space-x-2">
                          <div className="flex-grow">
                            <label htmlFor="optionText" className="block text-sm font-medium text-gray-700">
                              选项内容
                            </label>
                            <input
                              type="text"
                              id="optionText"
                              value={optionInput.text}
                              onChange={(e) => setOptionInput(prev => ({ ...prev, text: e.target.value }))}
                              className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                              placeholder="请输入选项内容"
                            />
                          </div>
                          <button
                            type="button"
                            onClick={handleAddOption}
                            className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-5 font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-500 focus:outline-none focus:border-indigo-700 focus:shadow-outline-indigo"
                          >
                            添加选项
                          </button>
                        </div>
                      </div>

                      {/* 解析 */}
                      <div>
                        <label htmlFor="explanation" className="block text-sm font-medium text-gray-700">
                          答案解析
                        </label>
                        <textarea
                          id="explanation"
                          name="explanation"
                          rows={3}
                          value={questionFormData.explanation}
                          onChange={handleQuestionFormChange}
                          className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                          placeholder="请输入答案解析（可选）"
                        />
                      </div>

                      {/* 保存按钮 */}
                      <div className="flex justify-end space-x-3">
                        <button
                          type="button"
                          onClick={() => {
                            setIsAddingQuestion(false);
                            setCurrentQuestion(null);
                          }}
                          className="inline-flex justify-center py-2 px-4 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                        >
                          取消
                        </button>
                        <button
                          type="button"
                          onClick={handleSaveQuestion}
                          className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                        >
                          保存题目
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
            
            <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
              <button
                type="button"
                onClick={() => setShowQuestionModal(false)}
                className="w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:ml-3 sm:w-auto sm:text-sm"
              >
                完成
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminQuestionSets; 