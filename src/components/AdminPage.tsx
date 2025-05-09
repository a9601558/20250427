import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useUser } from '../contexts/UserContext';
import AdminUserManagement from './admin/AdminUserManagement';
import AdminHomeContent from './admin/AdminHomeContent';
import AdminRedeemCodes from './admin/AdminRedeemCodes';
import AddQuestionSet from './AddQuestionSet';
import ManageQuestionSets from './ManageQuestionSets';
import AdminFeaturedManagement from './admin/AdminFeaturedManagement';
import AdminQuestionSetInfo from './admin/AdminQuestionSetInfo';

enum AdminTab {
  USER_MANAGEMENT = 'userManagement',
  REDEEM_CODES = 'redeemCodes',
  QUESTION_SETS = 'questionSets',
  ADD_QUESTION_SET = 'addQuestionSet',
  MANAGE_QUESTION_SETS = 'manageQuestionSets',
  FEATURED_MANAGEMENT = 'featuredManagement',
  HOME_CONTENT = 'homeContent',
  QUESTION_SET_INFO = 'questionSetInfo',
}

const AdminPage: React.FC = () => {
  const { user, isAdmin } = useUser();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<AdminTab>(AdminTab.HOME_CONTENT);
  
  // 验证用户是否为管理员
  useEffect(() => {
    if (!user) {
      navigate('/');
    } else if (!isAdmin()) {
      navigate('/');
      alert('您没有管理员权限');
    }
  }, [user, isAdmin, navigate]);
  
  if (!user || !isAdmin()) {
    return <div className="min-h-screen bg-gray-100 flex items-center justify-center">检查权限中...</div>;
  }
  
  return (
    <div className="min-h-screen bg-gray-100">
      <div className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex">
              <div className="flex-shrink-0 flex items-center">
                <h1 className="text-xl font-bold text-gray-900">ExamTopics 管理后台</h1>
              </div>
            </div>
            <div className="flex items-center">
              <Link
                to="/"
                className="ml-3 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
              >
                返回前台
              </Link>
            </div>
          </div>
        </div>
      </div>

      <div className="py-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="lg:grid lg:grid-cols-12 lg:gap-8">
            {/* 左侧导航 */}
            <div className="lg:col-span-3">
              <nav className="space-y-1">
                <button
                  onClick={() => setActiveTab(AdminTab.USER_MANAGEMENT)}
                  className={`w-full text-left px-3 py-2 rounded-md flex items-center ${activeTab === AdminTab.USER_MANAGEMENT ? 'bg-gray-200 text-gray-900' : 'text-gray-600 hover:bg-gray-50'}`}
                >
                  <svg className="mr-3 h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                  用户管理
                </button>
                <button
                  onClick={() => setActiveTab(AdminTab.ADD_QUESTION_SET)}
                  className={`w-full text-left px-3 py-2 rounded-md flex items-center ${activeTab === AdminTab.ADD_QUESTION_SET ? 'bg-gray-200 text-gray-900' : 'text-gray-600 hover:bg-gray-50'}`}
                >
                  <svg className="mr-3 h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                  </svg>
                  添加题库
                </button>
                <button
                  onClick={() => setActiveTab(AdminTab.MANAGE_QUESTION_SETS)}
                  className={`w-full text-left px-3 py-2 rounded-md flex items-center ${activeTab === AdminTab.MANAGE_QUESTION_SETS ? 'bg-gray-200 text-gray-900' : 'text-gray-600 hover:bg-gray-50'}`}
                >
                  <svg className="mr-3 h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                  管理题库
                </button>
                <button
                  onClick={() => setActiveTab(AdminTab.QUESTION_SET_INFO)}
                  className={`w-full text-left px-3 py-2 rounded-md flex items-center ${activeTab === AdminTab.QUESTION_SET_INFO ? 'bg-gray-200 text-gray-900' : 'text-gray-600 hover:bg-gray-50'}`}
                >
                  <svg className="mr-3 h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                  </svg>
                  题库信息管理
                </button>
                <button
                  onClick={() => setActiveTab(AdminTab.REDEEM_CODES)}
                  className={`w-full text-left px-3 py-2 rounded-md flex items-center ${activeTab === AdminTab.REDEEM_CODES ? 'bg-gray-200 text-gray-900' : 'text-gray-600 hover:bg-gray-50'}`}
                >
                  <svg className="mr-3 h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                  题库兑换码管理
                </button>
                <button
                  onClick={() => setActiveTab(AdminTab.FEATURED_MANAGEMENT)}
                  className={`w-full text-left px-3 py-2 rounded-md flex items-center ${activeTab === AdminTab.FEATURED_MANAGEMENT ? 'bg-gray-200 text-gray-900' : 'text-gray-600 hover:bg-gray-50'}`}
                >
                  <svg className="mr-3 h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                  </svg>
                  精选内容管理
                </button>
                <button
                  onClick={() => setActiveTab(AdminTab.HOME_CONTENT)}
                  className={`w-full text-left px-3 py-2 rounded-md flex items-center ${activeTab === AdminTab.HOME_CONTENT ? 'bg-gray-200 text-gray-900' : 'text-gray-600 hover:bg-gray-50'}`}
                >
                  <svg className="mr-3 h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                  </svg>
                  首页内容管理
                </button>
              </nav>
            </div>
            
            {/* 右侧内容 */}
            <div className="mt-6 lg:mt-0 lg:col-span-9">
              <div className="bg-white shadow overflow-hidden sm:rounded-lg">
                {activeTab === AdminTab.USER_MANAGEMENT && <AdminUserManagement />}
                {activeTab === AdminTab.ADD_QUESTION_SET && <AddQuestionSet />}
                {activeTab === AdminTab.MANAGE_QUESTION_SETS && <ManageQuestionSets />}
                {activeTab === AdminTab.REDEEM_CODES && <AdminRedeemCodes />}
                {activeTab === AdminTab.FEATURED_MANAGEMENT && <AdminFeaturedManagement />}
                {activeTab === AdminTab.HOME_CONTENT && <AdminHomeContent />}
                {activeTab === AdminTab.QUESTION_SET_INFO && <AdminQuestionSetInfo />}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminPage; 