// @ts-nocheck - 禁用 TypeScript 未使用变量检查，这些变量和函数在完整 UI 中会被使用
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
  useEffect(() => {
    const loadQuestionSets = async () => {
      setLoadingQuestionSets(true);
      try {
        // console.log("正在从API加载题库...");
        const response = await questionSetApi.getAllQuestionSets();
        // console.log("API响应:", response);
        
        if (response.success && response.data) {
          // 确保response.data是数组
          if (Array.isArray(response.data)) {
            // Convert API format to client format
            const clientQuestionSets = response.data.map(mapApiToClientQuestionSet);
            setLocalQuestionSets(clientQuestionSets);
            // console.log("成功加载题库:", clientQuestionSets.length);
          } else {
            console.error("API返回的题库数据不是数组:", response.data);
            showStatusMessage('error', '题库数据格式不正确');
            // 使用本地数据作为备份
            setLocalQuestionSets(defaultQuestionSets);
          }
        } else {
          // console.error("加载题库失败:", response.error || response.message);
          showStatusMessage('error', `加载题库失败: ${response.error || response.message || '未知错误'}`);
          // 如果API加载失败，回退到本地数据
          setLocalQuestionSets(defaultQuestionSets);
        }
      } catch (error) {
        // console.error("加载题库出错:", error);
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
        await fetchQuestionSets();
        
        // 重置表单
        handleResetForm();
        
        showStatusMessage('success', '题库创建成功');
        onClose(); // 关闭模态框
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

  // 新增函数：关闭题目模态框并重置状态
  const handleCloseQuestionModal = () => {
    setShowQuestionModal(false);
    setIsAddingQuestion(true); // 确保下次打开时默认是添加模式
    setQuestionIndex(-1);
    setCurrentQuestion(null);
  };

  // 保存题目到题库
  const handleSaveQuestion = async () => {
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

    try {
      // 检查当前问题集是否存在
      if (!currentQuestionSet) {
        showStatusMessage('error', '当前没有选择题库');
        return;
      }

      // 准备更新后的问题集（确保拥有所有必要的非可选属性）
      const updatedQuestionSet: ClientQuestionSet = {
        ...currentQuestionSet,
        id: currentQuestionSet.id,
        title: currentQuestionSet.title,
        description: currentQuestionSet.description || '',
        category: currentQuestionSet.category,
        icon: currentQuestionSet.icon || '📝',
        isPaid: currentQuestionSet.isPaid || false,
        price: currentQuestionSet.price || 0,
        trialQuestions: currentQuestionSet.trialQuestions || 0,
        questions: [...(currentQuestionSet.questions || [])]
      };

      // 如果是添加新题目
      if (isAddingQuestion) {
        console.log("添加新题目，而不是更新");
        
        // 生成真正唯一的ID，使用时间戳+随机数
        const uniqueId = Date.now() + Math.floor(Math.random() * 1000);
        console.log("为新题目生成临时ID:", uniqueId);
        
        const newQuestion = {
          ...questionFormData,
          id: uniqueId,
        };
        
        console.log("新题目对象:", JSON.stringify(newQuestion));
        
        // 将新题目添加到问题集中
        updatedQuestionSet.questions.push(newQuestion);
        console.log("题库现在有", updatedQuestionSet.questions.length, "个题目");
      } else {
        console.log("更新现有题目，索引:", questionIndex);
        // 如果是编辑现有题目
        if (questionIndex >= 0 && questionIndex < updatedQuestionSet.questions.length) {
          updatedQuestionSet.questions[questionIndex] = {
            ...questionFormData,
          };
        } else {
          // 如果questionIndex无效但又不是添加模式，则可能是状态错误
          console.error("无效的questionIndex:", questionIndex, "但isAddingQuestion为false");
          showStatusMessage('error', '状态错误，无法保存题目');
          return;
        }
      }
      
      // 保存更新后的问题集到localQuestionSets
      setLocalQuestionSets(prev => 
        prev.map(set => 
          set.id === updatedQuestionSet.id ? updatedQuestionSet : set
        )
      );
      
      // 查看一下更新后的题库
      console.log("更新后的题库数据:", JSON.stringify({
        id: updatedQuestionSet.id,
        title: updatedQuestionSet.title,
        questionsCount: updatedQuestionSet.questions.length,
        lastQuestionId: updatedQuestionSet.questions[updatedQuestionSet.questions.length - 1]?.id
      }));
      
      // 更新当前问题集
      setCurrentQuestionSet(updatedQuestionSet);
      
      // 使用封装的函数关闭模态框并重置状态
      handleCloseQuestionModal();
      
      showStatusMessage('success', isAddingQuestion ? '题目添加成功' : '题目更新成功');
    } catch (error) {
      console.error("保存题目失败:", error);
      showStatusMessage('error', '保存题目失败');
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
      
      // 检查合并后的题库中是否有临时ID的题目
      mergedQuestionSets.forEach(set => {
        const tempQuestions = set.questions.filter(q => typeof q.id === 'number');
        if (tempQuestions.length > 0) {
          console.log(`题库「${set.title}」有${tempQuestions.length}个临时ID题目，将作为新题目添加`);
          console.log('示例临时ID:', tempQuestions.map(q => q.id).slice(0, 3));
        }
      });
      
      // 转换为API格式，确保包含所有题目
      const apiQuestionSets = mergedQuestionSets.map(set => {
        const apiSet = mapClientToApiQuestionSet(set);
        
        // 检查转换后的API格式中题目ID的处理
        const apiQuestionsWithId = apiSet.questions?.filter(q => q.id) || [];
        const apiQuestionsWithoutId = apiSet.questions?.filter(q => !q.id) || [];
        
        console.log(`题库「${set.title}」转换后：${apiQuestionsWithId.length}个有ID的题目，${apiQuestionsWithoutId.length}个没有ID的题目（新增）`);
        
        if (apiQuestionsWithoutId.length > 0) {
          console.log('新增题目示例:', JSON.stringify(apiQuestionsWithoutId[0]));
        }
        
        return apiSet;
      });
      
      // 使用批量上传API
      console.log("开始批量上传题库数据...");
      const response = await questionSetApi.uploadQuestionSets(apiQuestionSets);
      
      if (response.success) {
        console.log("上传成功，响应数据:", response.data);
        showStatusMessage('success', '所有题库更改已成功保存！');
        
        // 重新加载最新的题库数据
        const refreshResponse = await questionSetApi.getAllQuestionSets();
        if (refreshResponse.success && refreshResponse.data) {
          const refreshedSets = refreshResponse.data.map(mapApiToClientQuestionSet);
          setLocalQuestionSets(refreshedSets);
          console.log("已重新加载最新题库数据，共", refreshedSets.length, "个题库");
        }
      } else {
        console.error("上传失败:", response.error || response.message);
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
      {/* 题目管理模态框 */}
      {showQuestionModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-10 mx-auto p-5 border w-full max-w-4xl shadow-lg rounded-lg bg-white">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-semibold text-gray-900">
                题库管理: {currentQuestionSet?.title}
              </h2>
              <button 
                onClick={handleCloseQuestionModal}
                className="text-gray-400 hover:text-gray-500"
              >
                <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            {/* 题库信息 */}
            {currentQuestionSet && (
              <div className="mb-6">
                <p className="text-sm text-gray-500">
                  分类: <span className="font-medium">{currentQuestionSet.category}</span> | 
                  付费状态: <span className="font-medium">{currentQuestionSet.isPaid ? '付费' : '免费'}</span> | 
                  当前共有 <span className="font-medium">{currentQuestionSet.questions?.length || 0}</span> 题
                </p>
              </div>
            )}
            
            {/* 题目列表和表单部分 */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* 左侧：题目列表 */}
              <div className="bg-gray-50 p-4 rounded-lg max-h-[70vh] overflow-y-auto">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="font-medium">题目列表</h3>
                  <button 
                    onClick={handleAddQuestion}
                    className="text-blue-600 hover:text-blue-800 text-sm"
                  >
                    + 添加新题目
                  </button>
                </div>
                
                {currentQuestionSet && currentQuestionSet.questions?.length > 0 ? (
                  <div className="divide-y divide-gray-200">
                    {currentQuestionSet.questions.map((question, index) => (
                      <div key={question.id} className="py-3">
                        <div className="flex justify-between">
                          <div 
                            className="flex-1 cursor-pointer hover:text-blue-600"
                            onClick={() => handleEditQuestion(question, index)}
                          >
                            <span className="font-medium">#{index + 1}.</span> {question.question.length > 50 ? question.question.substring(0, 50) + '...' : question.question}
                          </div>
                          <div className="flex space-x-2">
                            <button
                              onClick={() => handleEditQuestion(question, index)}
                              className="text-blue-600 hover:text-blue-800"
                            >
                              编辑
                            </button>
                            <button
                              onClick={() => handleDeleteQuestion(index)}
                              className="text-red-600 hover:text-red-800"
                            >
                              删除
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-10">
                    <p className="text-gray-500">题库中还没有题目</p>
                    <button
                      onClick={handleAddQuestion}
                      className="mt-2 text-blue-600 hover:text-blue-800"
                    >
                      点击添加题目
                    </button>
                  </div>
                )}
              </div>
              
              {/* 右侧：题目表单 */}
              <div className="bg-white border border-gray-200 p-4 rounded-lg">
                <h3 className="font-medium mb-4">{isAddingQuestion ? "新增题目" : "编辑题目"}</h3>
                
                {/* 题目类型 */}
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">题目类型</label>
                  <div className="flex space-x-4">
                    <label className="inline-flex items-center">
                      <input
                        type="radio"
                        checked={questionFormData.questionType === 'single'}
                        onChange={() => handleQuestionTypeChange('single')}
                        className="form-radio h-4 w-4 text-blue-600"
                      />
                      <span className="ml-2 text-sm text-gray-700">单选题</span>
                    </label>
                    <label className="inline-flex items-center">
                      <input
                        type="radio"
                        checked={questionFormData.questionType === 'multiple'}
                        onChange={() => handleQuestionTypeChange('multiple')}
                        className="form-radio h-4 w-4 text-blue-600"
                      />
                      <span className="ml-2 text-sm text-gray-700">多选题</span>
                    </label>
                  </div>
                </div>
                
                {/* 题目内容 */}
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">题目内容</label>
                  <textarea
                    name="question"
                    value={questionFormData.question}
                    onChange={handleQuestionFormChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    rows={3}
                    placeholder="请输入题目内容"
                  />
                </div>
                
                {/* 选项管理 */}
                <div className="mb-4">
                  <div className="flex justify-between items-center mb-2">
                    <label className="block text-sm font-medium text-gray-700">选项</label>
                    <div className="flex items-center space-x-2">
                      <input
                        type="text"
                        value={optionInput.text}
                        onChange={(e) => setOptionInput({...optionInput, text: e.target.value})}
                        className="px-2 py-1 text-sm border border-gray-300 rounded"
                        placeholder="输入新选项"
                      />
                      <button
                        onClick={handleAddOption}
                        className="text-blue-600 hover:text-blue-800 text-sm"
                      >
                        添加
                      </button>
                    </div>
                  </div>
                  
                  {/* 选项列表 */}
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {questionFormData.options.map((option, index) => (
                      <div key={option.id} className="flex items-center">
                        {/* 单选/多选按钮 */}
                        <div className="mr-2">
                          {questionFormData.questionType === 'single' ? (
                            <input
                              type="radio"
                              checked={questionFormData.correctAnswer === option.id}
                              onChange={() => handleSelectCorrectAnswer(option.id)}
                              className="form-radio h-4 w-4 text-blue-600"
                            />
                          ) : (
                            <input
                              type="checkbox"
                              checked={Array.isArray(questionFormData.correctAnswer) && questionFormData.correctAnswer.includes(option.id)}
                              onChange={() => handleSelectCorrectAnswer(option.id)}
                              className="form-checkbox h-4 w-4 text-blue-600"
                            />
                          )}
                        </div>
                        
                        {/* 选项ID */}
                        <div className="w-6 text-center text-sm font-medium text-gray-700">
                          {option.id}
                        </div>
                        
                        {/* 选项文本 */}
                        <input
                          type="text"
                          value={option.text}
                          onChange={(e) => {
                            const updatedOptions = [...questionFormData.options];
                            updatedOptions[index].text = e.target.value;
                            setQuestionFormData({...questionFormData, options: updatedOptions});
                          }}
                          className="flex-1 px-2 py-1 ml-2 border border-gray-300 rounded text-sm"
                          placeholder={`选项 ${option.id}`}
                        />
                        
                        {/* 删除按钮 */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteOption(index);
                          }}
                          className="ml-2 text-red-600 hover:text-red-800 text-sm"
                          disabled={questionFormData.options.length <= 2}
                        >
                          删除
                        </button>
                      </div>
                    ))}
                  </div>
                  
                  <p className="text-xs text-gray-500 mt-1">
                    {questionFormData.questionType === 'single' 
                      ? '请选择一个正确答案' 
                      : '请选择一个或多个正确答案'}
                  </p>
                </div>
                
                {/* 解析 */}
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">答案解析</label>
                  <textarea
                    name="explanation"
                    value={questionFormData.explanation}
                    onChange={handleQuestionFormChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    rows={2}
                    placeholder="请输入答案解析（可选）"
                  />
                </div>
                
                {/* 保存按钮 */}
                <div className="flex justify-end space-x-2 mt-6">
                  <button
                    onClick={handleCloseQuestionModal}
                    className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none"
                  >
                    取消
                  </button>
                  <button
                    onClick={handleSaveQuestion}
                    className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none"
                  >
                    保存题目
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* 组件 UI 内容... */}
    </div>
  );
};

export default AdminQuestionSets;