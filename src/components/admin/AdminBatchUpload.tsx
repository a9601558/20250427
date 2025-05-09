import React, { useState, useRef } from 'react';
import { collection, addDoc, writeBatch, doc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../../config/firebase'; // 导入已初始化的Firebase服务

interface QuestionData {
  id?: string;
  text: string;
  options: {
    id: string;
    text: string;
    isCorrect: boolean;
  }[];
  explanation?: string;
  category?: string;
  difficulty?: 'easy' | 'medium' | 'hard';
  tags?: string[];
}

interface QuestionSet {
  id?: string;
  title: string;
  description: string;
  category: string;
  questionCount: number;
  isPaid: boolean;
  price: number;
  trialQuestions: number;
  questions: QuestionData[];
}

const AdminBatchUpload: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [fileType, setFileType] = useState<'csv' | 'txt' | null>(null);
  const [uploadStep, setUploadStep] = useState<'select' | 'preview' | 'uploading' | 'complete'>('select');
  const [parsedData, setParsedData] = useState<QuestionSet | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [previewData, setPreviewData] = useState<{questions: QuestionData[], total: number}>({
    questions: [],
    total: 0
  });
  const [questionSetInfo, setQuestionSetInfo] = useState({
    title: '',
    description: '',
    category: '',
    isPaid: false,
    price: 0,
    trialQuestions: 0
  });
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setError(null);
    
    if (e.target.files && e.target.files.length > 0) {
      const selectedFile = e.target.files[0];
      
      // 检查文件类型
      if (selectedFile.name.endsWith('.csv')) {
        setFileType('csv');
      } else if (selectedFile.name.endsWith('.txt')) {
        setFileType('txt');
      } else {
        setError('只支持CSV或TXT格式的文件');
        return;
      }
      
      setFile(selectedFile);
      
      try {
        // 读取文件内容
        const content = await readFileContent(selectedFile);
        
        // 根据文件类型解析数据
        let questions: QuestionData[] = [];
        
        if (fileType === 'csv') {
          questions = parseCSV(content);
        } else {
          questions = parseTXT(content);
        }
        
        // 设置预览数据
        setPreviewData({
          questions: questions.slice(0, 5), // 只显示前5个问题预览
          total: questions.length
        });
        
        // 创建题库数据对象
        setParsedData({
          title: '',
          description: '',
          category: '',
          questionCount: questions.length,
          isPaid: false,
          price: 0,
          trialQuestions: 0,
          questions: questions
        });
        
        // 切换到预览步骤
        setUploadStep('preview');
      } catch (err) {
        console.error('解析文件出错:', err);
        setError('解析文件失败: ' + (err instanceof Error ? err.message : String(err)));
      }
    }
  };
  
  const readFileContent = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = (event) => {
        if (event.target && typeof event.target.result === 'string') {
          resolve(event.target.result);
        } else {
          reject(new Error('读取文件失败'));
        }
      };
      
      reader.onerror = () => {
        reject(new Error('读取文件时出错'));
      };
      
      reader.readAsText(file);
    });
  };
  
  const parseCSV = (content: string): QuestionData[] => {
    const lines = content.split('\n');
    const questions: QuestionData[] = [];
    let currentQuestion: QuestionData | null = null;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      if (!line) continue; // 跳过空行
      
      const parts = line.split(',');
      
      if (parts.length >= 2) {
        const type = parts[0].trim();
        
        if (type === 'Q') {
          // 如果已经有一个问题在处理中，先保存它
          if (currentQuestion) {
            questions.push(currentQuestion);
          }
          
          // 开始一个新问题
          currentQuestion = {
            text: parts[1].trim(),
            options: [],
            explanation: parts[2]?.trim() || '',
            category: parts[3]?.trim() || '',
            tags: parts[4]?.trim().split('|') || []
          };
        } else if (type === 'O' && currentQuestion) {
          // 添加选项
          const isCorrect = parts[2]?.trim().toLowerCase() === 'true';
          currentQuestion.options.push({
            id: `option_${currentQuestion.options.length}`,
            text: parts[1].trim(),
            isCorrect: isCorrect
          });
        }
      }
    }
    
    // 添加最后一个问题
    if (currentQuestion) {
      questions.push(currentQuestion);
    }
    
    return questions;
  };
  
  const parseTXT = (content: string): QuestionData[] => {
    const lines = content.split('\n');
    const questions: QuestionData[] = [];
    let currentQuestion: QuestionData | null = null;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      if (!line) continue; // 跳过空行
      
      if (line.startsWith('Q:')) {
        // 如果已经有一个问题在处理中，先保存它
        if (currentQuestion) {
          questions.push(currentQuestion);
        }
        
        // 开始一个新问题
        currentQuestion = {
          text: line.substring(2).trim(),
          options: [],
          explanation: '',
          category: '',
          tags: []
        };
      } else if (line.startsWith('E:') && currentQuestion) {
        // 设置解释
        currentQuestion.explanation = line.substring(2).trim();
      } else if (line.startsWith('C:') && currentQuestion) {
        // 设置分类
        currentQuestion.category = line.substring(2).trim();
      } else if (line.startsWith('T:') && currentQuestion) {
        // 设置标签
        currentQuestion.tags = line.substring(2).trim().split(',');
      } else if (/^[A-D]:\s/.test(line) && currentQuestion) {
        // 添加选项 (A: B: C: D:)
        const optionLetter = line[0];
        const optionText = line.substring(2).trim();
        currentQuestion.options.push({
          id: `option_${currentQuestion.options.length}`,
          text: optionText,
          isCorrect: false // 默认为false，稍后设置
        });
      } else if (line.startsWith('Answer:') && currentQuestion) {
        // 设置正确选项
        const correctOptions = line.substring(7).trim().split(',');
        
        // 将选中的选项设置为正确
        for (const option of correctOptions) {
          const index = option.charCodeAt(0) - 'A'.charCodeAt(0);
          if (index >= 0 && index < currentQuestion.options.length) {
            currentQuestion.options[index].isCorrect = true;
          }
        }
      }
    }
    
    // 添加最后一个问题
    if (currentQuestion) {
      questions.push(currentQuestion);
    }
    
    return questions;
  };
  
  const handleUpload = async () => {
    if (!parsedData) return;
    
    try {
      setUploadStep('uploading');
      setError(null);
      
      // 创建题库数据
      const questionSet: QuestionSet = {
        ...parsedData,
        title: questionSetInfo.title,
        description: questionSetInfo.description,
        category: questionSetInfo.category,
        isPaid: questionSetInfo.isPaid,
        price: questionSetInfo.price,
        trialQuestions: questionSetInfo.trialQuestions
      };
      
      // 使用导入的db实例，而不是重新调用getFirestore()
      const batch = writeBatch(db);
      
      // 创建题库文档
      const questionSetsRef = collection(db, 'questionSets');
      const newQuestionSetRef = doc(questionSetsRef);
      
      // 准备题库数据（不包括问题）
      const questionSetData = {
        title: questionSet.title,
        description: questionSet.description,
        category: questionSet.category,
        questionCount: questionSet.questions.length,
        isPaid: questionSet.isPaid,
        price: questionSet.price,
        trialQuestions: questionSet.trialQuestions,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      // 将题库添加到批处理中
      batch.set(newQuestionSetRef, questionSetData);
      
      // 创建问题集合
      const questionsRef = collection(newQuestionSetRef, 'questions');
      
      // 逐个添加问题
      for (let i = 0; i < questionSet.questions.length; i++) {
        const question = questionSet.questions[i];
        const questionRef = doc(questionsRef);
        
        batch.set(questionRef, {
          ...question,
          createdAt: new Date(),
          updatedAt: new Date()
        });
        
        // 更新进度
        setUploadProgress(Math.round((i + 1) / questionSet.questions.length * 100));
      }
      
      // 提交批处理
      await batch.commit();
      
      // 设置为完成状态
      setUploadStep('complete');
    } catch (err) {
      console.error('上传失败:', err);
      setError('上传失败: ' + (err instanceof Error ? err.message : String(err)));
      setUploadStep('preview');
    }
  };
  
  const resetUpload = () => {
    setFile(null);
    setFileType(null);
    setUploadStep('select');
    setParsedData(null);
    setPreviewData({ questions: [], total: 0 });
    setQuestionSetInfo({
      title: '',
      description: '',
      category: '',
      isPaid: false,
      price: 0,
      trialQuestions: 0
    });
    setError(null);
    setUploadProgress(0);
    
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };
  
  const renderFileUpload = () => {
    return (
      <div className="p-6">
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">批量上传题库</h2>
          <p className="text-gray-600">支持CSV和TXT格式的文件批量导入题库。</p>
        </div>
        
        <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm mb-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">文件格式说明</h3>
          
          <div className="space-y-4">
            <div>
              <h4 className="font-medium text-gray-800 mb-2">CSV格式</h4>
              <pre className="bg-gray-50 p-3 rounded text-xs overflow-auto">
                {`Q,问题文本,解释文本,分类,标签1|标签2
O,选项A,true
O,选项B,false
O,选项C,false
O,选项D,false
Q,下一个问题...`}
              </pre>
            </div>
            
            <div>
              <h4 className="font-medium text-gray-800 mb-2">TXT格式</h4>
              <pre className="bg-gray-50 p-3 rounded text-xs overflow-auto">
                {`Q: 问题文本
A: 选项A
B: 选项B
C: 选项C
D: 选项D
Answer: A,C
E: 解释文本
C: 分类
T: 标签1,标签2

Q: 下一个问题...`}
              </pre>
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
          <div className="flex items-center justify-center w-full">
            <label className="flex flex-col items-center justify-center w-full h-64 border-2 border-gray-300 border-dashed rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100">
              <div className="flex flex-col items-center justify-center pt-5 pb-6">
                <svg className="w-12 h-12 mb-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
                <p className="mb-2 text-sm text-gray-600"><span className="font-semibold">点击上传</span> 或拖放文件</p>
                <p className="text-xs text-gray-500">支持 CSV, TXT (最大 10MB)</p>
              </div>
              <input 
                ref={fileInputRef}
                type="file" 
                className="hidden" 
                accept=".csv,.txt"
                onChange={handleFileChange}
              />
            </label>
          </div>
        </div>
        
        {error && (
          <div className="mt-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded relative">
            {error}
          </div>
        )}
      </div>
    );
  };
  
  const renderPreview = () => {
    if (!previewData || !parsedData) return null;
    
    return (
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-gray-900">预览题库</h2>
          <button
            onClick={resetUpload}
            className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            返回选择文件
          </button>
        </div>
        
        <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm mb-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">题库信息</h3>
          
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            <div>
              <label htmlFor="title" className="block text-sm font-medium text-gray-700">题库标题 <span className="text-red-500">*</span></label>
              <input
                type="text"
                id="title"
                value={questionSetInfo.title}
                onChange={(e) => setQuestionSetInfo({...questionSetInfo, title: e.target.value})}
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                required
              />
            </div>
            
            <div>
              <label htmlFor="category" className="block text-sm font-medium text-gray-700">分类 <span className="text-red-500">*</span></label>
              <input
                type="text"
                id="category"
                value={questionSetInfo.category}
                onChange={(e) => setQuestionSetInfo({...questionSetInfo, category: e.target.value})}
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                required
              />
            </div>
            
            <div className="sm:col-span-2">
              <label htmlFor="description" className="block text-sm font-medium text-gray-700">题库描述 <span className="text-red-500">*</span></label>
              <textarea
                id="description"
                rows={3}
                value={questionSetInfo.description}
                onChange={(e) => setQuestionSetInfo({...questionSetInfo, description: e.target.value})}
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                required
              />
            </div>
            
            <div className="flex items-center">
              <input
                id="isPaid"
                type="checkbox"
                checked={questionSetInfo.isPaid}
                onChange={(e) => setQuestionSetInfo({...questionSetInfo, isPaid: e.target.checked})}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <label htmlFor="isPaid" className="ml-2 block text-sm text-gray-700">
                付费题库
              </label>
            </div>
            
            {questionSetInfo.isPaid && (
              <>
                <div>
                  <label htmlFor="price" className="block text-sm font-medium text-gray-700">价格 (￥)</label>
                  <input
                    type="number"
                    id="price"
                    min="0"
                    step="0.01"
                    value={questionSetInfo.price}
                    onChange={(e) => setQuestionSetInfo({...questionSetInfo, price: parseFloat(e.target.value)})}
                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  />
                </div>
                
                <div>
                  <label htmlFor="trialQuestions" className="block text-sm font-medium text-gray-700">试用题目数量</label>
                  <input
                    type="number"
                    id="trialQuestions"
                    min="0"
                    value={questionSetInfo.trialQuestions}
                    onChange={(e) => setQuestionSetInfo({...questionSetInfo, trialQuestions: parseInt(e.target.value)})}
                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  />
                </div>
              </>
            )}
          </div>
        </div>
        
        <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm mb-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-medium text-gray-900">问题预览</h3>
            <span className="text-sm text-gray-500">总计 {previewData.total} 个问题</span>
          </div>
          
          <div className="space-y-6">
            {previewData.questions.map((question, index) => (
              <div key={index} className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                <div className="flex items-start mb-3">
                  <span className="flex-shrink-0 bg-blue-100 text-blue-800 text-xs font-medium mr-2 px-2.5 py-0.5 rounded">{index + 1}</span>
                  <p className="text-gray-900">{question.text}</p>
                </div>
                
                <div className="space-y-2 ml-6 mb-3">
                  {question.options.map((option, optIndex) => (
                    <div key={optIndex} className={`flex items-center ${option.isCorrect ? 'text-green-700' : 'text-gray-700'}`}>
                      <div className={`flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center mr-2 text-xs font-medium ${option.isCorrect ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                        {String.fromCharCode(65 + optIndex)}
                      </div>
                      <p className={option.isCorrect ? 'font-medium' : ''}>{option.text}</p>
                    </div>
                  ))}
                </div>
                
                {question.explanation && (
                  <div className="mt-2 text-sm text-gray-600">
                    <span className="font-medium">解释：</span> {question.explanation}
                  </div>
                )}
              </div>
            ))}
          </div>
          
          <div className="mt-4 text-center text-sm text-gray-500">
            显示前 5 个问题的预览，共 {previewData.total} 个问题
          </div>
        </div>
        
        <div className="flex justify-end space-x-4">
          <button
            onClick={resetUpload}
            className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            取消
          </button>
          <button
            onClick={handleUpload}
            disabled={!questionSetInfo.title || !questionSetInfo.description || !questionSetInfo.category}
            className={`inline-flex items-center px-5 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 ${!questionSetInfo.title || !questionSetInfo.description || !questionSetInfo.category ? 'opacity-50 cursor-not-allowed' : 'hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500'}`}
          >
            <svg className="mr-2 -ml-1 h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM6.293 6.707a1 1 0 010-1.414l3-3a1 1 0 011.414 0l3 3a1 1 0 01-1.414 1.414L11 5.414V13a1 1 0 11-2 0V5.414L7.707 6.707a1 1 0 01-1.414 0z" clipRule="evenodd" />
            </svg>
            上传并导入题库
          </button>
        </div>
        
        {error && (
          <div className="mt-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded relative">
            {error}
          </div>
        )}
      </div>
    );
  };
  
  const renderUploading = () => {
    return (
      <div className="p-6">
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">正在上传题库</h2>
          <p className="text-gray-600 mb-4">请稍候，正在将题库上传到数据库...</p>
          
          <div className="w-full max-w-md mx-auto bg-gray-200 rounded-full h-2.5 mb-4 dark:bg-gray-700">
            <div className="bg-blue-600 h-2.5 rounded-full" style={{ width: `${uploadProgress}%` }}></div>
          </div>
          <p className="text-sm text-gray-600">{uploadProgress}% 完成</p>
        </div>
      </div>
    );
  };
  
  const renderComplete = () => {
    return (
      <div className="p-6">
        <div className="text-center py-8">
          <div className="w-16 h-16 bg-green-100 text-green-500 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">题库上传成功！</h2>
          <p className="text-gray-600 mb-6">已成功导入 {previewData.total} 个问题到新题库</p>
          
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 max-w-md mx-auto mb-6 text-left">
            <p className="text-sm text-gray-700 mb-1"><span className="font-medium">题库名称：</span> {questionSetInfo.title}</p>
            <p className="text-sm text-gray-700 mb-1"><span className="font-medium">分类：</span> {questionSetInfo.category}</p>
            <p className="text-sm text-gray-700"><span className="font-medium">问题数量：</span> {previewData.total}</p>
          </div>
          
          <div className="space-x-4">
            <button
              onClick={resetUpload}
              className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              <svg className="mr-2 -ml-1 h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd" />
              </svg>
              上传新题库
            </button>
          </div>
        </div>
      </div>
    );
  };
  
  // 根据当前步骤渲染不同内容
  const renderContent = () => {
    switch (uploadStep) {
      case 'select':
        return renderFileUpload();
      case 'preview':
        return renderPreview();
      case 'uploading':
        return renderUploading();
      case 'complete':
        return renderComplete();
      default:
        return renderFileUpload();
    }
  };
  
  return (
    <div className="bg-gray-50">
      {renderContent()}
    </div>
  );
};

export default AdminBatchUpload; 