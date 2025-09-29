// @ts-nocheck - 禁用 TypeScript 未使用变量检查，这些变量和函数在完整 UI 中会被使用
import React, { useState, useEffect, useCallback } from 'react';
import { Question, Option, QuestionSet } from '../../types';
import { useUser } from '../../contexts/UserContext';
import { questionSetApi, questionApi, redeemCodeApi } from '../../utils/api';
import axios from 'axios';  // 添加axios导入
import Modal from 'react-modal';
import { Alert, Form, Input, Radio, Button, Checkbox } from 'antd';
import { PlusOutlined, DeleteOutlined } from '@ant-design/icons';
import { toast } from 'react-hot-toast';

type QuestionType = 'single' | 'multiple';

// 转换API格式的题目到前端使用的格式
const mapApiToClientQuestion = (question: any): any => {
  return {
    id: question.id,
    question: question.text || '',
    questionType: question.questionType || 'single',
    options: (question.options || []).map(o => ({
      id: o.id || '',
      text: o.text
    })),
    correctAnswer: question.correctAnswer || '',
    explanation: question.explanation || ''
  };
};

// 转换前端格式的题目到API使用的格式
const mapClientToApiQuestion = (question: any): any => {
  return {
    id: question.id,
    text: question.question,
    questionType: question.questionType,
    explanation: question.explanation,
    options: question.options.map(opt => ({
      id: opt.id,
      text: opt.text,
      isCorrect: Array.isArray(question.correctAnswer) 
        ? question.correctAnswer.includes(opt.id)
        : question.correctAnswer === opt.id
    }))
  };
};

const AdminQuestionSets = () => {
  const { isAdmin } = useUser();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusMessage, setStatusMessage] = useState({ type: '', message: '' });
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showEditForm, setShowEditForm] = useState(false);
  const [questionSets, setQuestionSets] = useState<QuestionSet[]>([]);
  const [currentQuestionSet, setCurrentQuestionSet] = useState<QuestionSet | null>(null);
  const [formData, setFormData] = useState({
    id: '',
    title: '',
    description: '',
    category: '',
    icon: '📝',
    isPaid: false,
    price: 29.9,
    trialQuestions: 0,
    isFeatured: false,
    featuredCategory: '',
    questions: [] as Question[]
  });
  const [loading, setLoading] = useState(false);
  const [loadingQuestionSets, setLoadingQuestionSets] = useState(true);
  const [loadingAction, setLoadingAction] = useState('');

  // 兑换码相关
  const [redeemCodes, setRedeemCodes] = useState([]);
  const [showRedeemCodeModal, setShowRedeemCodeModal] = useState(false);
  const [selectedQuizForCode, setSelectedQuizForCode] = useState<QuestionSet | null>(null);
  const [codeDurationDays, setCodeDurationDays] = useState(30);
  const [codeQuantity, setCodeQuantity] = useState(1);
  const [generatedCodes, setGeneratedCodes] = useState([]);
  const [codeFilterStatus, setCodeFilterStatus] = useState('all');
  const [codeFilterQuizId, setCodeFilterQuizId] = useState<string | null>(null);

  // 题目管理相关
  const [showQuestionModal, setShowQuestionModal] = useState(false);
  const [currentQuestion, setCurrentQuestion] = useState<any | null>(null);
  const [questionFormData, setQuestionFormData] = useState<{
    id: string;
    question: string;
    questionType: 'single' | 'multiple';
    options: Option[];
    correctAnswer: string | string[];
    explanation: string;
  }>({
    id: '',
    question: '',
    questionType: 'single',
    options: [],
    correctAnswer: '',
    explanation: ''
  });
  const [optionInput, setOptionInput] = useState({ id: '', text: '' });
  const [questionIndex, setQuestionIndex] = useState<number>(-1);
  const [isAddingQuestion, setIsAddingQuestion] = useState(false);

  // 文件上传相关
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  
  // 添加图片上传相关状态
  const [iconImageFile, setIconImageFile] = useState<File | null>(null);
  const [iconImagePreview, setIconImagePreview] = useState<string | null>(null);
  const iconImageInputRef = React.useRef<HTMLInputElement>(null);
  
  // 状态消息
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // 可选的分类和图标
  const categoryOptions = [
  'フロントエンド開発',   // 前端开发
  'バックエンド開発',     // 后端开发
  'フルスタック開発',     // 全栈开发
  'モバイル開発',         // 移动开发
  'データベース',         // 数据库
  '人工知能',             // 人工智能
  'ネットワークセキュリティ', // 网络安全
  'オペレーティングシステム', // 操作系统
  'ソフトウェア工学',     // 软件工程
  'コンピュータ基礎',     // 计算机基础
  'ネットワークプロトコル', // 网络协议
  'クラウドコンピューティング', // 云计算
  'ブロックチェーン',     // 区块链
  'ビッグデータ',         // 大数据
  'サーバー運用',         // 服务器运维
  'その他'               // 其他
];
  
  const iconOptions = [
    '📝', '📚', '💻', '🔍', '🧩', '⚙️', '📊', '🔐', '📡', '🛠️',
    '🧪', '🔬', '📱', '🌐', '🤖', '🧠', '🔥', '💾', '⚡', '☁️'
  ];

  // 显示状态消息
  const showStatusMessage = (type: string, message: string) => {
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
  const loadRedeemCodes = async () => {
    try {
      const response = await redeemCodeApi.getAllRedeemCodes();
      if (response.success && response.data) {
        setRedeemCodes(response.data);
      } else {
        console.error("引き換えコードの読み込みに失敗:", response.error);
      }
    } catch (error) {
      console.error("引き換えコードの読み込みエラー:", error);
    }
  };

  // 从API加载题库数据
  // 获取题库题目数量的辅助函数
  const extractQuestionCount = (payload: any): number | null => {
    if (payload === null || payload === undefined) {
      return null;
    }

    if (typeof payload === 'number' && !Number.isNaN(payload)) {
      return payload;
    }

    if (typeof payload === 'object') {
      const maybeCount = (payload as any).count;
      if (typeof maybeCount === 'number' && !Number.isNaN(maybeCount)) {
        return maybeCount;
      }

      if (Object.prototype.hasOwnProperty.call(payload, 'data')) {
        return extractQuestionCount((payload as any).data);
      }
    }

    return null;
  };

  const deriveLocalCount = (questionSet: QuestionSet): number | null => {
    if (typeof questionSet?.questionCount === 'number' && questionSet.questionCount > 0) {
      return questionSet.questionCount;
    }

    const embeddedQuestions = (questionSet as any)?.questionSetQuestions;
    if (Array.isArray(embeddedQuestions) && embeddedQuestions.length > 0) {
      return embeddedQuestions.length;
    }

    if (Array.isArray(questionSet?.questions) && questionSet.questions.length > 0) {
      return questionSet.questions.length;
    }

    return null;
  };

  const fetchQuestionCountDetails = async (questionSetId: string) => {
    if (!questionSetId) {
      console.log('[DEBUG] fetchQuestionCountDetails: questionSetId为空');
      return { success: false, count: 0 };
    }

    try {
      console.log('[DEBUG] fetchQuestionCountDetails: 调用getQuestionCount API，questionSetId:', questionSetId);
      const response = await questionSetApi.getQuestionCount(questionSetId);
      console.log('[DEBUG] fetchQuestionCountDetails: API响应:', response);

      if (response?.success) {
        const count = extractQuestionCount(response.data);
        console.log('[DEBUG] fetchQuestionCountDetails: 提取的计数:', count);

        if (typeof count === 'number' && !Number.isNaN(count)) {
          return { success: true, count };
        }

        const fallbackCount = extractQuestionCount(response as any);
        console.log('[DEBUG] fetchQuestionCountDetails: 回退计数:', fallbackCount);
        if (typeof fallbackCount === 'number' && !Number.isNaN(fallbackCount)) {
          return { success: true, count: fallbackCount };
        }
      } else {
        console.warn('[DEBUG] 获取题库题目数量返回失败', questionSetId, response?.error || response?.message);
        console.warn('[DEBUG] 完整响应对象:', response);
      }
    } catch (error) {
      console.error('[DEBUG] 获取题库题目数量失败', questionSetId, error);
    }

    return { success: false, count: 0 };
  };

  const loadQuestionSets = async () => {
    setLoadingQuestionSets(true);
    try {
      console.log("正在从API加载题库...");
      const response = await questionSetApi.getAllQuestionSets();

      if (response.success && Array.isArray(response.data)) {
        const enrichedQuestionSets = await Promise.all(
          response.data.map(async (questionSet: any) => {
            const localCount = deriveLocalCount(questionSet);

            if (localCount !== null) {
              return { ...questionSet, questionCount: localCount };
            }

            const { success: countFetched, count } = await fetchQuestionCountDetails(questionSet.id);

            if (countFetched) {
              return { ...questionSet, questionCount: count };
            }

            return {
              ...questionSet,
              questionCount: typeof questionSet?.questionCount === 'number' ? questionSet.questionCount : 0
            };
          })
        );

        setQuestionSets(enrichedQuestionSets);
        console.log("成功加载题库:", enrichedQuestionSets.length);
      } else if (response.success && response.data && !Array.isArray(response.data)) {
        console.error("API返回的题库数据不是数组:", response.data);
        showStatusMessage('error', '题库数据格式不正确');
      } else {
        const errorMessage = response.error || response.message || '未知错误';
        console.error("加载题库失败:", errorMessage);
        showStatusMessage('error', `加载题库失败: ${errorMessage}`);
      }
    } catch (error) {
      console.error("加载题库出错:", error);
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
  const filteredQuestionSets = questionSets.filter(set => 
    set.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
    set.category.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // 处理表单输入变化
  const handleFormChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  // 添加图片上传处理函数
  const handleIconImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) {
      return;
    }
    
    const file = e.target.files[0];
    
    // 检查文件类型和大小
    if (!file.type.startsWith('image/')) {
      setErrorMessage('请选择图片文件');
      return;
    }
    
    if (file.size > 5 * 1024 * 1024) { // 5MB限制
      setErrorMessage('图片大小不能超过5MB');
      return;
    }
    
    // 创建预览
    const reader = new FileReader();
    reader.onloadend = () => {
      setIconImagePreview(reader.result as string);
      setIconImageFile(file);
      
      // 使用自定义图标时，清除emoji选择
      setFormData(prev => ({...prev, icon: ''}));
    };
    reader.readAsDataURL(file);
  };
  
  // 处理移除图片
  const handleRemoveIconImage = () => {
    setIconImagePreview(null);
    setIconImageFile(null);
    
    if (iconImageInputRef.current) {
      iconImageInputRef.current.value = '';
    }
  };

  // 创建新题库
  const handleCreateQuestionSet = async () => {
    // 表单验证
    if (!formData.title) {
      toast.error('请输入题库标题');
      return;
    }
    
    if (!formData.category) {
      toast.error('请选择题库分类');
      return;
    }
    
    // 验证图标 - 现在可以是emoji或上传的图片
    if (!formData.icon && !iconImageFile) {
      toast.error('请选择题库图标或上传自定义图片');
      return;
    }
    
    try {
      setLoading(true);
      setLoadingAction('create');
      
      // 创建题库基本信息
      const { questionSetService } = await import('../../services/api');
      const response = await questionSetService.createQuestionSet({
        title: formData.title,
        description: formData.description,
        category: formData.category,
        icon: formData.icon, // 如果使用emoji，保存emoji；如果使用自定义图片，这里暂时为空
        isPaid: formData.isPaid,
        price: formData.isPaid ? formData.price : undefined,
        trialQuestions: formData.isPaid ? formData.trialQuestions : undefined,
        isFeatured: formData.isFeatured,
        featuredCategory: formData.isFeatured ? formData.featuredCategory : undefined
      });
      
      if (!response.success || !response.data) {
        throw new Error(response.message || '创建题库失败');
      }
      
      const newSetId = response.data.id;
      
      // 如果有自定义图片，上传图片
      if (iconImageFile) {
        const formData = new FormData();
        formData.append('image', iconImageFile);
        formData.append('questionSetId', newSetId);
        
        try {
          const uploadResponse = await fetch('/api/admin/upload/card-image', {
            method: 'POST',
            body: formData,
            credentials: 'include'
          });
          
          if (!uploadResponse.ok) {
            console.warn('图片上传失败，但题库已创建');
            toast.warning('题库已创建，但图片上传失败');
          } else {
            const uploadData = await uploadResponse.json();
            if (uploadData.success) {
              console.log('题库图片上传成功:', uploadData.data.imageUrl);
              toast.success('题库和自定义图标创建成功');
            } else {
              toast.warning('题库已创建，但图片上传失败');
            }
          }
        } catch (uploadError) {
          console.error('上传图片出错:', uploadError);
          toast.warning('题库已创建，但图片上传失败');
        }
      } else {
        toast.success('题库创建成功');
      }
      
      console.log('创建题库成功:', response.data);
      
      // 重置表单
      setFormData({
        title: '',
        description: '',
        category: '',
        icon: '',
        isPaid: false,
        price: 0,
        trialQuestions: 0,
        isFeatured: false,
        featuredCategory: ''
      });
      
      // 重置图片相关状态
      setIconImagePreview(null);
      setIconImageFile(null);
      if (iconImageInputRef.current) {
        iconImageInputRef.current.value = '';
      }
      
      // 刷新题库列表
      await loadQuestionSets();
      
    } catch (error) {
      console.error('创建题库出错:', error);
      toast.error(`创建题库失败: ${error instanceof Error ? error.message : '未知错误'}`);
    } finally {
      setLoading(false);
      setLoadingAction('');
    }
  };

  // 点击编辑题库按钮
  const handleEditClick = (questionSet) => {
    setCurrentQuestionSet(questionSet);
    
    // 检查图标是否为图片URL
    const isIconImage = questionSet.icon && (questionSet.icon.startsWith('/') || questionSet.icon.includes('http'));
    
    // 如果图标是图片URL，设置预览
    if (isIconImage) {
      setIconImagePreview(questionSet.icon);
      // 不设置iconImageFile，因为这是一个已存在的图片URL
    } else {
      setIconImagePreview(null);
    }
    
    setFormData({
      id: questionSet.id,
      title: questionSet.title,
      description: questionSet.description || '',
      category: questionSet.category,
      icon: isIconImage ? '' : (questionSet.icon || '📝'), // 如果是图片URL，不设置emoji图标
      isPaid: questionSet.isPaid || false,
      price: questionSet.price || 29.9,
      trialQuestions: questionSet.trialQuestions || 0,
      isFeatured: questionSet.isFeatured || false,
      featuredCategory: questionSet.featuredCategory || '',
      questions: questionSet.questions || []
    });
    setShowEditForm(true);
  };

  // 添加更新题目数量的函数
  const updateQuestionCount = async (questionSetId) => {
    if (!questionSetId) {
      console.log('[DEBUG] updateQuestionCount: questionSetId为空');
      return false;
    }

    try {
      console.log('[DEBUG] updateQuestionCount: 开始获取题目数量，questionSetId:', questionSetId);
      const { success, count } = await fetchQuestionCountDetails(questionSetId);
      console.log('[DEBUG] updateQuestionCount: fetchQuestionCountDetails结果:', { success, count });

      if (success) {
        setQuestionSets((previousSets) =>
          previousSets.map((questionSet) =>
            questionSet.id === questionSetId
              ? { ...questionSet, questionCount: count }
              : questionSet
          )
        );
        console.log('[DEBUG] 同步题库题目数量成功', questionSetId, count);
        return true;
      }

      console.error('[DEBUG] 同步题库题目数量失败', questionSetId);
      return false;
    } catch (error) {
      console.error('[DEBUG] 同步题库题目数量出错', questionSetId, error);
      return false;
    }
  };

  // 修改handleEditSubmit函数以包含题目数量更新
  const handleEditSubmit = async () => {
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
        price: formData.isPaid ? parseFloat(formData.price) : undefined,
        trialQuestions: formData.isPaid ? parseInt(formData.trialQuestions) : undefined,
        isFeatured: formData.isFeatured,
        featuredCategory: formData.featuredCategory
      };
      
      // 调用API更新题库
      const response = await questionSetApi.updateQuestionSet(formData.id, updatedQuestionSet);
      
      if (response.success && response.data) {
        // 如果有上传新图片，处理图片上传
        if (iconImageFile) {
          try {
            const imageFormData = new FormData();
            imageFormData.append('image', iconImageFile);
            imageFormData.append('questionSetId', formData.id);
            
            const uploadResponse = await fetch('/api/admin/upload/card-image', {
              method: 'POST',
              body: imageFormData,
              credentials: 'include'
            });
            
            if (!uploadResponse.ok) {
              console.warn('图片上传失败，但题库已更新');
              showStatusMessage('warning', '题库已更新，但图片上传失败');
            } else {
              const uploadData = await uploadResponse.json();
              if (uploadData.success) {
                console.log('题库图片上传成功:', uploadData.data.imageUrl);
                showStatusMessage('success', '题库和图标更新成功');
              } else {
                showStatusMessage('warning', '题库已更新，但图片上传失败');
              }
            }
          } catch (uploadError) {
            console.error('上传图片出错:', uploadError);
            showStatusMessage('warning', '题库已更新，但图片上传失败');
          }
        } else {
          // 没有上传新图片，正常更新成功
          showStatusMessage('success', '题库更新成功');
        }
        
        // 更新题目数量
        await updateQuestionCount(formData.id);
        
        setShowEditForm(false);
        
        // 重置图片相关状态
        setIconImagePreview(null);
        setIconImageFile(null);
        if (iconImageInputRef.current) {
          iconImageInputRef.current.value = '';
        }
        
        await loadQuestionSets();  // 重新加载全部题库
      } else {
        showStatusMessage('error', `更新题库失败: ${response.error || '未知错误'}`);
      }
    } catch (error) {
      console.error("更新题库出错:", error);
      showStatusMessage('error', '更新题库时发生错误');
    } finally {
      setLoading(false);
      setLoadingAction('');
    }
  };

  // 删除题库
  const handleDeleteQuestionSet = async (id) => {
    if (!window.confirm('この問題集を削除しますか？この操作は元に戻せません！')) {
      return;
    }
    
    setLoading(true);
    setLoadingAction(`delete-${id}`);
    
    try {
      // 调用API删除题库
      const response = await questionSetApi.deleteQuestionSet(id);
      
      if (response.success) {
        showStatusMessage('success', '問題集が正常に削除されました');
        await loadQuestionSets();  // 重新加载全部题库
      } else {
        showStatusMessage('error', `問題集の削除に失敗: ${response.error || '不明なエラー'}`);
      }
    } catch (error) {
      console.error("删除题库出错:", error);
      showStatusMessage('error', '問題集の削除中にエラーが発生しました');
    } finally {
      setLoading(false);
      setLoadingAction('');
    }
  };

  // 显示生成兑换码模态框
  const handleShowGenerateCodeModal = (questionSet) => {
    setSelectedQuizForCode(questionSet);
    setShowRedeemCodeModal(true);
    setCodeDurationDays(30);
    setCodeQuantity(1);
    setGeneratedCodes([]);
  };

  // 生成兑换码
  const handleGenerateCode = async () => {
    if (!selectedQuizForCode) return;
    
    setLoading(true);
    setLoadingAction('generate-code');
    
    try {
      // 调用API生成兑换码
      const response = await redeemCodeApi.generateRedeemCodes(
        selectedQuizForCode.id, 
        codeDurationDays,
        codeQuantity
      );
      
      if (response.success && response.data) {
        setGeneratedCodes(response.data);
        showStatusMessage('success', `成功生成${response.data.length}个兑换码`);
        await loadRedeemCodes();  // 重新加载兑换码
      } else {
        showStatusMessage('error', `引換コードの生成に失敗: ${response.error || '不明なエラー'}`);
      }
    } catch (error) {
      console.error("生成兑换码出错:", error);
      showStatusMessage('error', '生成兑换码时发生错误');
    } finally {
      setLoading(false);
      setLoadingAction('');
    }
  };

  // 初始化添加問題的表单
  const handleAddQuestion = () => {
    // 重置問題表单
    setQuestionFormData({
      id: '',
      question: '',
      questionType: 'single',
      options: [
        { id: 'opt1', text: '' },
        { id: 'opt2', text: '' }
      ],
      correctAnswer: '',
      explanation: ''
    });
    setIsAddingQuestion(true);
    setCurrentQuestion(null);
    setShowQuestionModal(true);
  };

  // 编辑問題
  const handleEditQuestion = (question, index) => {
    setQuestionIndex(index);
    setCurrentQuestion(question);
    setQuestionFormData({
      id: question.id,
      question: question.question,
      questionType: question.questionType,
      options: question.options,
      correctAnswer: question.correctAnswer,
      explanation: question.explanation
    });
    setShowQuestionModal(true);
  };

  // 删除問題
  const handleDeleteQuestion = async (index) => {
    if (!currentQuestionSet) return;
    
    if (!window.confirm('この問題を削除しますか？この操作は元に戻せません！')) {
      return;
    }
    
    const updatedQuestions = [...currentQuestionSet.questions];
    updatedQuestions.splice(index, 1);
    
    setCurrentQuestionSet({
      ...currentQuestionSet,
      questions: updatedQuestions
    });
    
    console.log('[DEBUG] 开始删除问题，当前问题数量:', updatedQuestions.length);
    
    // 直接更新题库中的問題列表
    await handleUpdateQuestions(updatedQuestions);
    
    console.log('[DEBUG] 问题删除完成');
  };

  // 选择正确答案
  const handleSelectCorrectAnswer = (optionId) => {
    if (questionFormData.questionType === 'single') {
      setQuestionFormData({
        ...questionFormData,
        correctAnswer: optionId
      });
    } else {
      const currentAnswers = Array.isArray(questionFormData.correctAnswer) 
        ? [...questionFormData.correctAnswer] 
        : [];
      
      if (currentAnswers.includes(optionId)) {
        setQuestionFormData({
          ...questionFormData,
          correctAnswer: currentAnswers.filter(id => id !== optionId)
        });
      } else {
        setQuestionFormData({
          ...questionFormData,
          correctAnswer: [...currentAnswers, optionId]
        });
      }
    }
  };

  // 修改选项文本
  const handleOptionChange = (index, text) => {
    const updatedOptions = [...questionFormData.options];
    updatedOptions[index] = {
      ...updatedOptions[index],
      text
    };
    
    setQuestionFormData({
      ...questionFormData,
      options: updatedOptions
    });
  };

  // 添加新选项
  const handleAddOption = () => {
    const newOptionId = `opt${questionFormData.options.length + 1}`;
    setQuestionFormData({
      ...questionFormData,
      options: [...questionFormData.options, { id: newOptionId, text: '' }]
    });
  };

  // 删除选项
  const handleDeleteOption = (index) => {
    if (questionFormData.options.length <= 2) return;
    
    const updatedOptions = [...questionFormData.options];
    const deletedOption = updatedOptions[index];
    updatedOptions.splice(index, 1);
    
    // 如果删除的是正确答案，需要更新correctAnswer
    let updatedCorrectAnswer = questionFormData.correctAnswer;
    
    if (questionFormData.questionType === 'single' && questionFormData.correctAnswer === deletedOption.id) {
      updatedCorrectAnswer = '';
    } else if (questionFormData.questionType === 'multiple' && Array.isArray(questionFormData.correctAnswer)) {
      updatedCorrectAnswer = questionFormData.correctAnswer.filter(id => id !== deletedOption.id);
    }
    
    setQuestionFormData({
      ...questionFormData,
      options: updatedOptions,
      correctAnswer: updatedCorrectAnswer
    });
  };

  // 直接添加問題到服务器
  const handleDirectAddQuestion = async () => {
    if (!currentQuestionSet) return;
    
    // 验证表单
    if (!questionFormData.question) {
      showStatusMessage('error', '問題内容不能为空');
      return;
    }
    
    if (questionFormData.options.length < 2) {
      showStatusMessage('error', '至少需要两个选项');
      return;
    }
    
    if (questionFormData.options.some(opt => !opt.text.trim())) {
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
      // 转换問題格式为API格式
      const questionData = mapClientToApiQuestion(questionFormData);
      
      // 重要: 确保传入当前题库的ID
      const response = await questionApi.addQuestion(currentQuestionSet.id, questionData);
      
      if (response.success && response.data) {
        // 将API返回的問題转换为前端格式并添加到当前题库
        const apiQuestion = response.data;
        const clientQuestion = mapApiToClientQuestion(apiQuestion);
        
        const updatedQuestions = [...(currentQuestionSet.questions || []), clientQuestion];
        
        setCurrentQuestionSet({
          ...currentQuestionSet,
          questions: updatedQuestions
        });
        
        // 更新题目数量
        await updateQuestionCount(currentQuestionSet.id);
        
        showStatusMessage('success', '問題添加成功');
        setIsAddingQuestion(false);
        setShowQuestionModal(false);
        
        // 重置表单
        setQuestionFormData({
          id: '',
          question: '',
          questionType: 'single',
          options: [
            { id: 'opt1', text: '' },
            { id: 'opt2', text: '' }
          ],
          correctAnswer: '',
          explanation: ''
        });
      } else {
        showStatusMessage('error', `添加問題失败: ${response.error || '未知错误'}`);
      }
    } catch (error) {
      console.error("添加問題出错:", error);
      showStatusMessage('error', '添加問題时发生错误');
    } finally {
      setLoading(false);
      setLoadingAction('');
    }
  };

  // 更新题库的問題列表
  const handleUpdateQuestions = async (questions) => {
    if (!currentQuestionSet) return;
    
    setLoading(true);
    setLoadingAction('updateQuestions');
    
    try {
      console.log('[DEBUG] 更新问题列表开始，问题数量:', questions.length);
      
      // 转换问题数据格式以匹配后端期望的格式
      const formattedQuestions = questions.map(question => {
        console.log('正在格式化问题:', question);
        
        return {
          id: question.id,
          question: question.question || question.text, // 支持两种字段名
          text: question.question || question.text,     // 后端期望的字段名
          questionType: question.questionType || 'single',
          explanation: question.explanation || '',
          options: (question.options || []).map(opt => ({
            id: opt.id,
            text: opt.text,
            isCorrect: Array.isArray(question.correctAnswer) 
              ? question.correctAnswer.includes(opt.id)
              : question.correctAnswer === opt.id
          })),
          correctAnswer: question.correctAnswer
        };
      });
      
      console.log('[DEBUG] 发送到后端的问题数据:', formattedQuestions);
      console.log('[DEBUG] 调用API: updateQuestionSetQuestions');
      
      // 使用专门的问题列表更新端点
      const response = await questionSetApi.updateQuestionSetQuestions(
        currentQuestionSet.id, 
        { questions: formattedQuestions }
      );
      
      console.log('[DEBUG] API响应:', response);
      
      if (response.success && response.data) {
        console.log('[DEBUG] 问题列表更新成功，开始更新计数');
        
        // 更新题目数量
        const countResult = await updateQuestionCount(currentQuestionSet.id);
        console.log('[DEBUG] 计数更新结果:', countResult);
        
        showStatusMessage('success', '問題列表更新成功');
        // 更新本地状态
        setCurrentQuestionSet(response.data);
      } else {
        console.log('[DEBUG] 问题列表更新失败:', response);
        showStatusMessage('error', `更新問題列表失败: ${response.error || response.message || '未知错误'}`);
      }
    } catch (error) {
      console.error("[DEBUG] 更新問題列表出错:", error);
      showStatusMessage('error', '更新問題列表时发生错误');
    } finally {
      setLoading(false);
      setLoadingAction('');
    }
  };

  // 直接更新問題
  const handleDirectUpdateQuestion = async () => {
    if (!currentQuestionSet || !currentQuestion) return;
    
    // 验证表单
    if (!questionFormData.question) {
      showStatusMessage('error', '問題内容不能为空');
      return;
    }
    
    if (questionFormData.options.length < 2) {
      showStatusMessage('error', '至少需要两个选项');
      return;
    }
    
    if (questionFormData.options.some(opt => !opt.text.trim())) {
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
      // 转换問題格式为API格式
      const questionData = mapClientToApiQuestion(questionFormData);
      
      // 调用API更新問題
      const response = await questionApi.updateQuestion(questionFormData.id, questionData);
      
      if (response.success && response.data) {
        // 将API返回的問題转换为前端格式
        const apiQuestion = response.data;
        const updatedQuestion = mapApiToClientQuestion(apiQuestion);
        
        // 更新题库中的問題
        const updatedQuestions = [...currentQuestionSet.questions];
        updatedQuestions[questionIndex] = updatedQuestion;
        
        setCurrentQuestionSet({
          ...currentQuestionSet,
          questions: updatedQuestions
        });
        
        // 更新题目数量
        await updateQuestionCount(currentQuestionSet.id);
        
        showStatusMessage('success', '問題更新成功');
        setCurrentQuestion(null);
        setShowQuestionModal(false);
      } else {
        showStatusMessage('error', `更新問題失败: ${response.error || '未知错误'}`);
      }
    } catch (error) {
      console.error("更新問題出错:", error);
      showStatusMessage('error', '更新問題时发生错误');
    } finally {
      setLoading(false);
      setLoadingAction('');
    }
  };

  // 修改handleSaveAllChanges函数，添加题目数量更新
  const handleSaveAllChanges = async () => {
    setLoading(true);
    setLoadingAction('saveAll');
    
    try {
      // 更新所有题库的题目数量
      if (questionSets.length > 0) {
        setStatusMessage({ type: 'info', message: '正在更新题库数量信息...' });
        
        // 对每个题库进行题目数量更新
        for (const set of questionSets) {
          await updateQuestionCount(set.id);
        }
      }
      
      await loadQuestionSets();
      showStatusMessage('success', '数据刷新成功');
    } catch (error) {
      console.error("データを更新する出错:", error);
      showStatusMessage('error', 'データを更新する时发生错误');
    } finally {
      setLoading(false);
      setLoadingAction('');
    }
  };

  // 添加单个题库刷新题目数量的函数
  const refreshQuestionSetCount = async (questionSet) => {
    try {
      setLoadingAction(`refresh-count-${questionSet.id}`);

      const countUpdated = await updateQuestionCount(questionSet.id);

      if (!countUpdated) {
        showStatusMessage('error', '题目数量同步失败，请稍后再试');
        return;
      }

      await loadQuestionSets();
      showStatusMessage('success', `题库"${questionSet.title}"题目数量已刷新`);
    } catch (error) {
      console.error(`刷新题库${questionSet.id}题目数量失败:`, error);
      showStatusMessage('error', '题目数量刷新失败');
    } finally {
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
    
    // 添加获取题目数量的辅助函数
    const getQuestionCount = (set: QuestionSet): number => {
      // 直接使用questionCount属性 (如果存在且为数字)
      if (typeof set.questionCount === 'number' && set.questionCount > 0) {
        return set.questionCount;
      }
      
      // 从questionSetQuestions数组计算数量
      if (set.questionSetQuestions && Array.isArray(set.questionSetQuestions)) {
        return set.questionSetQuestions.length;
      }
      
      // 从questions数组计算数量
      if (set.questions && Array.isArray(set.questions)) {
        return set.questions.length;
      }
      
      // 默认返回0
      return 0;
    };
    
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredQuestionSets.map(questionSet => (
          <div 
            key={questionSet.id} 
            className="bg-white p-5 rounded-lg shadow hover:shadow-md transition-shadow border border-gray-200"
          >
            <div className="flex justify-between items-start mb-4">
              <div className="flex items-center">
                <div className="w-8 h-8 mr-2 flex items-center justify-center text-2xl overflow-hidden">
                  {questionSet.icon && (questionSet.icon.startsWith('/') || questionSet.icon.includes('http')) ? (
                    <img src={questionSet.icon} alt={questionSet.title} className="w-full h-full object-cover rounded-md" />
                  ) : (
                    <span>{questionSet.icon || '📝'}</span>
                  )}
                </div>
                <h3 className="text-lg font-medium">{questionSet.title}</h3>
              </div>
              <div className="flex flex-wrap gap-1">
                {questionSet.isPaid && (
                  <span className="inline-block bg-yellow-100 text-yellow-800 text-xs px-2 py-1 rounded">
                    付费
                  </span>
                )}
                {questionSet.isFeatured && (
                  <span className="inline-block bg-purple-100 text-purple-800 text-xs px-2 py-1 rounded">
                    精选
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
              <span className="flex items-center">
                题目数量: {getQuestionCount(questionSet)}
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    refreshQuestionSetCount(questionSet);
                  }}
                  className="ml-1 text-blue-500 hover:text-blue-700"
                  disabled={loading && loadingAction === `refresh-count-${questionSet.id}`}
                  title="刷新题目数量"
                >
                  {loading && loadingAction === `refresh-count-${questionSet.id}` ? (
                    <svg className="animate-spin h-3 w-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                  )}
                </button>
              </span>
              <span>ID: {questionSet.id}</span>
            </div>
            
            {/* 添加编辑按钮卡片 */}
            <div className="bg-gray-50 p-3 -mx-5 -mb-5 mt-3 border-t border-gray-100 grid grid-cols-2 gap-2">
              <button 
                className="flex items-center justify-center py-2 px-3 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded"
                onClick={() => {
                  setCurrentQuestionSet(questionSet);
                  setShowQuestionModal(true);
                }}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
                管理题目
              </button>
              
              <button 
                className="flex items-center justify-center py-2 px-3 bg-green-50 text-green-600 hover:bg-green-100 rounded"
                onClick={() => handleEditClick(questionSet)}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                编辑题库
              </button>
              
              <button 
                className="flex items-center justify-center py-2 px-3 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 rounded"
                onClick={() => handleShowGenerateCodeModal(questionSet)}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                </svg>
                生成兑换码
              </button>
              
              <button 
                className="flex items-center justify-center py-2 px-3 bg-red-50 text-red-600 hover:bg-red-100 rounded"
                onClick={() => handleDeleteQuestionSet(questionSet.id)}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                删除题库
              </button>
            </div>
          </div>
        ))}
      </div>
    );
  };

  // 组件的返回语句 - 实际 UI 部分
  return (
    <div>
      {/* 問題管理模态框 */}
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
                  {currentQuestionSet.questions?.length || 0} 个問題
                </span>
              </h2>
            </div>
          )}
          
          {/* 添加問題列表 */}
          {currentQuestionSet && currentQuestionSet.questions && currentQuestionSet.questions.length > 0 && (
            <div className="mb-4">
              <h3 className="text-md font-medium mb-2">問題列表</h3>
              <div className="bg-gray-50 p-2 rounded max-h-60 overflow-y-auto">
                <table className="min-w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 px-3 w-8">#</th>
                      <th className="text-left py-2 px-3">問題内容</th>
                      <th className="text-left py-2 px-3 w-24">問題类型</th>
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
                  添加新問題
                </Button>
              </div>
              
              <div className="border-t border-gray-200 my-4"></div>
            </div>
          )}
          
          {/* 当前没有問題时显示提示 */}
          {currentQuestionSet && (!currentQuestionSet.questions || currentQuestionSet.questions.length === 0) && !currentQuestion && (
            <div className="text-center py-4 mb-4 bg-gray-50 rounded">
              <p className="text-gray-500 mb-3">当前题库还没有問題</p>
              <Button 
                type="primary" 
                onClick={handleAddQuestion}
                icon={<PlusOutlined />}
              >
                添加第一个問題
              </Button>
            </div>
          )}
          
          {/* 問題表单 - 当添加或编辑問題时显示 */}
          {(isAddingQuestion || currentQuestion) && (
            <div>
              <h3 className="text-md font-medium mb-2">
                {currentQuestion ? '编辑問題' : '添加新問題'}
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
                    キャンセル
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
                    <p>兑换码: <strong>{generatedCodes.map(code => code.code).join(', ')}</strong></p>
                    <p>有效期至: {generatedCodes.map(code => new Date(code.expiryDate).toLocaleString()).join(', ')}</p>
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
                <option value="">请选择分类</option>
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
            
            {/* 添加自定义图片上传区域 */}
            <div className="mb-4">
              <label className="block mb-2 text-sm font-medium text-gray-700">
                自定义图标图片 <span className="text-xs text-gray-500">(可选，会替代emoji图标)</span>
              </label>
              
              <div className="flex items-center space-x-4">
                <div className="flex-grow">
                  <label className="flex justify-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 cursor-pointer">
                    <span>{iconImageFile ? '更换图片' : (iconImagePreview ? '更换图片' : '选择图片')}</span>
                    <input
                      type="file"
                      className="sr-only"
                      accept="image/*"
                      ref={iconImageInputRef}
                      onChange={handleIconImageSelect}
                    />
                  </label>
                </div>
                
                {iconImagePreview && (
                  <div className="flex items-center space-x-2">
                    <div className="w-16 h-16 border rounded-md overflow-hidden">
                      <img 
                        src={iconImagePreview} 
                        alt="图标预览" 
                        className="w-full h-full object-cover" 
                      />
                    </div>
                    <button
                      type="button"
                      onClick={handleRemoveIconImage}
                      className="p-1 text-red-600 hover:text-red-800"
                    >
                      <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                )}
              </div>
            </div>
            
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
                    <label htmlFor="price" className="block mb-1">価格 (¥)</label>
                    <Input
                      type="number"
                      name="price"
                      value={formData.price}
                      onChange={handleFormChange}
                      placeholder="请输入価格"
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
            
            <Form.Item 
              label="精选设置" 
              className="mb-3"
            >
              <div className="mb-2">
                <input
                  type="checkbox"
                  name="isFeatured"
                  checked={formData.isFeatured}
                  onChange={handleFormChange}
                  id="createIsFeatured"
                  className="mr-2"
                />
                <label htmlFor="createIsFeatured">设为精选题库</label>
              </div>
              
              {formData.isFeatured && (
                <div className="ml-5">
                  <label htmlFor="createFeaturedCategory" className="block mb-1">精选分类</label>
                  <Input
                    name="featuredCategory"
                    value={formData.featuredCategory}
                    onChange={handleFormChange}
                    placeholder="请输入精选分类（可选）"
                    id="createFeaturedCategory"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    精选分类用于前台分组展示，如果留空则使用题库原分类
                  </p>
                </div>
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
                onClick={handleCreateQuestionSet}
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
            
            {/* 添加自定义图片上传区域 */}
            <div className="mb-4">
              <label className="block mb-2 text-sm font-medium text-gray-700">
                自定义图标图片 <span className="text-xs text-gray-500">(可选，会替代emoji图标)</span>
              </label>
              
              <div className="flex items-center space-x-4">
                <div className="flex-grow">
                  <label className="flex justify-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 cursor-pointer">
                    <span>{iconImageFile ? '更换图片' : (iconImagePreview ? '更换图片' : '选择图片')}</span>
                    <input
                      type="file"
                      className="sr-only"
                      accept="image/*"
                      ref={iconImageInputRef}
                      onChange={handleIconImageSelect}
                    />
                  </label>
                </div>
                
                {iconImagePreview && (
                  <div className="flex items-center space-x-2">
                    <div className="w-16 h-16 border rounded-md overflow-hidden">
                      <img 
                        src={iconImagePreview} 
                        alt="图标预览" 
                        className="w-full h-full object-cover" 
                      />
                    </div>
                    <button
                      type="button"
                      onClick={handleRemoveIconImage}
                      className="p-1 text-red-600 hover:text-red-800"
                    >
                      <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                )}
              </div>
            </div>
            
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
                    <label htmlFor="editPrice" className="block mb-1">価格 (¥)</label>
                    <Input
                      type="number"
                      name="price"
                      value={formData.price}
                      onChange={handleFormChange}
                      placeholder="请输入価格"
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

            <Form.Item 
              label="精选设置" 
              className="mb-3"
            >
              <div className="mb-2">
                <input
                  type="checkbox"
                  name="isFeatured"
                  checked={formData.isFeatured}
                  onChange={handleFormChange}
                  id="editIsFeatured"
                  className="mr-2"
                />
                <label htmlFor="editIsFeatured">设为精选题库</label>
              </div>
              
              {formData.isFeatured && (
                <div className="ml-5">
                  <label htmlFor="editFeaturedCategory" className="block mb-1">精选分类</label>
                  <Input
                    name="featuredCategory"
                    value={formData.featuredCategory}
                    onChange={handleFormChange}
                    placeholder="请输入精选分类（可选）"
                    id="editFeaturedCategory"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    精选分类用于前台分组展示，如果留空则使用题库原分类
                  </p>
                </div>
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
