import React, { useState } from 'react';
import { toast } from 'react-toastify';

// Interface for JSON file metadata
interface JSONMetadata {
  version?: number;
  meta?: {
    subject?: string;
    source?: string;
    createdAt?: string;
    totalQuestions?: number;
    [key: string]: any;
  };
}

// Interface for question in JSON format
interface JSONQuestion {
  id: string;
  type: 'single' | 'multiple';
  stem: string;
  options: string[];
  answer: number[];
  analysis?: string | null;
  difficulty?: number;
  tags?: string[];
  chapter?: string | null;
}

// Interface for upload result
interface UploadResult {
  success: number;
  failed: number;
  errors?: string[];
  questionSetId?: string;
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

const AdminJSONUpload: React.FC = () => {
  // Form states
  const [newQuestionSetData, setNewQuestionSetData] = useState<NewQuestionSetData>({
    title: '',
    description: '',
    category: '',
    isPaid: false,
    price: 0,
    trialQuestions: 0
  });
  
  // File and processing states
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [file, setFile] = useState<File | null>(null);
  const [jsonPreview, setJsonPreview] = useState<any>(null);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null);

  // 处理文件选择
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) {
      setFile(null);
      setJsonPreview(null);
      return;
    }
      
    // 检查文件类型
    const fileType = selectedFile.name.split('.').pop()?.toLowerCase();
    if (fileType !== 'json') {
      toast.error('只支持JSON文件格式');
      e.target.value = '';
      return;
    }
      
    setFile(selectedFile);
      
    // 创建JSON预览
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      try {
        const jsonData = JSON.parse(content);
        setJsonPreview(jsonData);
        
        // 自动填充题库信息（如果JSON中包含元数据）
        if (jsonData.meta) {
          if (jsonData.meta.subject && !newQuestionSetData.title) {
            setNewQuestionSetData(prev => ({ ...prev, title: jsonData.meta.subject }));
          }
          if (jsonData.meta.source && !newQuestionSetData.description) {
            setNewQuestionSetData(prev => ({ ...prev, description: `来源: ${jsonData.meta.source}` }));
          }
          // 可以从subject中提取category
          if (jsonData.meta.subject && !newQuestionSetData.category) {
            const subject = jsonData.meta.subject;
            const categoryMatch = subject.match(/^([A-Z\-]+)/);
            if (categoryMatch) {
              setNewQuestionSetData(prev => ({ ...prev, category: categoryMatch[1] }));
            }
          }
        }
      } catch (error) {
        toast.error('JSON文件格式错误');
        console.error('JSON解析错误:', error);
        setJsonPreview(null);
      }
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
    
    // 验证题库数据
    if (!newQuestionSetData.title) {
      toast.error('请输入题库标题');
      return;
    }
    
    if (!newQuestionSetData.description) {
      toast.error('请输入题库说明');
      return;
    }
    
    if (!newQuestionSetData.category) {
      toast.error('请输入题库分类');
      return;
    }
    
    if (!file) {
      toast.error('请选择要上传的JSON文件');
      return;
    }

    if (!jsonPreview || !jsonPreview.questions || !Array.isArray(jsonPreview.questions)) {
      toast.error('JSON文件格式错误：缺少questions数组');
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);
    setUploadResult(null);

    try {
      // 创建 FormData 对象
      const formData = new FormData();
      formData.append('file', file);
      
      // 添加题库数据到FormData
      Object.entries(newQuestionSetData).forEach(([key, value]) => {
        formData.append(key, String(value));
      });
      
      console.log('[Upload] 创建新题库并上传JSON:', newQuestionSetData.title);
      console.log('[Upload] JSON文件名:', file.name);
      console.log('[Upload] 题目数量:', jsonPreview.questions.length);
      
      // 使用XMLHttpRequest来跟踪上传进度
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
              reject(new Error('无效的响应格式'));
            }
          } else {
            try {
              const errorResult = JSON.parse(xhr.responseText);
              reject(new Error(errorResult.message || `上传错误: ${xhr.status}`));
            } catch {
              reject(new Error(`上传错误: ${xhr.status}`));
            }
          }
        });
        
        xhr.addEventListener('error', () => {
          reject(new Error('网络错误'));
        });
        
        xhr.open('POST', '/api/questions/json-upload');
        xhr.setRequestHeader('Authorization', `Bearer ${token}`);
        xhr.send(formData);
      });
      
      const typedResponse = response as any;
      if (typedResponse.success) {
        toast.success(`题库创建成功！导入了 ${typedResponse.data?.success || 0} 道题目`);
        setUploadResult({
          success: typedResponse.data?.success || 0,
          failed: typedResponse.data?.failed || 0,
          errors: typedResponse.data?.errors,
          questionSetId: typedResponse.data?.questionSetId
        });
        
        // 重置表单
        setTimeout(() => {
          resetForm();
        }, 3000);
      } else {
        toast.error(`题库创建失败: ${typedResponse.message || '未知错误'}`);
      }
    } catch (error) {
      console.error('JSON上传错误:', error);
      toast.error(`上传失败: ${(error as Error).message}`);
    } finally {
      setIsUploading(false);
    }
  };

  // 重置表单
  const resetForm = () => {
    setFile(null);
    setJsonPreview(null);
    setUploadProgress(0);
    setNewQuestionSetData({
      title: '',
      description: '',
      category: '',
      isPaid: false,
      price: 0,
      trialQuestions: 0
    });
  };

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold text-gray-800 mb-6 flex items-center">
        <svg className="w-6 h-6 mr-2 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
        </svg>
        JSON格式题库导入
      </h2>

      {/* 说明信息 */}
      <div className="bg-blue-50 border-l-4 border-blue-500 text-blue-700 p-4 mb-6 rounded">
        <div className="flex">
          <div className="flex-shrink-0">
            <svg className="h-5 w-5 text-blue-500" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="ml-3">
            <p className="text-sm font-medium">JSON文件格式说明</p>
            <div className="mt-2 text-sm">
              <p>支持标准JSON格式的题库文件，包含以下字段：</p>
              <pre className="mt-2 font-mono text-xs bg-blue-100 p-3 rounded overflow-x-auto">
{`{
  "version": 1,
  "meta": {
    "subject": "题库名称",
    "source": "题库来源",
    "totalQuestions": 100
  },
  "questions": [
    {
      "id": "Q-0001",
      "type": "single",  // single或multiple
      "stem": "题目内容",
      "options": ["选项A", "选项B", "选项C", "选项D"],
      "answer": [0],  // 正确答案索引（0=A, 1=B, 2=C, 3=D）
      "analysis": "解析内容",
      "difficulty": 4,
      "tags": ["标签1", "标签2"]
    }
  ]
}`}
              </pre>
              
              <div className="mt-3 p-2 rounded bg-blue-100">
                <p className="font-medium text-blue-800 mb-1">数据库字段映射：</p>
                <ul className="list-disc list-inside text-xs space-y-1">
                  <li><strong>stem</strong> → questions.text（题干）</li>
                  <li><strong>type</strong> → questions.questionType（单选/多选）</li>
                  <li><strong>analysis</strong> → questions.explanation（解析）</li>
                  <li><strong>options[]</strong> → options.text（选项内容）</li>
                  <li><strong>answer[]</strong> → options.isCorrect（正确答案标记）</li>
                  <li className="text-gray-600">⚠️ answer是索引数组：0=A, 1=B, 2=C, 3=D</li>
                </ul>
              </div>
              
              <div className="mt-2 p-2 rounded bg-yellow-50 border border-yellow-200">
                <p className="font-medium text-yellow-800 mb-1 text-xs">以下字段会被忽略（数据库表中不存在）：</p>
                <ul className="list-disc list-inside text-xs text-yellow-700">
                  <li><strong>id</strong>（系统会自动生成UUID）</li>
                  <li><strong>difficulty</strong>（难度等级）</li>
                  <li><strong>tags</strong>（标签）</li>
                  <li><strong>chapter</strong>（章节）</li>
                </ul>
                <p className="text-xs text-yellow-700 mt-1">💡 这些字段不影响导入，可以保留在JSON中</p>
              </div>
            </div>
          </div>
        </div>
      </div>
        
      <form onSubmit={handleSubmit} className="space-y-6 bg-white p-6 rounded-lg shadow-sm border border-gray-200">
        {/* 题库信息表单 */}
        <div className="space-y-4">
          <h3 className="text-lg font-medium text-gray-900 border-b pb-2">题库信息</h3>
          
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            <div>
              <label htmlFor="title" className="block text-sm font-medium text-gray-700">
                题库标题 <span className="text-red-500">*</span>
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
                分类 <span className="text-red-500">*</span>
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
              题库说明 <span className="text-red-500">*</span>
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
              付费题库
            </label>
          </div>
          
          {newQuestionSetData.isPaid && (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
              <div>
                <label htmlFor="price" className="block text-sm font-medium text-gray-700">
                  价格 (¥)
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
                  试用题目数量
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

        {/* 文件上传 */}
        <div>
          <h3 className="text-lg font-medium text-gray-900 border-b pb-2 mb-4">上传JSON文件</h3>
          
          <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 border-dashed rounded-md">
            <div className="space-y-1 text-center">
              <svg className="mx-auto h-12 w-12 text-gray-400" stroke="currentColor" fill="none" viewBox="0 0 48 48">
                <path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <div className="flex text-sm text-gray-600">
                <label htmlFor="file-upload" className="relative cursor-pointer bg-white rounded-md font-medium text-blue-600 hover:text-blue-500">
                  <span>上传文件</span>
                  <input 
                    id="file-upload" 
                    name="file-upload" 
                    type="file" 
                    className="sr-only"
                    accept=".json"
                    onChange={handleFileChange}
                    disabled={isUploading}
                  />
                </label>
                <p className="pl-1">或拖放文件到这里</p>
              </div>
              <p className="text-xs text-gray-500">
                仅支持JSON格式，最大10MB
              </p>
            </div>
          </div>
        </div>
        
        {/* JSON预览 */}
        {jsonPreview && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              文件信息预览
            </label>
            <div className="mt-1 bg-gray-50 p-4 rounded-md border border-gray-200">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="font-medium text-gray-700">文件名：</span>
                  <span className="text-gray-600">{file?.name}</span>
                </div>
                <div>
                  <span className="font-medium text-gray-700">文件大小：</span>
                  <span className="text-gray-600">{file ? (file.size / 1024).toFixed(2) : 0} KB</span>
                </div>
                {jsonPreview.meta?.subject && (
                  <div>
                    <span className="font-medium text-gray-700">题库名称：</span>
                    <span className="text-gray-600">{jsonPreview.meta.subject}</span>
                  </div>
                )}
                {jsonPreview.meta?.source && (
                  <div>
                    <span className="font-medium text-gray-700">来源：</span>
                    <span className="text-gray-600">{jsonPreview.meta.source}</span>
                  </div>
                )}
                <div>
                  <span className="font-medium text-gray-700">题目数量：</span>
                  <span className="text-gray-600">{jsonPreview.questions?.length || 0}</span>
                </div>
                {jsonPreview.version && (
                  <div>
                    <span className="font-medium text-gray-700">版本：</span>
                    <span className="text-gray-600">{jsonPreview.version}</span>
                  </div>
                )}
              </div>
              
              {jsonPreview.questions && jsonPreview.questions.length > 0 && (
                <div className="mt-4 pt-4 border-t border-gray-200">
                  <p className="text-sm font-medium text-gray-700 mb-2">题目示例（前3题）：</p>
                  <div className="space-y-2 max-h-60 overflow-auto">
                    {jsonPreview.questions.slice(0, 3).map((q: JSONQuestion, idx: number) => (
                      <div key={idx} className="text-xs bg-white p-2 rounded border border-gray-200">
                        <p className="font-medium text-gray-800">{q.id}: {q.stem.substring(0, 50)}...</p>
                        <p className="text-gray-600 mt-1">类型: {q.type === 'single' ? '单选' : '多选'} | 选项数: {q.options?.length || 0}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* 上传进度 */}
        {isUploading && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              上传进度
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
                <p className="text-sm font-medium">上传完成</p>
                <div className="mt-2 text-sm">
                  <p>成功导入: <span className="font-bold">{uploadResult.success}</span> 道题目</p>
                  {uploadResult.failed > 0 && (
                    <p className="text-red-600">失败: <span className="font-bold">{uploadResult.failed}</span> 道题目</p>
                  )}
                  {uploadResult.errors && uploadResult.errors.length > 0 && (
                    <div className="mt-2">
                      <p className="font-medium">错误详情：</p>
                      <ul className="list-disc list-inside text-xs mt-1 max-h-32 overflow-auto">
                        {uploadResult.errors.map((error, idx) => (
                          <li key={idx} className="text-red-600">{error}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
        
        {/* 提交按钮 */}
        <div className="flex justify-end space-x-3">
          <button
            type="button"
            onClick={resetForm}
            className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            disabled={isUploading}
          >
            重置
          </button>
          <button
            type="submit"
            className={`
              inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white 
              ${isUploading ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500'} 
            `}
            disabled={isUploading || !file || !newQuestionSetData.title}
          >
            {isUploading ? (
              <>
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                处理中...
              </>
            ) : (
              <>
                <svg className="-ml-1 mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
                创建题库并导入
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};

export default AdminJSONUpload;
