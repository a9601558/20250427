import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useUser } from '../contexts/UserContext';
import { useSocket } from '../contexts/SocketContext';
import { UserProgress, QuestionSet, User } from '../types';
import { userProgressApi } from '../utils/api';

// 定义标签页枚举
enum ProfileTab {
  PROGRESS = 'progress',
  PURCHASES = 'purchases',
  REDEEM_CODES = 'redeemCodes',
  SETTINGS = 'settings'
}

interface ProgressData {
  userId: string;
  questionSetId: string;
  questionSetName: string;
  questionId: string;
  isCorrect: boolean;
  timeSpent: number;
  totalQuestions: number;
  correctAnswers: number;
  totalTimeSpent: number;
  averageTimeSpent: number;
  accuracy: number;
  lastAccessed: string;
  completedQuestions: number;
}

interface ExtendedQuestionSet extends QuestionSet {
  questionCount: number;
}

interface ProgressUpdate {
  userId: string;
  questionSetId: string;
  questionId: string;
  isCorrect: boolean;
  timeSpent: number;
  completedQuestions: number;
  totalQuestions: number;
  correctAnswers: number;
  lastAccessed: string;
}

const ProfilePage: React.FC = () => {
  const { user, logout, updateUserProgress } = useUser();
  const { socket } = useSocket();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'progress' | 'purchases' | 'redeemCodes' | 'settings'>('progress');
  const [questionSets, setQuestionSets] = useState<ExtendedQuestionSet[]>([]);
  const [purchases, setPurchases] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // 添加排序和筛选状态
  const [sortBy, setSortBy] = useState<'purchaseDate' | 'expiryDate' | 'amount'>('purchaseDate');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'expired'>('all');

  const [progress, setProgress] = useState<ProgressData[]>([]);

  const handleProgressUpdate = useCallback((update: ProgressData) => {
    if (!user?.id || update.userId !== user.id) return;
    
    setProgress(prevProgress => {
      const updatedProgress = [...prevProgress];
      const index = updatedProgress.findIndex(p => p.questionSetId === update.questionSetId);
      
      if (index !== -1) {
        updatedProgress[index] = {
          ...updatedProgress[index],
          ...update,
          questionSetName: updatedProgress[index].questionSetName,
          completedQuestions: update.completedQuestions,
          correctAnswers: update.correctAnswers,
          totalQuestions: update.totalQuestions,
          lastAccessed: update.lastAccessed
        };
      } else {
        // 如果是新的进度记录，添加到数组中
        updatedProgress.push({
          ...update,
          questionSetName: questionSets.find(qs => qs.id === update.questionSetId)?.title || ''
        });
      }
      
      return updatedProgress;
    });
  }, [user?.id, questionSets]);

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-4">请先登录</h2>
          <Link
            to="/login"
            className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
          >
            去登录
          </Link>
        </div>
      </div>
    );
  }

  // 加载题库数据
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        // 获取题库列表
        const response = await fetch('http://exam7.jp/api/question-sets', {
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          }
        });
        const data = await response.json();
        if (data.success && data.data) {
          setQuestionSets(data.data);
        } else {
          setError('获取题库数据失败');
        }
      } catch (err) {
        console.error('获取数据失败:', err);
        setError('获取数据失败，请稍后重试');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // 获取用户进度数据
  useEffect(() => {
    const fetchProgress = async () => {
      if (!user?.id) return;
      
      try {
        const response = await userProgressApi.getUserProgress();
        if (response.data) {
          const progressData: ProgressData[] = Object.values(response.data).map((item: any) => ({
            userId: item.userId,
            questionSetId: item.questionSetId,
            questionSetName: item.questionSet?.title || '',
            questionId: item.questionId,
            isCorrect: item.isCorrect,
            timeSpent: item.timeSpent,
            totalQuestions: item.totalQuestions,
            correctAnswers: item.correctAnswers,
            totalTimeSpent: item.totalTimeSpent,
            averageTimeSpent: item.averageTimeSpent,
            accuracy: item.accuracy,
            lastAccessed: item.lastAccessed || new Date().toISOString(),
            completedQuestions: item.completedQuestions
          }));
          setProgress(progressData);
        }
      } catch (error) {
        console.error('Error fetching progress:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchProgress();

    if (socket) {
      const progressHandler = (data: ProgressData) => handleProgressUpdate(data);
      socket.on('progress:update', progressHandler);

      return () => {
        socket.off('progress:update', progressHandler);
      };
    }
  }, [user?.id, socket, handleProgressUpdate]);

  // 获取购买记录
  useEffect(() => {
    const fetchPurchases = async () => {
      if (!user) return;
      
      try {
        setLoading(true);
        setError(null);
        
        const response = await fetch('/api/purchases', {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          }
        });
        
        if (!response.ok) {
          throw new Error('获取购买记录失败');
        }
        
        const data = await response.json();
        if (data.success) {
          setPurchases(data.data);
        } else {
          throw new Error(data.message || '获取购买记录失败');
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : '获取购买记录失败');
      } finally {
        setLoading(false);
      }
    };

    fetchPurchases();
  }, [user]);

  // 整理用户进度数据
  const progressData = questionSets.map(questionSet => {
    const progress = user.progress?.[questionSet.id] || {
      completedQuestions: 0,
      totalQuestions: questionSet.questionCount || 0,
      correctAnswers: 0,
      lastAccessed: new Date().toISOString()
    };
    
    // 计算完成度和正确率
    const completionRate = progress.totalQuestions > 0 
      ? Math.round((progress.completedQuestions / progress.totalQuestions) * 100)
      : 0;
    
    const accuracyRate = progress.completedQuestions > 0
      ? Math.round((progress.correctAnswers / progress.completedQuestions) * 100)
      : 0;
    
    return {
      quizId: questionSet.id,
      quizTitle: questionSet.title,
      category: questionSet.category,
      icon: questionSet.icon || '📝',
      isPaid: questionSet.isPaid,
      price: questionSet.price,
      completedQuestions: progress.completedQuestions,
      totalQuestions: progress.totalQuestions,
      correctAnswers: progress.correctAnswers,
      completionRate,
      accuracyRate,
      lastAccessed: new Date(progress.lastAccessed)
    };
  }).sort((a, b) => b.lastAccessed.getTime() - a.lastAccessed.getTime());

  // 整理用户购买记录
  const purchaseData = purchases.map(purchase => {
    const questionSet = purchase.QuestionSet || {};
    return {
      id: purchase.id || '',
      questionSetId: purchase.questionSetId || '',
      title: questionSet?.title || `题库 ${purchase.questionSetId || '未知'}`,
      category: questionSet?.category || '未知分类',
      icon: questionSet?.icon || '📝',
      amount: purchase.amount || 0,
      purchaseDate: purchase.purchaseDate || new Date().toISOString(),
      expiryDate: purchase.expiryDate || new Date().toISOString(),
      isActive: purchase.expiryDate ? new Date(purchase.expiryDate) > new Date() : false,
      status: purchase.status || '未知'
    };
  });

  // 处理排序和筛选后的购买记录
  const getFilteredAndSortedPurchases = () => {
    let filtered = purchaseData;
    
    // 应用状态筛选
    if (filterStatus !== 'all') {
      filtered = filtered.filter(purchase => 
        filterStatus === 'active' ? purchase.isActive : !purchase.isActive
      );
    }
    
    // 应用排序
    return filtered.sort((a, b) => {
      let comparison = 0;
      if (sortBy === 'purchaseDate' || sortBy === 'expiryDate') {
        comparison = new Date(a[sortBy]).getTime() - new Date(b[sortBy]).getTime();
      } else {
        comparison = a[sortBy] - b[sortBy];
      }
      return sortOrder === 'asc' ? comparison : -comparison;
    });
  };

  // 切换排序
  const handleSort = (field: 'purchaseDate' | 'expiryDate' | 'amount') => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('desc');
    }
  };

  // 处理退出登录
  const handleLogout = () => {
    logout();
    navigate('/');
  };

  // 格式化日期
  const formatDate = (dateString: string | null) => {
    if (!dateString) return '未知';
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
    try {
      const expiryDate = new Date(dateString);
      const today = new Date();
      const diffTime = expiryDate.getTime() - today.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      return diffDays > 0 ? diffDays : 0;
    } catch (e) {
      return 0;
    }
  };

  const calculateStats = (progressData: ProgressData[]) => {
    const totalQuestions = progressData.reduce((sum, progress) => sum + progress.totalQuestions, 0);
    const completedQuestions = progressData.reduce((sum, progress) => sum + progress.completedQuestions, 0);
    const correctAnswers = progressData.reduce((sum, progress) => sum + progress.correctAnswers, 0);
    const accuracy = totalQuestions > 0 ? (correctAnswers / totalQuestions) * 100 : 0;

    return {
      totalQuestions,
      completedQuestions,
      correctAnswers,
      accuracy
    };
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-xl">加载中...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-xl text-red-500">{error}</div>
      </div>
    );
  }

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
                返回主页
              </Link>
              <button
                onClick={handleLogout}
                className="inline-flex items-center px-3 py-1.5 border border-red-300 shadow-sm text-sm font-medium rounded text-red-700 bg-white hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
              >
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
            </button>
          </nav>
        </div>

        {/* 标签页内容 */}
        <div className="bg-white shadow rounded-lg p-6">
          {/* 学习进度标签页 */}
          {activeTab === ProfileTab.PROGRESS && (
            <div className="space-y-6">
              <h2 className="text-2xl font-bold text-gray-900">学习进度</h2>
              
              {progressData.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-gray-500">暂无学习进度记录</p>
                  <Link
                    to="/"
                    className="mt-4 inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
                  >
                    开始学习
                  </Link>
                </div>
              ) : (
                <div className="grid gap-6">
                  {progressData.map((progress) => (
                    <div
                      key={progress.quizId}
                      className="bg-white rounded-lg border border-gray-200 p-6 hover:shadow-md transition-shadow"
                    >
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center space-x-3">
                          <span className="text-2xl">{progress.icon}</span>
                          <div>
                            <h3 className="text-lg font-medium text-gray-900">
                              {progress.quizTitle}
                            </h3>
                            <div className="flex items-center space-x-2">
                              <span className="text-sm text-gray-500">
                                {progress.category}
                              </span>
                              {progress.isPaid && (
                                <span className="px-2 py-1 text-xs rounded-full bg-yellow-100 text-yellow-800">
                                  ¥{progress.price}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        <Link
                          to={`/quiz/${progress.quizId}`}
                          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm font-medium"
                        >
                          继续学习
                        </Link>
                      </div>

                      <div className="space-y-4">
                        {/* 完成度进度条 */}
                        <div>
                          <div className="flex justify-between text-sm mb-1">
                            <span>完成度</span>
                            <span>{progress.completionRate}%</span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-2.5">
                            <div
                              className="bg-blue-600 h-2.5 rounded-full"
                              style={{ width: `${progress.completionRate}%` }}
                            />
                          </div>
                        </div>

                        {/* 正确率进度条 */}
                        <div>
                          <div className="flex justify-between text-sm mb-1">
                            <span>正确率</span>
                            <span>{progress.accuracyRate}%</span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-2.5">
                            <div
                              className="bg-green-600 h-2.5 rounded-full"
                              style={{ width: `${progress.accuracyRate}%` }}
                            />
                          </div>
                        </div>

                        {/* 详细数据 */}
                        <div className="grid grid-cols-3 gap-4 text-sm">
                          <div className="text-center">
                            <div className="text-gray-500">已完成</div>
                            <div className="font-medium">
                              {progress.completedQuestions}/{progress.totalQuestions}
                            </div>
                          </div>
                          <div className="text-center">
                            <div className="text-gray-500">正确数</div>
                            <div className="font-medium">{progress.correctAnswers}</div>
                          </div>
                          <div className="text-center">
                            <div className="text-gray-500">正确率</div>
                            <div className="font-medium">{progress.accuracyRate}%</div>
                          </div>
                        </div>

                        <div className="text-right text-xs text-gray-500">
                          最后学习: {formatDate(progress.lastAccessed.toISOString())}
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
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg leading-6 font-medium text-gray-900">
                  购买记录
                </h3>
                <div className="flex space-x-2">
                  <select
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value as 'all' | 'active' | 'expired')}
                    className="rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                  >
                    <option value="all">全部状态</option>
                    <option value="active">有效</option>
                    <option value="expired">已过期</option>
                  </select>
                </div>
              </div>
              
              {loading ? (
                <div className="flex justify-center items-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                </div>
              ) : error ? (
                <div className="text-center py-10">
                  <div className="text-red-500 mb-4">{error}</div>
                  <button
                    onClick={() => {
                      setError(null);
                      setLoading(true);
                      socket?.emit('purchase:getAll', { userId: user?.id });
                    }}
                    className="text-blue-600 hover:text-blue-800"
                  >
                    重试
                  </button>
                </div>
              ) : getFilteredAndSortedPurchases().length === 0 ? (
                <div className="text-center py-10">
                  <h3 className="mt-2 text-sm font-medium text-gray-900">暂无购买记录</h3>
                  <p className="mt-1 text-sm text-gray-500">浏览并购买题库以获取完整内容</p>
                  <div className="mt-6">
                    <Link
                      to="/"
                      className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
                    >
                      浏览题库
                    </Link>
                  </div>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <div className="min-w-full divide-y divide-gray-200">
                    <table className="min-w-full">
                      <thead className="bg-gray-50">
                        <tr>
                          <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            题库信息
                          </th>
                          <th 
                            scope="col" 
                            className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                            onClick={() => handleSort('amount')}
                          >
                            金额 {sortBy === 'amount' && (sortOrder === 'asc' ? '↑' : '↓')}
                          </th>
                          <th 
                            scope="col" 
                            className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                            onClick={() => handleSort('purchaseDate')}
                          >
                            购买日期 {sortBy === 'purchaseDate' && (sortOrder === 'asc' ? '↑' : '↓')}
                          </th>
                          <th 
                            scope="col" 
                            className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                            onClick={() => handleSort('expiryDate')}
                          >
                            过期日期 {sortBy === 'expiryDate' && (sortOrder === 'asc' ? '↑' : '↓')}
                          </th>
                          <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            状态
                          </th>
                          <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                            操作
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {getFilteredAndSortedPurchases().map((purchase) => (
                          <tr key={purchase.id} className="hover:bg-gray-50">
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
                              <div className="text-sm text-gray-900">¥{purchase.amount.toFixed(2)}</div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="text-sm text-gray-500">{formatDate(purchase.purchaseDate)}</div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="text-sm text-gray-500">{formatDate(purchase.expiryDate)}</div>
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
                                </div>
                              ) : (
                                <span className="px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-red-100 text-red-800">
                                  已过期
                                </span>
                              )}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                              {purchase.isActive ? (
                                <Link
                                  to={`/quiz/${purchase.questionSetId}`}
                                  className="text-blue-600 hover:text-blue-900"
                                >
                                  开始学习
                                </Link>
                              ) : (
                                <span className="text-gray-400">已过期</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProfilePage; 