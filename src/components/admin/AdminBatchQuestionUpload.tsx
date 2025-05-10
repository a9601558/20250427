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

const AdminBatchQuestionUpload: React.FC = () => {
  const [selectedQuestionSet, setSelectedQuestionSet] = useState<string>('');
  const [questionSets, setQuestionSets] = useState<QuestionSet[]>([]);
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
          toast.error('获取题库列表失败');
        }
      } catch (error) {
        console.error('获取题库列表出错:', error);
        toast.error('获取题库列表出错');
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
      toast.error('只支持 CSV 或 TXT 文件格式');
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

  // 提交文件处理
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedQuestionSet) {
      toast.error('请选择目标题库');
      return;
    }
    
    if (!file) {
      toast.error('请选择要上传的文件');
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);
    setUploadResult(null);

    try {
      // 创建 FormData 对象
      const formData = new FormData();
      formData.append('file', file); // Ensure file is first in the FormData
      formData.append('questionSetId', selectedQuestionSet);

      // Log FormData values for debugging
      console.log('[Upload] FormData questionSetId:', selectedQuestionSet);
      console.log('[Upload] FormData file name:', file.name);
      console.log('[Upload] FormData file size:', file.size);
      
      // Force a slight delay to ensure the form is properly built
      await new Promise(resolve => setTimeout(resolve, 100));

      // 导入修改后的questionSetService而不是使用API
      const myQuestionSetService = await import('../../services/questionSetService');

      // 发送请求
      const response = await myQuestionSetService.default.batchAddQuestions(formData, (progress: number) => {
        setUploadProgress(progress);
      });

      if (response.success) {
        toast.success('问题批量添加成功！');
        setUploadResult({
          success: response.data?.success || 0,
          failed: response.data?.failed || 0,
          errors: response.data?.errors
        });
        // 重置表单
        setFile(null);
        setFilePreview('');
        if (e.target instanceof HTMLFormElement) {
          e.target.reset();
        }
      } else {
        toast.error(`批量添加失败: ${response.message || response.error}`);
      }
    } catch (error) {
      console.error('批量添加问题出错:', error);
      toast.error('批量添加问题出错，请重试');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold text-gray-800 mb-6 flex items-center">
        <svg className="w-6 h-6 mr-2 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
        </svg>
        批量添加题目到现有题库
      </h2>

      <div className="bg-blue-50 border-l-4 border-blue-500 text-blue-700 p-4 mb-6 rounded">
        <div className="flex">
          <div className="flex-shrink-0">
            <svg className="h-5 w-5 text-blue-500" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="ml-3">
            <p className="text-sm font-medium">文件格式说明</p>
            <div className="mt-2 text-sm">
              <p>支持 TXT 或 CSV 格式文件，每行一个问题，格式如下：</p>
              <pre className="mt-1 font-mono text-xs bg-blue-100 p-2 rounded overflow-x-auto mb-2">
                问题?|选项A|选项B|选项C|选项D|正确答案|解析
              </pre>
              <ul className="list-disc list-inside text-xs mt-2">
                <li>每个字段之间使用竖线 | 分隔</li>
                <li><strong>单选题</strong>：正确答案填写单个选项字母，如：A、B、C 或 D</li>
                <li><strong>多选题</strong>：正确答案用英文逗号分隔多个选项字母，如：A,B 或 A,C,D</li>
                <li>注意：单选题请勿在答案中添加逗号，否则会被识别为多选题</li>
                <li>必须包含至少两个选项（问题后至少有两列）</li>
                <li>解析是可选的，可以为空</li>
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
                <strong>示例:</strong><br />
                <span className="block mb-1 border-l-2 border-green-500 pl-2">
                  <strong className="text-green-700">单选题：</strong> 
                  以下哪个是水的化学式?|H2O|CO2|NaCl|CH4|<strong>A</strong>|水的化学式是H2O
                </span>
                <span className="block border-l-2 border-purple-500 pl-2">
                  <strong className="text-purple-700">多选题：</strong> 
                  以下哪些是编程语言?|Java|篮球|Python|足球|<strong>A,C</strong>|Java和Python是编程语言
                </span>
              </p>
              
              <div className="bg-red-50 p-2 mt-3 rounded border-l-2 border-red-500">
                <p className="text-red-700 font-medium">常见错误：</p>
                <ul className="list-disc list-inside text-xs text-red-600">
                  <li>答案字段包含空格：正确写法 <code>A,B</code>，错误写法 <code>A, B</code></li>
                  <li>使用中文逗号：正确写法 <code>A,B</code>，错误写法 <code>A，B</code></li>
                  <li>答案字母大小写不对应：请使用大写字母 <code>A</code> 而非 <code>a</code></li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6 bg-white p-6 rounded-lg shadow-sm border border-gray-200">
        {/* 选择题库 */}
        <div>
          <label htmlFor="questionSet" className="block text-sm font-medium text-gray-700 mb-1">
            选择目标题库
          </label>
          <select
            id="questionSet"
            className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
            value={selectedQuestionSet}
            onChange={(e) => setSelectedQuestionSet(e.target.value)}
            disabled={isLoading || isUploading}
            required
          >
            <option value="">-- 请选择题库 --</option>
            {questionSets.map((set) => (
              <option key={set.id} value={set.id}>
                {set.title} {set.questionCount ? `(${set.questionCount}题)` : ''}
              </option>
            ))}
          </select>
          {isLoading && (
            <p className="mt-1 text-sm text-gray-500">加载题库中...</p>
          )}
        </div>

        {/* 文件上传 */}
        <div>
          <label htmlFor="file" className="block text-sm font-medium text-gray-700 mb-1">
            选择文件 (CSV 或 TXT)
          </label>
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
                    accept=".csv,.txt"
                    onChange={handleFileChange}
                    disabled={isUploading}
                  />
                </label>
                <p className="pl-1">或拖放文件到此处</p>
              </div>
              <p className="text-xs text-gray-500">
                支持 CSV, TXT 文件，最大 10MB
              </p>
            </div>
          </div>
        </div>

        {/* 文件预览 */}
        {filePreview && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              文件预览 (前10行)
            </label>
            <div className="mt-1 bg-gray-50 p-3 rounded-md border border-gray-200 max-h-60 overflow-auto">
              <pre className="text-xs font-mono whitespace-pre-wrap">{filePreview}</pre>
            </div>
            <p className="mt-1 text-xs text-gray-500">
              文件名: {file?.name} | 大小: {file ? (file.size / 1024).toFixed(2) : 0} KB
            </p>
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
                  <p>成功添加: <span className="font-bold">{uploadResult.success}</span> 道题目</p>
                  {uploadResult.failed > 0 && (
                    <p>失败: <span className="font-bold">{uploadResult.failed}</span> 道题目</p>
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
            disabled={isUploading || !file || !selectedQuestionSet}
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
                开始上传
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
            const templateContent = "以下哪个是水的化学式?|H2O|CO2|NaCl|CH4|A|水的化学式是H2O\n以下哪些是编程语言?|Java|篮球|Python|足球|A,C|Java和Python是编程语言\n1+1等于多少?|1|2|3|4|B|1+1=2";
            const blob = new Blob([templateContent], { type: 'text/plain' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = '批量添加题目模板.txt';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
          }}
        >
          <svg className="-ml-0.5 mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          下载模板
        </button>
      </div>
    </div>
  );
};

export default AdminBatchQuestionUpload; 