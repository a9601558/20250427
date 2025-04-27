import React, { useState } from 'react';
import { questionSets, QuestionSet } from '../../data/questionSets';

const AdminQuizManagement: React.FC = () => {
  // 假设的数据管理函数，实际实现应连接到后端API
  const [managedQuizSets, setManagedQuizSets] = useState<QuestionSet[]>([...questionSets]);
  
  const deleteQuizSet = (id: string) => {
    setManagedQuizSets(prevSets => prevSets.filter(set => set.id !== id));
    return true;
  };
  
  const addQuizSet = (newSet: QuestionSet) => {
    setManagedQuizSets(prevSets => [...prevSets, newSet]);
    return true;
  };
  
  const updateQuizSet = (updatedSet: QuestionSet) => {
    setManagedQuizSets(prevSets => 
      prevSets.map(set => set.id === updatedSet.id ? updatedSet : set)
    );
    return true;
  };

  const [showConfirmDelete, setShowConfirmDelete] = useState<string | null>(null);
  const [editingQuizSet, setEditingQuizSet] = useState<QuestionSet | null>(null);
  const [newQuizSet, setNewQuizSet] = useState<Partial<QuestionSet>>({
    title: '',
    description: '',
    category: '',
    questions: []
  });
  const [showNewQuizForm, setShowNewQuizForm] = useState(false);
  
  // 处理删除题库
  const handleDeleteQuizSet = (quizSetId: string) => {
    if (deleteQuizSet(quizSetId)) {
      setShowConfirmDelete(null);
    } else {
      alert('删除题库失败');
    }
  };
  
  // 处理编辑题库
  const handleEditQuizSet = (quizSet: QuestionSet) => {
    setEditingQuizSet({...quizSet});
  };
  
  // 保存编辑
  const handleSaveEdit = () => {
    if (editingQuizSet) {
      if (updateQuizSet(editingQuizSet)) {
        setEditingQuizSet(null);
      } else {
        alert('更新题库失败');
      }
    }
  };
  
  // 处理新建题库
  const handleCreateQuizSet = () => {
    if (!newQuizSet.title || !newQuizSet.description || !newQuizSet.category) {
      alert('请填写完整信息');
      return;
    }
    
    const quizSetToAdd: QuestionSet = {
      id: `quiz-${Date.now()}`,
      title: newQuizSet.title || '',
      description: newQuizSet.description || '',
      category: newQuizSet.category || '',
      icon: '📚',
      isPaid: false,
      questions: [],
    };
    
    if (addQuizSet(quizSetToAdd)) {
      setNewQuizSet({
        title: '',
        description: '',
        category: '',
        questions: []
      });
      setShowNewQuizForm(false);
    } else {
      alert('添加题库失败');
    }
  };
  
  // 取消新建或编辑
  const handleCancel = () => {
    setEditingQuizSet(null);
    setShowNewQuizForm(false);
  };

  return (
    <div className="px-4 py-5 sm:p-6">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg leading-6 font-medium text-gray-900">题库管理</h2>
        <button
          onClick={() => setShowNewQuizForm(true)}
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
        >
          添加新题库
        </button>
      </div>
      
      {showNewQuizForm && (
        <div className="bg-white shadow sm:rounded-lg mb-6 p-4">
          <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">创建新题库</h3>
          <div className="grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-6">
            <div className="sm:col-span-3">
              <label htmlFor="name" className="block text-sm font-medium text-gray-700">题库名称</label>
              <input
                type="text"
                id="name"
                className="mt-1 focus:ring-indigo-500 focus:border-indigo-500 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md"
                value={newQuizSet.title}
                onChange={(e) => setNewQuizSet({...newQuizSet, title: e.target.value})}
              />
            </div>
            
            <div className="sm:col-span-3">
              <label htmlFor="category" className="block text-sm font-medium text-gray-700">类别</label>
              <input
                type="text"
                id="category"
                className="mt-1 focus:ring-indigo-500 focus:border-indigo-500 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md"
                value={newQuizSet.category}
                onChange={(e) => setNewQuizSet({...newQuizSet, category: e.target.value})}
              />
            </div>
            
            <div className="sm:col-span-6">
              <label htmlFor="description" className="block text-sm font-medium text-gray-700">描述</label>
              <textarea
                id="description"
                rows={3}
                className="mt-1 focus:ring-indigo-500 focus:border-indigo-500 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md"
                value={newQuizSet.description}
                onChange={(e) => setNewQuizSet({...newQuizSet, description: e.target.value})}
              />
            </div>
          </div>
          
          <div className="mt-5 sm:mt-6 sm:flex sm:flex-row-reverse">
            <button
              type="button"
              className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-indigo-600 text-base font-medium text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:ml-3 sm:w-auto sm:text-sm"
              onClick={handleCreateQuizSet}
            >
              创建
            </button>
            <button
              type="button"
              className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:mt-0 sm:w-auto sm:text-sm"
              onClick={handleCancel}
            >
              取消
            </button>
          </div>
        </div>
      )}
      
      {editingQuizSet && (
        <div className="bg-white shadow sm:rounded-lg mb-6 p-4">
          <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">编辑题库</h3>
          <div className="grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-6">
            <div className="sm:col-span-3">
              <label htmlFor="edit-name" className="block text-sm font-medium text-gray-700">题库名称</label>
              <input
                type="text"
                id="edit-name"
                className="mt-1 focus:ring-indigo-500 focus:border-indigo-500 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md"
                value={editingQuizSet.title}
                onChange={(e) => setEditingQuizSet({...editingQuizSet, title: e.target.value})}
              />
            </div>
            
            <div className="sm:col-span-3">
              <label htmlFor="edit-category" className="block text-sm font-medium text-gray-700">类别</label>
              <input
                type="text"
                id="edit-category"
                className="mt-1 focus:ring-indigo-500 focus:border-indigo-500 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md"
                value={editingQuizSet.category}
                onChange={(e) => setEditingQuizSet({...editingQuizSet, category: e.target.value})}
              />
            </div>
            
            <div className="sm:col-span-6">
              <label htmlFor="edit-description" className="block text-sm font-medium text-gray-700">描述</label>
              <textarea
                id="edit-description"
                rows={3}
                className="mt-1 focus:ring-indigo-500 focus:border-indigo-500 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md"
                value={editingQuizSet.description}
                onChange={(e) => setEditingQuizSet({...editingQuizSet, description: e.target.value})}
              />
            </div>
          </div>
          
          <div className="mt-5 sm:mt-6 sm:flex sm:flex-row-reverse">
            <button
              type="button"
              className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-indigo-600 text-base font-medium text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:ml-3 sm:w-auto sm:text-sm"
              onClick={handleSaveEdit}
            >
              保存
            </button>
            <button
              type="button"
              className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:mt-0 sm:w-auto sm:text-sm"
              onClick={handleCancel}
            >
              取消
            </button>
          </div>
        </div>
      )}
      
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                名称
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                类别
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                题目数量
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                付费状态
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                操作
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {managedQuizSets.map((quizSet) => (
              <tr key={quizSet.id}>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm font-medium text-gray-900">{quizSet.title}</div>
                  <div className="text-sm text-gray-500">{quizSet.description}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-gray-900">{quizSet.category}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {quizSet.questions.length}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {quizSet.isPaid ? `付费 (¥${quizSet.price})` : '免费'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                  <div className="flex space-x-2">
                    <button
                      onClick={() => handleEditQuizSet(quizSet)}
                      className="text-indigo-600 hover:text-indigo-900"
                    >
                      编辑
                    </button>
                    
                    {showConfirmDelete === quizSet.id ? (
                      <div className="flex space-x-2">
                        <button
                          onClick={() => handleDeleteQuizSet(quizSet.id)}
                          className="text-red-600 hover:text-red-900"
                        >
                          确认
                        </button>
                        <button
                          onClick={() => setShowConfirmDelete(null)}
                          className="text-gray-600 hover:text-gray-900"
                        >
                          取消
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setShowConfirmDelete(quizSet.id)}
                        className="text-red-600 hover:text-red-900"
                      >
                        删除
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            
            {managedQuizSets.length === 0 && (
              <tr>
                <td colSpan={5} className="px-6 py-4 text-center text-sm text-gray-500">
                  没有题库数据
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default AdminQuizManagement;

 