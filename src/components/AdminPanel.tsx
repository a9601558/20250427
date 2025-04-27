import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AddQuestionSet from './AddQuestionSet';
import ManageQuestionSets from './ManageQuestionSets';

const AdminPanel: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'add-set' | 'manage-sets'>('add-set');
  const navigate = useNavigate();

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-800">管理员控制面板</h1>
        <button 
          onClick={() => navigate('/')} 
          className="text-blue-600 hover:text-blue-800 flex items-center"
        >
          <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          返回首页
        </button>
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="flex -mb-px">
          <button
            className={`py-2 px-4 border-b-2 font-medium text-sm ${
              activeTab === 'add-set'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
            onClick={() => setActiveTab('add-set')}
          >
            添加题库
          </button>
          <button
            className={`ml-8 py-2 px-4 border-b-2 font-medium text-sm ${
              activeTab === 'manage-sets'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
            onClick={() => setActiveTab('manage-sets')}
          >
            管理题库
          </button>
        </nav>
      </div>

      {/* Content Area */}
      <div className="bg-white shadow-md rounded-lg p-6">
        {activeTab === 'add-set' ? (
          <AddQuestionSet />
        ) : (
          <ManageQuestionSets />
        )}
      </div>
    </div>
  );
};

export default AdminPanel; 