import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useUser } from '../contexts/UserContext';
import AdminUserManagement from './admin/AdminUserManagement';
import AdminQuestionSets from './admin/AdminQuestionSets';
import AdminHomeContent from './admin/AdminHomeContent';
import AdminRedeemCodes from './admin/AdminRedeemCodes';
import AdminFeaturedQuestionSets from './admin/AdminFeaturedQuestionSets';

enum AdminTab {
  USERS = 'users',
  QUESTION_SETS = 'questionSets',
  HOME_CONTENT = 'homeContent',
  REDEEM_CODES = 'redeemCodes',
  DASHBOARD = 'dashboard',
  FEATURED_QUESTION_SETS = 'featuredQuestionSets'
}

const AdminPage: React.FC = () => {
  const { user, isAdmin } = useUser();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<AdminTab>(AdminTab.DASHBOARD);
  
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
                  onClick={() => setActiveTab(AdminTab.DASHBOARD)}
                  className={`w-full text-left px-3 py-2 rounded-md flex items-center ${activeTab === AdminTab.DASHBOARD ? 'bg-gray-200 text-gray-900' : 'text-gray-600 hover:bg-gray-50'}`}
                >
                  <svg className="mr-3 h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                  </svg>
                  控制面板
                </button>
                <button
                  onClick={() => setActiveTab(AdminTab.USERS)}
                  className={`w-full text-left px-3 py-2 rounded-md flex items-center ${activeTab === AdminTab.USERS ? 'bg-gray-200 text-gray-900' : 'text-gray-600 hover:bg-gray-50'}`}
                >
                  <svg className="mr-3 h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                  用户管理
                </button>
                <button
                  onClick={() => setActiveTab(AdminTab.QUESTION_SETS)}
                  className={`w-full text-left px-3 py-2 rounded-md flex items-center ${activeTab === AdminTab.QUESTION_SETS ? 'bg-gray-200 text-gray-900' : 'text-gray-600 hover:bg-gray-50'}`}
                >
                  <svg className="mr-3 h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                  题库管理
                </button>
                <button
                  onClick={() => setActiveTab(AdminTab.REDEEM_CODES)}
                  className={`w-full text-left px-3 py-2 rounded-md flex items-center ${activeTab === AdminTab.REDEEM_CODES ? 'bg-gray-200 text-gray-900' : 'text-gray-600 hover:bg-gray-50'}`}
                >
                  <svg className="mr-3 h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                  兑换码管理
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
                <button
                  onClick={() => setActiveTab(AdminTab.FEATURED_QUESTION_SETS)}
                  className={`w-full text-left px-3 py-2 rounded-md flex items-center ${activeTab === AdminTab.FEATURED_QUESTION_SETS ? 'bg-gray-200 text-gray-900' : 'text-gray-600 hover:bg-gray-50'}`}
                >
                  <svg className="mr-3 h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                  </svg>
                  精选题库管理
                </button>
              </nav>
            </div>
            
            {/* 右侧内容 */}
            <div className="mt-6 lg:mt-0 lg:col-span-9">
              <div className="bg-white shadow overflow-hidden sm:rounded-lg">
                {activeTab === AdminTab.DASHBOARD && (
                  <div className="px-4 py-5 sm:p-6">
                    <h2 className="text-lg leading-6 font-medium text-gray-900 mb-4">控制面板</h2>
                    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
                      <div className="bg-blue-50 overflow-hidden shadow rounded-lg">
                        <div className="p-5">
                          <div className="flex items-center">
                            <div className="flex-shrink-0 bg-blue-100 rounded-md p-3">
                              <svg className="h-6 w-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                              </svg>
                            </div>
                            <div className="ml-5 w-0 flex-1">
                              <dt className="text-sm font-medium text-gray-500 truncate">
                                用户管理
                              </dt>
                              <dd className="flex items-baseline">
                                <div className="text-2xl font-semibold text-gray-900">
                                  管理所有用户
                                </div>
                              </dd>
                            </div>
                          </div>
                        </div>
                        <div className="bg-blue-100 px-5 py-3">
                          <div className="text-sm">
                            <button
                              onClick={() => setActiveTab(AdminTab.USERS)}
                              className="font-medium text-blue-700 hover:text-blue-900"
                            >
                              进入管理
                            </button>
                          </div>
                        </div>
                      </div>
                      
                      <div className="bg-green-50 overflow-hidden shadow rounded-lg">
                        <div className="p-5">
                          <div className="flex items-center">
                            <div className="flex-shrink-0 bg-green-100 rounded-md p-3">
                              <svg className="h-6 w-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                              </svg>
                            </div>
                            <div className="ml-5 w-0 flex-1">
                              <dt className="text-sm font-medium text-gray-500 truncate">
                                题库管理
                              </dt>
                              <dd className="flex items-baseline">
                                <div className="text-2xl font-semibold text-gray-900">
                                  管理所有题库
                                </div>
                              </dd>
                            </div>
                          </div>
                        </div>
                        <div className="bg-green-100 px-5 py-3">
                          <div className="text-sm">
                            <button
                              onClick={() => setActiveTab(AdminTab.QUESTION_SETS)}
                              className="font-medium text-green-700 hover:text-green-900"
                            >
                              进入管理
                            </button>
                          </div>
                        </div>
                      </div>
                      
                      <div className="bg-yellow-50 overflow-hidden shadow rounded-lg">
                        <div className="p-5">
                          <div className="flex items-center">
                            <div className="flex-shrink-0 bg-yellow-100 rounded-md p-3">
                              <svg className="h-6 w-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                              </svg>
                            </div>
                            <div className="ml-5 w-0 flex-1">
                              <dt className="text-sm font-medium text-gray-500 truncate">
                                兑换码管理
                              </dt>
                              <dd className="flex items-baseline">
                                <div className="text-2xl font-semibold text-gray-900">
                                  管理兑换码
                                </div>
                              </dd>
                            </div>
                          </div>
                        </div>
                        <div className="bg-yellow-100 px-5 py-3">
                          <div className="text-sm">
                            <button
                              onClick={() => setActiveTab(AdminTab.REDEEM_CODES)}
                              className="font-medium text-yellow-700 hover:text-yellow-900"
                            >
                              进入管理
                            </button>
                          </div>
                        </div>
                      </div>
                      
                      <div className="bg-purple-50 overflow-hidden shadow rounded-lg">
                        <div className="p-5">
                          <div className="flex items-center">
                            <div className="flex-shrink-0 bg-purple-100 rounded-md p-3">
                              <svg className="h-6 w-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                              </svg>
                            </div>
                            <div className="ml-5 w-0 flex-1">
                              <dt className="text-sm font-medium text-gray-500 truncate">
                                首页管理
                              </dt>
                              <dd className="flex items-baseline">
                                <div className="text-2xl font-semibold text-gray-900">
                                  管理首页内容
                                </div>
                              </dd>
                            </div>
                          </div>
                        </div>
                        <div className="bg-purple-100 px-5 py-3">
                          <div className="text-sm">
                            <button
                              onClick={() => setActiveTab(AdminTab.HOME_CONTENT)}
                              className="font-medium text-purple-700 hover:text-purple-900"
                            >
                              进入管理
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
                
                {activeTab === AdminTab.USERS && <AdminUserManagement />}
                {activeTab === AdminTab.QUESTION_SETS && <AdminQuestionSets />}
                {activeTab === AdminTab.REDEEM_CODES && <AdminRedeemCodes />}
                {activeTab === AdminTab.HOME_CONTENT && <AdminHomeContent />}
                {activeTab === AdminTab.FEATURED_QUESTION_SETS && <AdminFeaturedQuestionSets />}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminPage; 