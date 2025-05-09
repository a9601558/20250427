import React, { useState, useEffect } from 'react';
import { questionSetService } from '../../services/api';
import { toast } from 'react-toastify';

interface QuestionSet {
  id: string;
  title: string;
  description: string;
  category: string;
  icon: string;
  isPaid: boolean;
  price: number | null;
  trialQuestions: number | null;
  isFeatured: boolean;
  featuredCategory?: string;
  questionCount?: number;
  createdAt: Date;
  updatedAt: Date;
}

const AdminQuestionSetInfo: React.FC = () => {
  const [questionSets, setQuestionSets] = useState<QuestionSet[]>([]);
  const [filteredSets, setFilteredSets] = useState<QuestionSet[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSet, setSelectedSet] = useState<QuestionSet | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editFormData, setEditFormData] = useState<QuestionSet | null>(null);
  const [updateLoading, setUpdateLoading] = useState(false);
  
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
    '其他'
  ];
  
  const iconOptions = [
    '📝', '📚', '💻', '🔍', '🧩', '⚙️', '📊', '🔐', '📡', '🛠️',
    '🧪', '🔬', '📱', '🌐', '🤖', '🧠', '🔥', '💾', '⚡', '☁️'
  ];

  // 获取所有题库
  const fetchQuestionSets = async () => {
    setLoading(true);
    try {
      const response = await questionSetService.getAllQuestionSets();
      if (response.success && response.data) {
        setQuestionSets(response.data);
        setFilteredSets(response.data);
      } else {
        toast.error('获取题库列表失败');
      }
    } catch (error) {
      console.error('获取题库列表失败:', error);
      toast.error('获取题库列表失败');
    } finally {
      setLoading(false);
    }
  };

  // 初始加载
  useEffect(() => {
    fetchQuestionSets();
  }, []);

  // 搜索过滤
  useEffect(() => {
    if (searchTerm.trim() === '') {
      setFilteredSets(questionSets);
    } else {
      const term = searchTerm.toLowerCase();
      const filtered = questionSets.filter(set => 
        set.title.toLowerCase().includes(term) || 
        set.description.toLowerCase().includes(term) || 
        set.category.toLowerCase().includes(term)
      );
      setFilteredSets(filtered);
    }
  }, [searchTerm, questionSets]);

  // 处理题库选择
  const handleSelectSet = (set: QuestionSet) => {
    setSelectedSet(set);
    setIsEditing(false);
  };

  // 切换到编辑模式
  const handleEditClick = () => {
    if (selectedSet) {
      setEditFormData({...selectedSet});
      setIsEditing(true);
    }
  };

  // 处理表单输入变化
  const handleFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    if (!editFormData) return;
    
    const { name, value, type } = e.target;
    
    if (type === 'checkbox') {
      const target = e.target as HTMLInputElement;
      setEditFormData({
        ...editFormData,
        [name]: target.checked
      });
    } else if (name === 'price' || name === 'trialQuestions') {
      setEditFormData({
        ...editFormData,
        [name]: value === '' ? null : parseFloat(value)
      });
    } else {
      setEditFormData({
        ...editFormData,
        [name]: value
      });
    }
  };

  // 保存编辑
  const handleSaveEdit = async () => {
    if (!editFormData) return;
    
    setUpdateLoading(true);
    try {
      const response = await questionSetService.updateQuestionSet(editFormData.id, editFormData);
      
      if (response.success && response.data) {
        toast.success('题库信息更新成功');
        
        // 更新本地状态
        setQuestionSets(prev => 
          prev.map(set => set.id === editFormData.id ? {...editFormData, updatedAt: new Date()} : set)
        );
        setSelectedSet({...editFormData, updatedAt: new Date()});
        setIsEditing(false);
      } else {
        toast.error(`更新失败: ${response.message || '未知错误'}`);
      }
    } catch (error) {
      console.error('更新题库信息出错:', error);
      toast.error('更新题库信息时发生错误');
    } finally {
      setUpdateLoading(false);
    }
  };

  // 删除题库
  const handleDeleteSet = async (id: string) => {
    if (!window.confirm('确定要删除这个题库吗？此操作不可撤销，所有相关题目和用户数据也将被删除。')) {
      return;
    }
    
    try {
      const response = await questionSetService.deleteQuestionSet(id);
      
      if (response.success) {
        toast.success('题库已成功删除');
        
        // 更新本地状态
        setQuestionSets(prev => prev.filter(set => set.id !== id));
        if (selectedSet?.id === id) {
          setSelectedSet(null);
          setIsEditing(false);
        }
      } else {
        toast.error(`删除失败: ${response.message || '未知错误'}`);
      }
    } catch (error) {
      console.error('删除题库出错:', error);
      toast.error('删除题库时发生错误');
    }
  };

  // 刷新题目数量
  const handleRefreshQuestionCount = async (id: string) => {
    try {
      const response = await questionSetService.updateQuestionCount(id);
      
      if (response.success) {
        toast.success('题目数量已更新');
        
        // 重新获取题库列表以显示更新后的数量
        fetchQuestionSets();
      } else {
        toast.error(`更新题目数量失败: ${response.message || '未知错误'}`);
      }
    } catch (error) {
      console.error('更新题目数量出错:', error);
      toast.error('更新题目数量时发生错误');
    }
  };

  // 格式化日期
  const formatDate = (dateString: string | Date): string => {
    try {
      const date = new Date(dateString);
      return date.toLocaleString();
    } catch (error) {
      return '无效日期';
    }
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">题库信息管理</h1>
      
      {/* 搜索栏 */}
      <div className="mb-6">
        <div className="flex items-center">
          <div className="relative flex-grow">
            <input
              type="text"
              placeholder="搜索题库标题、描述或分类..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 pl-10"
            />
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <svg className="h-5 w-5 text-gray-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
              </svg>
            </div>
          </div>
          <button
            onClick={() => fetchQuestionSets()}
            className="ml-4 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 flex items-center"
          >
            <svg className="h-5 w-5 mr-1" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            刷新列表
          </button>
        </div>
      </div>
      
      {/* 主内容区域 */}
      <div className="flex space-x-6">
        {/* 题库列表 */}
        <div className="w-1/3 bg-white p-4 rounded-md shadow">
          <h2 className="text-lg font-semibold mb-4">题库列表 ({filteredSets.length})</h2>
          
          {loading ? (
            <div className="py-20 flex justify-center">
              <svg className="animate-spin h-8 w-8 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            </div>
          ) : (
            <div className="overflow-y-auto max-h-[calc(100vh-300px)]">
              {filteredSets.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  没有找到匹配的题库
                </div>
              ) : (
                <ul className="divide-y divide-gray-200">
                  {filteredSets.map(set => (
                    <li 
                      key={set.id}
                      className={`py-3 px-2 cursor-pointer hover:bg-gray-50 ${selectedSet?.id === set.id ? 'bg-blue-50' : ''}`}
                      onClick={() => handleSelectSet(set)}
                    >
                      <div className="flex items-start">
                        <div className="mr-2 text-xl">{set.icon || '📝'}</div>
                        <div className="flex-grow">
                          <h3 className="font-medium text-gray-900 truncate">{set.title}</h3>
                          <p className="text-sm text-gray-500 truncate">{set.category}</p>
                          <div className="mt-1 flex items-center text-xs text-gray-500">
                            <span className={`inline-flex items-center ${set.isPaid ? 'text-yellow-600' : 'text-green-600'}`}>
                              {set.isPaid ? '付费' : '免费'}
                            </span>
                            <span className="mx-1">•</span>
                            <span>{set.questionCount || 0} 题</span>
                          </div>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
        
        {/* 题库详情/编辑区域 */}
        <div className="w-2/3 bg-white p-4 rounded-md shadow">
          {selectedSet ? (
            <>
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-lg font-semibold">
                  {isEditing ? '编辑题库信息' : '题库详细信息'}
                </h2>
                <div className="flex space-x-2">
                  {!isEditing ? (
                    <>
                      <button
                        onClick={handleEditClick}
                        className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        编辑信息
                      </button>
                      <button
                        onClick={() => handleRefreshQuestionCount(selectedSet.id)}
                        className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500"
                      >
                        更新题目数量
                      </button>
                      <button
                        onClick={() => handleDeleteSet(selectedSet.id)}
                        className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500"
                      >
                        删除题库
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={handleSaveEdit}
                        disabled={updateLoading}
                        className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 flex items-center"
                      >
                        {updateLoading ? (
                          <>
                            <svg className="animate-spin h-4 w-4 mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            保存中...
                          </>
                        ) : '保存修改'}
                      </button>
                      <button
                        onClick={() => setIsEditing(false)}
                        className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500"
                      >
                        取消
                      </button>
                    </>
                  )}
                </div>
              </div>
              
              {isEditing && editFormData ? (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">题库标题</label>
                    <input
                      type="text"
                      name="title"
                      value={editFormData.title}
                      onChange={handleFormChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      required
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">描述</label>
                    <textarea
                      name="description"
                      value={editFormData.description}
                      onChange={handleFormChange}
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">分类</label>
                      <select
                        name="category"
                        value={editFormData.category}
                        onChange={handleFormChange}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      >
                        <option value="">请选择分类</option>
                        {categoryOptions.map(category => (
                          <option key={category} value={category}>{category}</option>
                        ))}
                      </select>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">图标</label>
                      <div className="grid grid-cols-5 gap-2">
                        {iconOptions.map(icon => (
                          <div
                            key={icon}
                            onClick={() => setEditFormData({...editFormData, icon})}
                            className={`text-2xl cursor-pointer p-2 text-center rounded-md transition-colors ${editFormData.icon === icon ? 'bg-blue-100 border-2 border-blue-500' : 'hover:bg-gray-100'}`}
                          >
                            {icon}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="isPaid"
                      name="isPaid"
                      checked={editFormData.isPaid}
                      onChange={(e) => handleFormChange(e as any)}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                    <label htmlFor="isPaid" className="ml-2 block text-sm text-gray-900">
                      设为付费题库
                    </label>
                  </div>
                  
                  {editFormData.isPaid && (
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">价格 (¥)</label>
                        <input
                          type="number"
                          name="price"
                          value={editFormData.price || ''}
                          onChange={handleFormChange}
                          min="0"
                          step="0.01"
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">试用题目数量</label>
                        <input
                          type="number"
                          name="trialQuestions"
                          value={editFormData.trialQuestions || ''}
                          onChange={handleFormChange}
                          min="0"
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>
                    </div>
                  )}
                  
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="isFeatured"
                      name="isFeatured"
                      checked={editFormData.isFeatured}
                      onChange={(e) => handleFormChange(e as any)}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                    <label htmlFor="isFeatured" className="ml-2 block text-sm text-gray-900">
                      设为精选题库
                    </label>
                  </div>
                  
                  {editFormData.isFeatured && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">精选分类</label>
                      <input
                        type="text"
                        name="featuredCategory"
                        value={editFormData.featuredCategory || ''}
                        onChange={handleFormChange}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        placeholder="输入一个精选分类名称"
                      />
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="flex items-start">
                    <div className="mr-4 text-4xl">{selectedSet.icon || '📝'}</div>
                    <div>
                      <h3 className="text-xl font-medium text-gray-900">{selectedSet.title}</h3>
                      <p className="text-sm text-gray-500">{selectedSet.category}</p>
                    </div>
                  </div>
                  
                  <div>
                    <h4 className="text-sm font-medium text-gray-500 mb-1">描述</h4>
                    <p className="text-gray-900">{selectedSet.description || '无描述'}</p>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-6">
                    <div>
                      <h4 className="text-sm font-medium text-gray-500 mb-1">付费状态</h4>
                      <p className={`inline-flex items-center ${selectedSet.isPaid ? 'text-yellow-600' : 'text-green-600'}`}>
                        {selectedSet.isPaid ? '付费题库' : '免费题库'}
                      </p>
                    </div>
                    
                    {selectedSet.isPaid && (
                      <>
                        <div>
                          <h4 className="text-sm font-medium text-gray-500 mb-1">价格</h4>
                          <p className="text-gray-900">¥{selectedSet.price || '未设置'}</p>
                        </div>
                        
                        <div>
                          <h4 className="text-sm font-medium text-gray-500 mb-1">试用题目数量</h4>
                          <p className="text-gray-900">{selectedSet.trialQuestions || '无试用'}</p>
                        </div>
                      </>
                    )}
                    
                    <div>
                      <h4 className="text-sm font-medium text-gray-500 mb-1">精选状态</h4>
                      <p className={`inline-flex items-center ${selectedSet.isFeatured ? 'text-blue-600' : 'text-gray-600'}`}>
                        {selectedSet.isFeatured ? '精选题库' : '非精选题库'}
                      </p>
                    </div>
                    
                    {selectedSet.isFeatured && selectedSet.featuredCategory && (
                      <div>
                        <h4 className="text-sm font-medium text-gray-500 mb-1">精选分类</h4>
                        <p className="text-gray-900">{selectedSet.featuredCategory}</p>
                      </div>
                    )}
                  </div>
                  
                  <div className="grid grid-cols-2 gap-6">
                    <div>
                      <h4 className="text-sm font-medium text-gray-500 mb-1">题目数量</h4>
                      <p className="text-gray-900">{selectedSet.questionCount || 0} 题</p>
                    </div>
                    
                    <div>
                      <h4 className="text-sm font-medium text-gray-500 mb-1">ID</h4>
                      <p className="text-gray-900 text-sm">{selectedSet.id}</p>
                    </div>
                    
                    <div>
                      <h4 className="text-sm font-medium text-gray-500 mb-1">创建时间</h4>
                      <p className="text-gray-900">{formatDate(selectedSet.createdAt)}</p>
                    </div>
                    
                    <div>
                      <h4 className="text-sm font-medium text-gray-500 mb-1">最后更新</h4>
                      <p className="text-gray-900">{formatDate(selectedSet.updatedAt)}</p>
                    </div>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="flex flex-col items-center justify-center h-64">
              <svg className="h-16 w-16 text-gray-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
              </svg>
              <p className="mt-4 text-gray-500">请从左侧列表选择一个题库进行管理</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminQuestionSetInfo; 