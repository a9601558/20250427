import React, { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import { questionSetService } from '../../services/api';
import { QuestionSet } from '../../types';

// Interface for upload result
interface UploadResult {
  success: number;
  failed: number;
  errors?: string[];
}

// Interface for question set creation data
interface NewQuestionSetData {
  title: string;
  description: string;
  category: string;
  isPaid: boolean;
  price: number;
  trialQuestions: number;
}

const AdminBatchUpload: React.FC = () => {
  // Upload mode: 'add' for adding questions to existing set, 'create' for creating new set
  const [uploadMode, setUploadMode] = useState<'add' | 'create'>('add');
  
  // Existing question set selection
  const [selectedQuestionSet, setSelectedQuestionSet] = useState<string>('');
  const [questionSets, setQuestionSets] = useState<QuestionSet[]>([]);
  
  // New question set data
  const [newQuestionSetData, setNewQuestionSetData] = useState<NewQuestionSetData>({
    title: '',
    description: '',
    category: '',
    isPaid: false,
    price: 0,
    trialQuestions: 0
  });
  
  // File and processing states
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [file, setFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string>('');
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null);

  // 获取所有题库
  useEffect(() => {
    const fetchQuestionSets = async () => {
      setIsLoading(true);
      try {
        const response = await questionSetService.getAllQuestionSets();
        if (response.success && response.data) {
          setQuestionSets(response.data);
        } else {
          toast.error('問題集リスト取得失敗');
        }
      } catch (error) {
        console.error('問題集リスト取得エラー:', error);
        toast.error('問題集リスト取得エラー');
      } finally {
        setIsLoading(false);
      }
    };

    fetchQuestionSets();
  }, []);

  // 处理文件选择
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) {
      setFile(null);
      setFilePreview('');
      return;
    }
      
      // 检查文件类型
    const fileType = selectedFile.name.split('.').pop()?.toLowerCase();
    if (fileType !== 'csv' && fileType !== 'txt') {
      toast.error('CSVまたはTXTファイル形式のみサポート');
      e.target.value = '';
        return;
      }
      
      setFile(selectedFile);
      
    // 创建文件预览
      const reader = new FileReader();
      reader.onload = (event) => {
      const content = event.target?.result as string;
      // 只显示前10行作为预览
      const lines = content.split('\n').slice(0, 10).join('\n');
      setFilePreview(lines);
    };
    reader.readAsText(selectedFile);
  };

  // 处理新题库数据变更
  const handleNewQuestionSetChange = (field: keyof NewQuestionSetData, value: string | boolean | number) => {
    setNewQuestionSetData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  // 提交文件处理
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (uploadMode === 'add' && !selectedQuestionSet) {
      toast.error('ターゲット問題集を選択してください');
      return;
    }
    
    if (uploadMode === 'create') {
      // 新しい問題集データの検証
      if (!newQuestionSetData.title) {
        toast.error('問題集タイトルを入力してください');
        return;
      }
      
      if (!newQuestionSetData.description) {
        toast.error('問題集説明を入力してください');
        return;
      }
      
      if (!newQuestionSetData.category) {
        toast.error('問題集カテゴリを入力してください');
        return;
      }
    }
    
    if (!file) {
      toast.error('アップロードするファイルを選択してください');
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);
    setUploadResult(null);

    try {
      // 创建 FormData 对象
      const formData = new FormData();
      formData.append('file', file);
      
      if (uploadMode === 'add') {
        // 添加题目到现有题库
        formData.append('questionSetId', selectedQuestionSet);
        
        console.log('[Upload] FormData questionSetId:', selectedQuestionSet);
        console.log('[Upload] FormData file name:', file.name);
        console.log('[Upload] FormData file size:', file.size);
        
        // Force a slight delay to ensure the form is properly built
        await new Promise(resolve => setTimeout(resolve, 100));

        // 使用正确的API端点进行批量上传
        const token = localStorage.getItem('token');
        const xhr = new XMLHttpRequest();
        
        // 创建Promise来处理上传
        const response = await new Promise((resolve, reject) => {
          xhr.upload.addEventListener('progress', (e) => {
            if (e.lengthComputable) {
              const progress = Math.round((e.loaded / e.total) * 100);
              setUploadProgress(progress);
            }
          });
          
          xhr.addEventListener('load', () => {
            if (xhr.status >= 200 && xhr.status < 300) {
              try {
                const result = JSON.parse(xhr.responseText);
                resolve(result);
              } catch (e) {
                reject(new Error('無効なレスポンス形式'));
              }
            } else {
              reject(new Error(`アップロードエラー: ${xhr.status}`));
            }
          });
          
          xhr.addEventListener('error', () => {
            reject(new Error('ネットワークエラー'));
          });
          
          xhr.open('POST', `/api/questions/batch-upload/${selectedQuestionSet}`);
          xhr.setRequestHeader('Authorization', `Bearer ${token}`);
          xhr.send(formData);
        });

        const typedResponse = response as any;
        if (typedResponse.success) {
          toast.success('問題一括追加成功！');
          setUploadResult({
            success: typedResponse.data?.success || 0,
            failed: typedResponse.data?.failed || 0,
            errors: typedResponse.data?.errors
          });
        } else {
          toast.error(`一括追加失敗: ${typedResponse.message || typedResponse.error}`);
        }
      } else {
        // 创建新题库模式
        // 添加新题库数据到FormData
        Object.entries(newQuestionSetData).forEach(([key, value]) => {
          formData.append(key, String(value));
        });
        
        console.log('[Upload] 创建新题库:', newQuestionSetData.title);
        console.log('[Upload] FormData file name:', file.name);
        
        // 首先创建题库，然后上传题目
        const { questionSetService } = await import('../../services/api');
        
        // 创建新题库
        const createResponse = await questionSetService.createQuestionSet(newQuestionSetData);
        
        if (!createResponse.success || !createResponse.data) {
          throw new Error(createResponse.message || '題庫作成失敗');
        }
        
        const newQuestionSetId = createResponse.data.id;
        
        // 然后批量上传题目到新创建的题库
        const token = localStorage.getItem('token');
        const xhr = new XMLHttpRequest();
        
        const response = await new Promise((resolve, reject) => {
          xhr.upload.addEventListener('progress', (e) => {
            if (e.lengthComputable) {
              const progress = Math.round((e.loaded / e.total) * 100);
              setUploadProgress(progress);
            }
          });
          
          xhr.addEventListener('load', () => {
            if (xhr.status >= 200 && xhr.status < 300) {
              try {
                const result = JSON.parse(xhr.responseText);
                resolve(result);
              } catch (e) {
                reject(new Error('無効なレスポンス形式'));
              }
            } else {
              reject(new Error(`アップロードエラー: ${xhr.status}`));
            }
          });
          
          xhr.addEventListener('error', () => {
            reject(new Error('ネットワークエラー'));
          });
          
          // 创建新的FormData只包含文件
          const uploadFormData = new FormData();
          uploadFormData.append('file', file);
          
          xhr.open('POST', `/api/questions/batch-upload/${newQuestionSetId}`);
          xhr.setRequestHeader('Authorization', `Bearer ${token}`);
          xhr.send(uploadFormData);
        });
        
        const typedUploadResponse = response as any;
        if (typedUploadResponse.success) {
          toast.success('問題集作成成功！');
          setUploadResult({
            success: typedUploadResponse.data?.success || 0,
            failed: typedUploadResponse.data?.failed || 0,
            errors: typedUploadResponse.data?.errors
          });
          
          // 問題集リストを更新
          const refreshResponse = await questionSetService.getAllQuestionSets();
          if (refreshResponse.success && refreshResponse.data) {
            setQuestionSets(refreshResponse.data);
          }
        } else {
          toast.error(`問題集作成失敗: ${(response as any)?.message || (response as any)?.error || '未知エラー'}`);
        }
      }
      
      // 重置表单
      resetForm(e);
    } catch (error) {
      console.error('一括操作エラー:', error);
      toast.error('一括操作エラー、もう一度お試しください');
    } finally {
      setIsUploading(false);
    }
  };

  // 重置表单
  const resetForm = (e: React.FormEvent) => {
    setFile(null);
    setFilePreview('');
    
    if (uploadMode === 'create') {
      setNewQuestionSetData({
      title: '',
      description: '',
      category: '',
      isPaid: false,
      price: 0,
      trialQuestions: 0
    });
    }
    
    if (e.target instanceof HTMLFormElement) {
      e.target.reset();
    }
  };

  // 切换上传模式
  const toggleUploadMode = (mode: 'add' | 'create') => {
    setUploadMode(mode);
    setUploadResult(null);
    setFile(null);
    setFilePreview('');
  };

    return (
      <div className="p-6">
      <h2 className="text-2xl font-bold text-gray-800 mb-6 flex items-center">
        <svg className="w-6 h-6 mr-2 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
        </svg>
        一括問題管理
      </h2>

      {/* モード選択 */}
        <div className="mb-6">
        <div className="flex space-x-4 border-b border-gray-200">
          <button
            type="button"
            className={`py-2 px-4 focus:outline-none ${
              uploadMode === 'add' 
                ? 'border-b-2 border-blue-500 text-blue-600 font-medium' 
                : 'text-gray-500 hover:text-gray-700'
            }`}
            onClick={() => toggleUploadMode('add')}
          >
            既存問題集に一括追加
          </button>
          <button
            type="button"
            className={`py-2 px-4 focus:outline-none ${
              uploadMode === 'create' 
                ? 'border-b-2 border-blue-500 text-blue-600 font-medium' 
                : 'text-gray-500 hover:text-gray-700'
            }`}
            onClick={() => toggleUploadMode('create')}
          >
            新しい問題集作成と一括インポート
          </button>
        </div>
        </div>
        
      <div className="bg-blue-50 border-l-4 border-blue-500 text-blue-700 p-4 mb-6 rounded">
        <div className="flex">
          <div className="flex-shrink-0">
            <svg className="h-5 w-5 text-blue-500" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="ml-3">
            <p className="text-sm font-medium">ファイル形式説明</p>
            <div className="mt-2 text-sm">
              <p>TXTまたはCSV形式のファイルに対応、一行に一つの問題、形式は以下の通り：</p>
              <pre className="mt-1 font-mono text-xs bg-blue-100 p-2 rounded overflow-x-auto mb-2">
                问题?|选项A|选项B|选项C|选项D|正确答案|解析
              </pre>
              <ul className="list-disc list-inside text-xs mt-2">
                <li>各フィールドは縦線 | で区切ります</li>
                <li><strong>単選問題</strong>：正解は単一の選択肢文字を入力、例：A、B、CまたはD</li>
                <li><strong>複選問題</strong>：正解は英語カンマで複数の選択肢文字を区切り、例：A,BまたはA,C,D</li>
                <li>注意：単選問題の答えにカンマを付けないでください。複選問題と認識されます</li>
                <li>最低2つの選択肢が必要です（問題の後に最低2列）</li>
                <li>解説はオプションで、空白でも構いません</li>
              </ul>
              
              <div className="mt-3 p-2 rounded bg-blue-100">
                <p className="font-medium text-blue-800 mb-1">支持的格式变体：</p>
                <ul className="list-disc list-inside text-xs">
                  <li>4个选项 + 答案 + 解析：<code>问题|选项A|选项B|选项C|选项D|A|解析</code></li>
                  <li>4个选项 + 答案（无解析）：<code>问题|选项A|选项B|选项C|选项D|A</code></li>
                  <li>3个选项 + 答案：<code>问题|选项A|选项B|选项C|B</code></li>
                  <li>2个选项 + 答案：<code>问题|选项A|选项B|A</code></li>
                </ul>
            </div>
            
              <p className="mt-3 text-xs bg-yellow-100 p-3 rounded">
                <strong>例：</strong><br />
                <span className="block mb-1 border-l-2 border-green-500 pl-2">
                  <strong className="text-green-700">単選問題：</strong> 
                  水の化学式は以下のどれですか?|H2O|CO2|NaCl|CH4|<strong>A</strong>|水の化学式はH2Oです
                </span>
                <span className="block border-l-2 border-purple-500 pl-2">
                  <strong className="text-purple-700">複選問題：</strong> 
                  以下の中でプログラミング言語はどれですか?|Java|バスケットボール|Python|サッカー|<strong>A,C</strong>|JavaとPythonはプログラミング言語です
                </span>
              </p>
              
              <div className="bg-red-50 p-2 mt-3 rounded border-l-2 border-red-500">
                <p className="text-red-700 font-medium">よくあるエラー：</p>
                <ul className="list-disc list-inside text-xs text-red-600">
                  <li>答えフィールドにスペースが含まれる：正しい書き方 <code>A,B</code>、間違い <code>A, B</code></li>
                  <li>中国語のカンマを使用：正しい書き方 <code>A,B</code>、間違い <code>A，B</code></li>
                  <li>答えの文字の大文字小文字不一致：大文字 <code>A</code> を使用、<code>a</code> は使用しない</li>
                </ul>
              </div>
            </div>
            </div>
          </div>
        </div>
        
      <form onSubmit={handleSubmit} className="space-y-6 bg-white p-6 rounded-lg shadow-sm border border-gray-200">
        {/* 模式特定表单部分 */}
        {uploadMode === 'add' ? (
          // 添加题目到现有题库的表单
          <div>
            <label htmlFor="questionSet" className="block text-sm font-medium text-gray-700 mb-1">
              ターゲット問題集を選択
            </label>
            <select
              id="questionSet"
              className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
              value={selectedQuestionSet}
              onChange={(e) => setSelectedQuestionSet(e.target.value)}
              disabled={isLoading || isUploading}
              required
            >
              <option value="">-- 問題集を選択してください --</option>
              {questionSets.map((set) => (
                <option key={set.id} value={set.id}>
                  {set.title} {set.questionCount ? `(${set.questionCount}题)` : ''}
                </option>
              ))}
            </select>
            {isLoading && (
              <p className="mt-1 text-sm text-gray-500">問題集を読み込み中...</p>
            )}
          </div>
        ) : (
          // 创建新题库的表单
          <div className="space-y-4">
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            <div>
                <label htmlFor="title" className="block text-sm font-medium text-gray-700">
                  問題集タイトル <span className="text-red-500">*</span>
                </label>
              <input
                type="text"
                id="title"
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  value={newQuestionSetData.title}
                  onChange={(e) => handleNewQuestionSetChange('title', e.target.value)}
                  disabled={isUploading}
                required
              />
            </div>
            
            <div>
                <label htmlFor="category" className="block text-sm font-medium text-gray-700">
                  カテゴリ <span className="text-red-500">*</span>
                </label>
              <input
                type="text"
                id="category"
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  value={newQuestionSetData.category}
                  onChange={(e) => handleNewQuestionSetChange('category', e.target.value)}
                  disabled={isUploading}
                required
              />
              </div>
            </div>
            
            <div>
              <label htmlFor="description" className="block text-sm font-medium text-gray-700">
                問題集説明 <span className="text-red-500">*</span>
              </label>
              <textarea
                id="description"
                rows={3}
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                value={newQuestionSetData.description}
                onChange={(e) => handleNewQuestionSetChange('description', e.target.value)}
                disabled={isUploading}
                required
              />
            </div>
            
            <div className="flex items-center">
              <input
                id="isPaid"
                type="checkbox"
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                checked={newQuestionSetData.isPaid}
                onChange={(e) => handleNewQuestionSetChange('isPaid', e.target.checked)}
                disabled={isUploading}
              />
              <label htmlFor="isPaid" className="ml-2 block text-sm text-gray-700">
                有料問題集
              </label>
            </div>
            
            {newQuestionSetData.isPaid && (
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                <div>
                  <label htmlFor="price" className="block text-sm font-medium text-gray-700">
                    価格 (¥)
                  </label>
                  <input
                    type="number"
                    id="price"
                    min="0"
                    step="0.01"
                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    value={newQuestionSetData.price}
                    onChange={(e) => handleNewQuestionSetChange('price', parseFloat(e.target.value))}
                    disabled={isUploading}
                  />
                </div>
                
                <div>
                  <label htmlFor="trialQuestions" className="block text-sm font-medium text-gray-700">
                    お試し問題数
                  </label>
                  <input
                    type="number"
                    id="trialQuestions"
                    min="0"
                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    value={newQuestionSetData.trialQuestions}
                    onChange={(e) => handleNewQuestionSetChange('trialQuestions', parseInt(e.target.value))}
                    disabled={isUploading}
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {/* 文件上传 - 两种模式下都需要 */}
        <div>
          <label htmlFor="file" className="block text-sm font-medium text-gray-700 mb-1">
            ファイル選択 (CSV または TXT)
          </label>
          <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 border-dashed rounded-md">
            <div className="space-y-1 text-center">
              <svg className="mx-auto h-12 w-12 text-gray-400" stroke="currentColor" fill="none" viewBox="0 0 48 48">
                <path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <div className="flex text-sm text-gray-600">
                <label htmlFor="file-upload" className="relative cursor-pointer bg-white rounded-md font-medium text-blue-600 hover:text-blue-500">
                  <span>ファイルをアップロード</span>
                  <input 
                    id="file-upload" 
                    name="file-upload" 
                    type="file" 
                    className="sr-only"
                    accept=".csv,.txt"
                    onChange={handleFileChange}
                    disabled={isUploading}
                  />
                </label>
                <p className="pl-1">またはファイルをここにドラッグ＆ドロップ</p>
              </div>
              <p className="text-xs text-gray-500">
                CSV、TXTファイルに対応、最大3110MB
              </p>
            </div>
          </div>
        </div>
        
        {/* 文件预览 */}
        {filePreview && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              ファイルプレビュー (最初の10行)
            </label>
            <div className="mt-1 bg-gray-50 p-3 rounded-md border border-gray-200 max-h-60 overflow-auto">
              <pre className="text-xs font-mono whitespace-pre-wrap">{filePreview}</pre>
            </div>
            <p className="mt-1 text-xs text-gray-500">
              ファイル名: {file?.name} | サイズ: {file ? (file.size / 1024).toFixed(2) : 0} KB
            </p>
          </div>
        )}

        {/* アップロード進行状況 */}
        {isUploading && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              アップロード進行状況
            </label>
            <div className="w-full bg-gray-200 rounded-full h-2.5">
              <div 
                className="bg-blue-600 h-2.5 rounded-full transition-all duration-300"
                style={{ width: `${uploadProgress}%` }}
              ></div>
            </div>
            <p className="text-xs mt-1 text-gray-500 text-right">{uploadProgress}%</p>
                </div>
        )}

        {/* 上传结果 */}
        {uploadResult && (
          <div className="bg-green-50 border-l-4 border-green-500 text-green-700 p-4 rounded">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-green-500" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                      </div>
              <div className="ml-3">
                <p className="text-sm font-medium">アップロード完了</p>
                <div className="mt-2 text-sm">
                  <p>成功追加: <span className="font-bold">{uploadResult.success}</span> 問の問題</p>
                  {uploadResult.failed > 0 && (
                    <p>失敗: <span className="font-bold">{uploadResult.failed}</span> 問の問題</p>
                  )}
                </div>
              </div>
          </div>
          </div>
        )}
        
        {/* 提交按钮 */}
        <div className="flex justify-end">
          <button
            type="submit"
            className={`
              inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white 
              ${isUploading ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500'} 
            `}
            disabled={isUploading || !file || (uploadMode === 'add' && !selectedQuestionSet)}
          >
            {isUploading ? (
              <>
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                処理中...
              </>
            ) : (
              <>
                <svg className="-ml-1 mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
                {uploadMode === 'add' ? '問題アップロード開始' : '問題集作成と問題アップロード'}
              </>
            )}
          </button>
        </div>
      </form>

      {/* 下载模板 */}
      <div className="mt-6 text-right">
            <button
          type="button"
          className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          onClick={() => {
            const templateContent = "水の化学式は以下のどれですか?|H2O|CO2|NaCl|CH4|A|水の化学式はH2Oです\n以下の中でプログラミング言語はどれですか?|Java|バスケットボール|Python|サッカー|A,C|JavaとPythonはプログラミング言語です\n1+1はいくつですか?|1|2|3|4|B|1+1=2";
            const blob = new Blob([templateContent], { type: 'text/plain' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = '一括問題追加テンプレート.txt';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
          }}
        >
          <svg className="-ml-0.5 mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
          テンプレートダウンロード
            </button>
      </div>
    </div>
  );
};

export default AdminBatchUpload; 