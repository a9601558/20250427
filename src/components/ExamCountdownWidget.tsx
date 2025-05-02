import React, { useState, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { useUser } from '../contexts/UserContext';
import { userService } from '../services/api';

export interface CountdownItem {
  id: string;
  examType: string;
  examCode: string;
  examDate: string; // ISO 格式
}

interface ExamCountdownWidgetProps {
  theme?: 'light' | 'dark';
}

const ExamCountdownWidget: React.FC<ExamCountdownWidgetProps> = ({ theme = 'light' }) => {
  const { user } = useUser();
  const [countdowns, setCountdowns] = useState<CountdownItem[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newExam, setNewExam] = useState<Omit<CountdownItem, 'id'>>({
    examType: '',
    examCode: '',
    examDate: new Date().toISOString().split('T')[0],
  });
  const [examTypes, setExamTypes] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // 加载考试类型列表（可从后端获取）
  useEffect(() => {
    // 示例考试类型，实际项目中可以通过API获取
    const defaultExamTypes = ['日语能力考试', '托福考试', '雅思考试', 'CET-4/6', '计算机等级考试', '其他'];
    
    // 实际项目中，可以通过API获取考试类型
    // const fetchExamTypes = async () => {
    //   try {
    //     const response = await apiClient.get('/api/exam-types');
    //     if (response.success) {
    //       setExamTypes(response.data);
    //     } else {
    //       setExamTypes(defaultExamTypes);
    //     }
    //   } catch (error) {
    //     console.error('获取考试类型失败:', error);
    //     setExamTypes(defaultExamTypes);
    //   }
    // };
    
    // fetchExamTypes();
    
    // 使用默认考试类型
    setExamTypes(defaultExamTypes);
  }, []);

  // 修改加载倒计时数据逻辑，确保本地删除操作不被服务器覆盖
  useEffect(() => {
    const loadCountdowns = async () => {
      setIsLoading(true);
      try {
        // 先从localStorage加载数据作为基础
        let localCountdowns: CountdownItem[] = [];
        let serverCountdowns: CountdownItem[] = [];
        let hasLocalData = false;
        
        try {
          const savedCountdowns = localStorage.getItem('examCountdowns');
          if (savedCountdowns) {
            localCountdowns = JSON.parse(savedCountdowns);
            hasLocalData = localCountdowns.length > 0;
            console.log('从本地存储加载考试倒计时数据', localCountdowns);
          }
        } catch (e) {
          console.error('解析本地倒计时数据失败:', e);
        }
        
        // 如果用户已登录，从用户资料获取服务器数据
        if (user && user.id) {
          console.log('从服务器加载考试倒计时数据');
          const response = await userService.getCurrentUser();
          
          if (response.success && response.data) {
            // 从用户资料中获取倒计时数据
            if (response.data.examCountdowns) {
              try {
                // 可能存储为JSON字符串或直接作为数组对象
                if (typeof response.data.examCountdowns === 'string') {
                  serverCountdowns = JSON.parse(response.data.examCountdowns);
                } else if (Array.isArray(response.data.examCountdowns)) {
                  serverCountdowns = response.data.examCountdowns;
                }
                console.log('从服务器成功加载考试倒计时数据', serverCountdowns);
              } catch (e) {
                console.error('解析服务器倒计时数据失败:', e);
              }
            }
          }
        }
        
        // 合并数据策略：
        // 1. 如果本地有数据，优先使用本地数据(因为可能包含最近的删除操作)
        // 2. 如果本地无数据，使用服务器数据
        // 3. 如果两者都有数据，根据ID合并(保留本地删除状态)
        let mergedCountdowns: CountdownItem[] = [];
        
        if (hasLocalData) {
          if (serverCountdowns.length > 0) {
            // 复杂合并逻辑 - 保留本地删除状态
            // 提取所有本地和服务器数据的ID
            const localIds = new Set(localCountdowns.map((item) => item.id));
            const serverIds = new Set(serverCountdowns.map((item) => item.id));
            
            // 如果服务器有本地没有的ID，可能是从其他设备添加的，需要保留
            for (const countdown of serverCountdowns) {
              if (!localIds.has(countdown.id)) {
                mergedCountdowns.push(countdown);
              }
            }
            
            // 添加所有本地数据
            mergedCountdowns = [...mergedCountdowns, ...localCountdowns];
          } else {
            // 如果服务器无数据，直接使用本地数据
            mergedCountdowns = localCountdowns;
          }
        } else {
          // 本地无数据，使用服务器数据
          mergedCountdowns = serverCountdowns;
        }
        
        // 过滤掉已过期的考试
        const now = new Date();
        mergedCountdowns = (mergedCountdowns || []).filter((item) => {
          const examDate = new Date(item.examDate);
          return examDate > now;
        });
        
        // 按日期排序，最近的考试排在前面
        mergedCountdowns.sort((a, b) => new Date(a.examDate).getTime() - new Date(b.examDate).getTime());
        
        // 最多显示3条
        mergedCountdowns = mergedCountdowns.slice(0, 3);
        
        setCountdowns(mergedCountdowns);
        
        // 仅当合并后的数据与本地/服务器数据不同时，才保存更新
        const needsUpdate = JSON.stringify(mergedCountdowns) !== JSON.stringify(localCountdowns) ||
                           JSON.stringify(mergedCountdowns) !== JSON.stringify(serverCountdowns);
        
        if (needsUpdate) {
          console.log('数据已合并，保存更新的数据');
          saveCountdowns(mergedCountdowns);
        }
      } catch (error) {
        console.error('加载考试倒计时数据失败:', error);
      } finally {
        setIsLoading(false);
      }
    };
    
    loadCountdowns();
    
    // 每天自动检查过期考试
    const intervalId = setInterval(loadCountdowns, 86400000); // 24小时
    
    return () => clearInterval(intervalId);
  }, [user?.id]);

  // 保存数据到 localStorage 和服务器
  const saveCountdowns = async (data: CountdownItem[]) => {
    setIsSaving(true);
    try {
      // 保存到localStorage作为本地备份
      localStorage.setItem('examCountdowns', JSON.stringify(data));
      
      // 如果用户已登录，同时保存到服务器
      if (user && user.id) {
        console.log('保存考试倒计时数据到服务器');
        
        // 准备要更新的用户数据 - 确保数据已转换为字符串
        const examCountdownsJson = JSON.stringify(data);
        console.log('保存的数据:', examCountdownsJson);
        
        const userData = {
          examCountdowns: examCountdownsJson,
        };
        
        // 调用更新用户API
        const response = await userService.updateUser(user.id, userData);
        
        if (response.success) {
          console.log('考试倒计时数据已成功保存到服务器');
        } else {
          console.error('保存考试倒计时到服务器失败:', response.message);
          throw new Error(response.message || '保存到服务器失败');
        }
      }
    } catch (error) {
      console.error('保存考试倒计时数据失败:', error);
      // 在保存失败时显示提示
      alert('保存倒计时数据失败，可能影响跨设备同步');
      return false;
    } finally {
      setIsSaving(false);
    }
    return true;
  };

  // 添加新考试
  const handleAddExam = async () => {
    if (!newExam.examType || !newExam.examCode || !newExam.examDate) {
      alert('请填写完整考试信息');
      return;
    }
    
    // 检查日期是否有效
    const examDate = new Date(newExam.examDate);
    const now = new Date();
    
    if (examDate < now) {
      alert('考试日期不能早于今天');
      return;
    }
    
    // 限制最多3条记录
    if (countdowns.length >= 3) {
      alert('最多只能添加3条考试倒计时');
      return;
    }
    
    const newCountdown: CountdownItem = {
      id: uuidv4(),
      ...newExam,
    };
    
    const updatedCountdowns = [...countdowns, newCountdown];
    
    // 按日期排序
    updatedCountdowns.sort((a, b) => new Date(a.examDate).getTime() - new Date(b.examDate).getTime());
    
    setCountdowns(updatedCountdowns);
    await saveCountdowns(updatedCountdowns);
    
    // 重置表单
    setNewExam({
      examType: '',
      examCode: '',
      examDate: new Date().toISOString().split('T')[0],
    });
    setShowAddForm(false);
  };

  // 删除考试倒计时 - 修复跨设备同步问题
  const handleDeleteExam = async (id: string) => {
    // 防止同时重复点击
    if (isSaving) return;
    
    try {
      setIsSaving(true);
      console.log(`正在删除考试倒计时，ID: ${id}`);
      
      // 过滤删除项目
      const updatedCountdowns = countdowns.filter((item) => item.id !== id);
      
      // 1. 立即更新UI状态
      setCountdowns(updatedCountdowns);
      
      // 2. 强制保存到LocalStorage
      localStorage.setItem('examCountdowns', JSON.stringify(updatedCountdowns));
      
      // 3. 如果用户已登录，保存到服务器
      if (user && user.id) {
        console.log('正在同步删除操作到服务器');
        
        // 准备要更新的用户数据，确保stringfy
        const userData = {
          examCountdowns: JSON.stringify(updatedCountdowns),
        };
        
        try {
          // 调用API保存到服务器
          const response = await userService.updateUser(user.id, userData);
          
          if (response.success) {
            console.log('考试倒计时删除操作已同步到服务器');
          } else {
            console.error('同步删除操作到服务器失败:', response.message);
            throw new Error(response.message);
          }
        } catch (serverError) {
          console.error('向服务器同步删除操作时出错:', serverError);
          // 提醒用户删除操作未同步到云端
          alert('删除操作未能同步到云端，请刷新页面重试。');
        }
      }
    } catch (error) {
      console.error('删除考试倒计时失败:', error);
      alert('删除操作失败，请重试');
      // 删除失败，恢复原状态
      setCountdowns([...countdowns]);
    } finally {
      setIsSaving(false);
    }
  };

  // 计算剩余天数
  const getRemainingDays = (dateString: string): number => {
    const examDate = new Date(dateString);
    const now = new Date();
    
    // 将两个日期都设置为当天的00:00:00，仅比较日期部分
    examDate.setHours(0, 0, 0, 0);
    now.setHours(0, 0, 0, 0);
    
    const diffTime = examDate.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    return diffDays;
  };

  // 显示加载指示器
  if (isLoading) {
    return (
      <div className={`mb-8 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-600'}`}>
        <div className="text-center py-4">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500 mx-auto"></div>
          <p className="mt-2 text-sm">正在加载倒计时数据...</p>
        </div>
      </div>
    );
  }

  // 检查是否有倒计时数据
  if (countdowns.length === 0 && !showAddForm) {
    return (
      <div className={`mb-8 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-600'}`}>
        <div className="text-center">
          <button
            onClick={() => setShowAddForm(true)}
            className={`px-4 py-2 rounded-md ${theme === 'dark' ? 'bg-gray-700 hover:bg-gray-600' : 'bg-gray-200 hover:bg-gray-300'} text-sm flex items-center mx-auto`}
          >
            <svg className="h-4 w-4 mr-1" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            添加考试倒计时
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`mb-8 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-600'}`}>
      {/* 倒计时列表 */}
      <div className="space-y-2 mb-4">
        {countdowns.map((countdown, index) => {
          const remainingDays = getRemainingDays(countdown.examDate);
          const isFirst = index === 0;
          
          return (
            <div 
              key={countdown.id}
              className={`rounded-lg p-3 ${
                isFirst 
                  ? `${theme === 'dark' ? 'bg-indigo-900' : 'bg-indigo-50'} border ${theme === 'dark' ? 'border-indigo-800' : 'border-indigo-100'}`
                  : `${theme === 'dark' ? 'bg-gray-800' : 'bg-gray-50'} border ${theme === 'dark' ? 'border-gray-700' : 'border-gray-200'}`
              } flex justify-between items-center`}
            >
              <div className={isFirst ? 'font-medium' : ''}>
                <div className={`flex items-center ${isFirst ? 'text-lg' : 'text-base'}`}>
                  <span className="mr-2">📅</span>
                  <span>
                    距离 <span className={`${theme === 'dark' ? 'text-indigo-300' : 'text-indigo-600'} font-semibold`}>
                      {countdown.examType} - {countdown.examCode}
                    </span> 还有 <span className={`${theme === 'dark' ? 'text-yellow-300' : 'text-yellow-600'} font-bold`}>
                      {remainingDays}
                    </span> 天
                  </span>
                </div>
                <div className="text-xs mt-1 ml-6 text-gray-500">
                  考试日期: {new Date(countdown.examDate).toLocaleDateString('zh-CN')}
                </div>
              </div>
              <button 
                onClick={() => handleDeleteExam(countdown.id)}
                className={`p-1 rounded-full ${theme === 'dark' ? 'hover:bg-gray-700' : 'hover:bg-gray-200'}`}
                title="删除"
                aria-label="删除考试倒计时"
                disabled={isSaving}
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          );
        })}
      </div>
      
      {/* 添加考试表单 */}
      {showAddForm ? (
        <div className={`rounded-lg p-4 ${theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} border mb-4`}>
          <h3 className={`text-lg font-medium mb-3 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>添加考试倒计时</h3>
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium mb-1">考试类型</label>
              <div className="flex flex-wrap gap-2 mb-2">
                {examTypes.map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setNewExam({ ...newExam, examType: type })}
                    className={`px-3 py-1 text-sm rounded-full ${
                      newExam.examType === type
                        ? 'bg-blue-600 text-white'
                        : `${theme === 'dark' ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`
                    }`}
                  >
                    {type}
                  </button>
                ))}
              </div>
              <input
                type="text"
                value={newExam.examType}
                onChange={(e) => setNewExam({ ...newExam, examType: e.target.value })}
                placeholder="输入考试类型"
                className={`w-full px-3 py-2 border rounded-md ${
                  theme === 'dark' 
                    ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' 
                    : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400'
                }`}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">考试编号</label>
              <input
                type="text"
                value={newExam.examCode}
                onChange={(e) => setNewExam({ ...newExam, examCode: e.target.value })}
                placeholder="如：2025年第1回"
                className={`w-full px-3 py-2 border rounded-md ${
                  theme === 'dark' 
                    ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' 
                    : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400'
                }`}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">考试日期</label>
              <input
                type="date"
                value={newExam.examDate}
                onChange={(e) => setNewExam({ ...newExam, examDate: e.target.value })}
                className={`w-full px-3 py-2 border rounded-md ${
                  theme === 'dark' 
                    ? 'bg-gray-700 border-gray-600 text-white' 
                    : 'bg-white border-gray-300 text-gray-900'
                }`}
              />
            </div>
            <div className="flex justify-end space-x-2 pt-2">
              <button
                type="button"
                onClick={() => setShowAddForm(false)}
                className={`px-4 py-2 text-sm rounded-md ${
                  theme === 'dark' 
                    ? 'bg-gray-700 hover:bg-gray-600 text-white' 
                    : 'bg-gray-200 hover:bg-gray-300 text-gray-800'
                }`}
                disabled={isSaving}
              >
                取消
              </button>
              <button
                type="button"
                onClick={handleAddExam}
                className={`px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-md flex items-center ${isSaving ? 'opacity-70 cursor-not-allowed' : ''}`}
                disabled={isSaving}
              >
                {isSaving && (
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                )}
                添加
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="text-center">
          {countdowns.length < 3 && (
            <button
              onClick={() => setShowAddForm(true)}
              className={`px-4 py-2 rounded-md ${theme === 'dark' ? 'bg-gray-700 hover:bg-gray-600' : 'bg-gray-200 hover:bg-gray-300'} text-sm flex items-center mx-auto`}
              disabled={isSaving}
            >
              <svg className="h-4 w-4 mr-1" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              添加考试倒计时
            </button>
          )}
        </div>
      )}
      
      {/* 添加同步状态提示 */}
      {(isLoading || isSaving) && (
        <div className={`text-center text-xs mt-2 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>
          {isLoading ? '正在同步数据...' : '正在保存到云端...'}
        </div>
      )}
      
      {/* 显示设备同步提示 */}
      {user && user.id && (
        <div className={`text-center text-xs mt-2 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>
          已同步到云端，可在其他设备查看
        </div>
      )}
    </div>
  );
};

export default ExamCountdownWidget; 
