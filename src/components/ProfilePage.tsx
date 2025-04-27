import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useUser } from '../contexts/UserContext';
import { questionSets } from '../data/questionSets';

// 定义标签页枚举
enum ProfileTab {
  PROGRESS = 'progress',
  PURCHASES = 'purchases',
  REDEEM_CODES = 'redeemCodes',
  SETTINGS = 'settings'
}

const ProfilePage: React.FC = () => {
  const { user, logout } = useUser();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<ProfileTab>(ProfileTab.PROGRESS);
  
  if (!user) {
    // 已经在 ProtectedRoute 中处理，但为了类型安全添加此检查
    return null;
  }

  // 整理用户进度数据
  const progressData = Object.entries(user.progress).map(([quizId, progress]) => {
    const quizSet = questionSets.find(set => set.id === quizId);
    return {
      quizId,
      title: quizSet ? quizSet.title : `题库 ${quizId}`,
      category: quizSet ? quizSet.category : '未知分类',
      icon: quizSet ? quizSet.icon : '📝',
      completedQuestions: progress.completedQuestions,
      totalQuestions: quizSet ? quizSet.questions.length : progress.totalQuestions,
      correctAnswers: progress.correctAnswers,
      lastAccessed: progress.lastAccessed
    };
  });

  // 整理用户购买记录
  const purchaseData = user.purchases ? user.purchases.map(purchase => {
    const quizSet = questionSets.find(set => set.id === purchase.quizId);
    return {
      ...purchase,
      title: quizSet ? quizSet.title : `题库 ${purchase.quizId}`,
      category: quizSet ? quizSet.category : '未知分类',
      icon: quizSet ? quizSet.icon : '📝',
      isActive: new Date(purchase.expiryDate) > new Date()
    };
  }) : [];

  // 整理用户兑换码记录
  const redeemCodeData = user.redeemCodes ? user.redeemCodes.map(code => {
    const quizSet = questionSets.find(set => set.id === code.questionSetId);
    return {
      ...code,
      title: quizSet ? quizSet.title : `题库 ${code.questionSetId}`,
      category: quizSet ? quizSet.category : '未知分类',
      icon: quizSet ? quizSet.icon : '📝'
    };
  }) : [];

  // 计算正确率
  const calculateAccuracy = (correct: number, total: number) => {
    if (total === 0) return 0;
    return Math.round((correct / total) * 100);
  };

  // 退出登录
  const handleLogout = () => {
    logout();
    navigate('/');
  };

  // 格式化日期
  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch (e) {
      return '无效日期';
    }
  };

  // 计算剩余天数
  const calculateRemainingDays = (dateString: string | null) => {
    if (!dateString) return 0;
    
    const expiryDate = new Date(dateString);
    const today = new Date();
    const diffTime = expiryDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    return diffDays > 0 ? diffDays : 0;
  };

  return (
    <div className="min-h-screen bg-gray-50 py-6 sm:py-12">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* 用户信息卡片 */}
        <div className="bg-white shadow rounded-lg overflow-hidden mb-8">
          <div className="px-6 py-5 sm:px-8 sm:py-6 flex flex-col sm:flex-row justify-between items-start sm:items-center">
            <div className="flex items-center mb-4 sm:mb-0">
              <div className="w-16 h-16 flex items-center justify-center bg-blue-100 text-blue-800 rounded-full text-xl font-bold">
                {user.username.slice(0, 2).toUpperCase()}
              </div>
              <div className="ml-4">
                <h2 className="text-xl font-bold text-gray-900">{user.username}</h2>
                <p className="text-sm text-gray-500">{user.email}</p>
                {user.isAdmin && (
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800 mt-1">
                    管理员
                  </span>
                )}
              </div>
            </div>
            <div className="flex flex-col space-y-2 sm:space-y-0 sm:flex-row sm:space-x-2">
              <Link
                to="/"
                className="inline-flex items-center px-3 py-1.5 border border-gray-300 shadow-sm text-sm font-medium rounded text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                <svg className="h-4 w-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                </svg>
                返回主页
              </Link>
              {user.isAdmin && (
                <Link
                  to="/admin"
                  className="inline-flex items-center px-3 py-1.5 border border-purple-300 shadow-sm text-sm font-medium rounded text-purple-700 bg-white hover:bg-purple-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500"
                >
                  <svg className="h-4 w-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  管理后台
                </Link>
              )}
              <button
                onClick={handleLogout}
                className="inline-flex items-center px-3 py-1.5 border border-red-300 shadow-sm text-sm font-medium rounded text-red-700 bg-white hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
              >
                <svg className="h-4 w-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                退出登录
              </button>
            </div>
          </div>
        </div>

        {/* 标签页导航 */}
        <div className="mb-6 border-b border-gray-200">
          <nav className="-mb-px flex space-x-8" aria-label="Tabs">
            <button
              onClick={() => setActiveTab(ProfileTab.PROGRESS)}
              className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === ProfileTab.PROGRESS
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              学习进度
            </button>
            <button
              onClick={() => setActiveTab(ProfileTab.PURCHASES)}
              className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === ProfileTab.PURCHASES
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              购买记录
              {purchaseData.length > 0 && (
                <span className="ml-2 py-0.5 px-2 text-xs rounded-full bg-blue-100 text-blue-800">
                  {purchaseData.length}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab(ProfileTab.REDEEM_CODES)}
              className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === ProfileTab.REDEEM_CODES
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              兑换码
              {redeemCodeData.length > 0 && (
                <span className="ml-2 py-0.5 px-2 text-xs rounded-full bg-blue-100 text-blue-800">
                  {redeemCodeData.length}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab(ProfileTab.SETTINGS)}
              className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === ProfileTab.SETTINGS
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              设置
            </button>
          </nav>
        </div>

        {/* 标签页内容 */}
        <div className="bg-white shadow rounded-lg p-6">
          {/* 学习进度标签页 */}
          {activeTab === ProfileTab.PROGRESS && (
            <div>
              <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
                学习进度
              </h3>
              
              {progressData.length === 0 ? (
                <div className="text-center py-10">
                  <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                  <h3 className="mt-2 text-sm font-medium text-gray-900">暂无学习记录</h3>
                  <p className="mt-1 text-sm text-gray-500">开始答题来记录您的学习进度</p>
                  <div className="mt-6">
                    <Link
                      to="/"
                      className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                    >
                      浏览题库
                    </Link>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {progressData.map((item, index) => (
                    <div key={index} className="border rounded-lg p-4 hover:bg-gray-50 transition-colors">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center">
                          <div className="text-3xl mr-3">{item.icon}</div>
                          <div>
                            <h4 className="text-lg font-medium text-gray-900">{item.title}</h4>
                            <p className="text-sm text-gray-500">{item.category}</p>
                          </div>
                        </div>
                        <Link
                          to={`/quiz/${item.quizId}`}
                          className="inline-flex items-center px-3 py-1 border border-transparent text-xs font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                        >
                          继续学习
                        </Link>
                      </div>
                      <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-4">
                        <div className="px-3 py-2 bg-blue-50 rounded-md">
                          <div className="text-xs font-medium text-blue-800 uppercase">完成度</div>
                          <div className="mt-1 flex justify-between items-center">
                            <div className="text-xl font-semibold text-blue-600">
                              {Math.round((item.completedQuestions / item.totalQuestions) * 100)}%
                            </div>
                            <div className="text-sm text-blue-700">
                              {item.completedQuestions}/{item.totalQuestions}
                            </div>
                          </div>
                        </div>
                        <div className="px-3 py-2 bg-green-50 rounded-md">
                          <div className="text-xs font-medium text-green-800 uppercase">正确率</div>
                          <div className="mt-1 flex justify-between items-center">
                            <div className="text-xl font-semibold text-green-600">
                              {calculateAccuracy(item.correctAnswers, item.completedQuestions)}%
                            </div>
                            <div className="text-sm text-green-700">
                              {item.correctAnswers}/{item.completedQuestions}
                            </div>
                          </div>
                        </div>
                        <div className="px-3 py-2 bg-gray-50 rounded-md sm:col-span-2">
                          <div className="text-xs font-medium text-gray-800 uppercase">最后访问</div>
                          <div className="mt-1 text-base text-gray-600">
                            {formatDate(item.lastAccessed)}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* 购买记录标签页 */}
          {activeTab === ProfileTab.PURCHASES && (
            <div>
              <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
                购买记录
              </h3>
              
              {purchaseData.length === 0 ? (
                <div className="text-center py-10">
                  <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                  <h3 className="mt-2 text-sm font-medium text-gray-900">暂无购买记录</h3>
                  <p className="mt-1 text-sm text-gray-500">浏览并购买题库以获取完整内容</p>
                  <div className="mt-6">
                    <Link
                      to="/"
                      className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                    >
                      浏览题库
                    </Link>
                  </div>
                </div>
              ) : (
                <div className="overflow-hidden rounded-lg border border-gray-200">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          题库信息
                        </th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          订单信息
                        </th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          状态
                        </th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          操作
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {purchaseData.map((purchase, index) => (
                        <tr key={index}>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center">
                              <div className="flex-shrink-0 h-10 w-10 flex items-center justify-center text-xl bg-blue-100 rounded-full">
                                {purchase.icon}
                              </div>
                              <div className="ml-4">
                                <div className="text-sm font-medium text-gray-900">{purchase.title}</div>
                                <div className="text-sm text-gray-500">{purchase.category}</div>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-900">¥{purchase.amount}</div>
                            <div className="text-sm text-gray-500">{formatDate(purchase.purchaseDate)}</div>
                            <div className="text-xs text-gray-500 mt-1">
                              订单号: {purchase.transactionId}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            {purchase.isActive ? (
                              <div>
                                <span className="px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                                  有效
                                </span>
                                <div className="text-xs text-gray-500 mt-1">
                                  剩余 {calculateRemainingDays(purchase.expiryDate)} 天
                                </div>
                                <div className="text-xs text-gray-500">
                                  到期: {formatDate(purchase.expiryDate)}
                                </div>
                              </div>
                            ) : (
                              <div>
                                <span className="px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-red-100 text-red-800">
                                  已过期
                                </span>
                                <div className="text-xs text-gray-500 mt-1">
                                  过期于: {formatDate(purchase.expiryDate)}
                                </div>
                              </div>
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                            <Link
                              to={`/quiz/${purchase.quizId}`}
                              className="text-blue-600 hover:text-blue-900"
                            >
                              开始学习
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* 兑换码记录标签页 */}
          {activeTab === ProfileTab.REDEEM_CODES && (
            <div>
              <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
                兑换码记录
              </h3>
              
              {redeemCodeData.length === 0 ? (
                <div className="text-center py-10">
                  <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                  </svg>
                  <h3 className="mt-2 text-sm font-medium text-gray-900">暂无兑换码记录</h3>
                  <p className="mt-1 text-sm text-gray-500">您可以在题库页面使用兑换码获取内容</p>
                  <div className="mt-6">
                    <Link
                      to="/"
                      className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                    >
                      浏览题库
                    </Link>
                  </div>
                </div>
              ) : (
                <div className="overflow-hidden rounded-lg border border-gray-200">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          兑换码
                        </th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          题库信息
                        </th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          有效期(天)
                        </th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          创建时间
                        </th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          状态
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {redeemCodeData.map((code, index) => (
                        <tr key={index}>
                          <td className="px-6 py-4 whitespace-nowrap font-mono text-sm font-medium">
                            {code.code}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center">
                              <div className="flex-shrink-0 h-8 w-8 flex items-center justify-center text-lg bg-blue-100 rounded-full">
                                {code.icon}
                              </div>
                              <div className="ml-3">
                                <div className="text-sm font-medium text-gray-900">{code.title}</div>
                                <div className="text-xs text-gray-500">{code.category}</div>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {code.validityDays}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {formatDate(code.createdAt)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            {code.usedAt ? (
                              <span className="px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                                已使用 ({formatDate(code.usedAt)})
                              </span>
                            ) : (
                              <span className="px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-yellow-100 text-yellow-800">
                                未使用
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* 设置标签页 */}
          {activeTab === ProfileTab.SETTINGS && (
            <div>
              <h3 className="text-lg leading-6 font-medium text-gray-900 mb-6">
                账户设置
              </h3>
              
              <p className="text-sm text-gray-500 mb-6">
                这里可以修改您的账户设置、修改密码等操作。（该功能正在开发中）
              </p>
              
              <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <svg className="h-5 w-5 text-yellow-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                      <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <h3 className="text-sm font-medium text-yellow-800">
                      功能开发中
                    </h3>
                    <div className="mt-2 text-sm text-yellow-700">
                      <p>
                        账户设置功能正在开发中，敬请期待。如需帮助，请联系客服。
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProfilePage; 