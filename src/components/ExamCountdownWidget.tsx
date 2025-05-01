import React, { useState, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';

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
  const [countdowns, setCountdowns] = useState<CountdownItem[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newExam, setNewExam] = useState<Omit<CountdownItem, 'id'>>({
    examType: '',
    examCode: '',
    examDate: new Date().toISOString().split('T')[0]
  });
  const [examTypes, setExamTypes] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);

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

  // 从 localStorage 加载倒计时数据
  useEffect(() => {
    const loadCountdowns = () => {
      try {
        const savedCountdowns = localStorage.getItem('examCountdowns');
        if (savedCountdowns) {
          let countdownList = JSON.parse(savedCountdowns) as CountdownItem[];
          
          // 过滤掉已过期的考试
          const now = new Date();
          countdownList = countdownList.filter(item => {
            const examDate = new Date(item.examDate);
            return examDate > now;
          });
          
          // 按日期排序，最近的考试排在前面
          countdownList.sort((a, b) => new Date(a.examDate).getTime() - new Date(b.examDate).getTime());
          
          // 最多显示3条
          countdownList = countdownList.slice(0, 3);
          
          setCountdowns(countdownList);
          
          // 更新存储，移除过期考试
          localStorage.setItem('examCountdowns', JSON.stringify(countdownList));
        }
      } catch (error) {
        console.error('加载考试倒计时数据失败:', error);
      }
    };
    
    loadCountdowns();
    
    // 每天自动检查过期考试
    const intervalId = setInterval(loadCountdowns, 86400000); // 24小时
    
    return () => clearInterval(intervalId);
  }, []);

  // 保存数据到 localStorage
  const saveCountdowns = (data: CountdownItem[]) => {
    try {
      localStorage.setItem('examCountdowns', JSON.stringify(data));
    } catch (error) {
      console.error('保存考试倒计时数据失败:', error);
    }
  };

  // 添加新考试
  const handleAddExam = () => {
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
      ...newExam
    };
    
    const updatedCountdowns = [...countdowns, newCountdown];
    
    // 按日期排序
    updatedCountdowns.sort((a, b) => new Date(a.examDate).getTime() - new Date(b.examDate).getTime());
    
    setCountdowns(updatedCountdowns);
    saveCountdowns(updatedCountdowns);
    
    // 重置表单
    setNewExam({
      examType: '',
      examCode: '',
      examDate: new Date().toISOString().split('T')[0]
    });
    setShowAddForm(false);
  };

  // 删除考试倒计时
  const handleDeleteExam = (id: string) => {
    const updatedCountdowns = countdowns.filter(item => item.id !== id);
    setCountdowns(updatedCountdowns);
    saveCountdowns(updatedCountdowns);
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
                {examTypes.map(type => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setNewExam({...newExam, examType: type})}
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
                onChange={(e) => setNewExam({...newExam, examType: e.target.value})}
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
                onChange={(e) => setNewExam({...newExam, examCode: e.target.value})}
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
                onChange={(e) => setNewExam({...newExam, examDate: e.target.value})}
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
              >
                取消
              </button>
              <button
                type="button"
                onClick={handleAddExam}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-md"
              >
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
            >
              <svg className="h-4 w-4 mr-1" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              添加考试倒计时
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default ExamCountdownWidget; 