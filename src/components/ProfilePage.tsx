import React, { useEffect, useState, useCallback } from 'react';
import { useUser } from '../contexts/UserContext';
import { useSocket } from '../contexts/SocketContext';
import { toast } from 'react-toastify';
import { userProgressService, questionSetService, purchaseService } from '../services/api';
import { useNavigate } from 'react-router-dom';
import PurchaseCenter from './PurchaseCenter';

// 原始进度记录类型
interface ProgressRecord {
  id: string;
  questionSetId: string;
  questionId: string;
  isCorrect: boolean;
  timeSpent: number;
  createdAt?: Date;
  progressQuestionSet?: {
    id: string;
    title: string;
  };
}

// 进度统计类型
interface ProgressStats {
  questionSetId: string;
  title: string;
  completedQuestions: number;
  correctAnswers: number;
  totalTimeSpent: number;
  averageTimeSpent: number;
  accuracy: number;
  answeredQuestions?: {
    questionId: string;
    selectedOptionId: string;
    isCorrect: boolean;
  }[];
}

// 题库信息
interface QuestionSet {
    id: string;
    title: string;
}

// 购买记录类型
interface Purchase {
  id: string;
  userId?: string;
  questionSetId: string;
  purchaseDate: string;
  expiryDate: string;
  amount: number;
  status?: string;
  paymentMethod?: string;
  transactionId?: string;
  purchaseQuestionSet?: {
    id: string;
    title: string;
    description?: string;
  };
  // 兼容性字段 - 后端可能返回的字段
  questionSet?: {
    id: string;
    title: string;
    description?: string;
  };
}

// 兑换记录类型
interface RedeemRecord {
  id: string;
  userId?: string;
  code: string;
  questionSetId: string;
  usedAt: string;
  expiryDate: string;
  redeemQuestionSet?: {
    id: string;
    title: string;
    description?: string;
  };
}

const formatTime = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
};

const formatDate = (dateString: string): string => {
  const date = new Date(dateString);
  return date.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
};

interface ProgressCardProps {
  stats: ProgressStats;
}

const ProgressCard: React.FC<ProgressCardProps> = ({ stats }) => {
  const navigate = useNavigate();

  return (
    <div 
      className="bg-white p-5 rounded-lg shadow-md hover:shadow-lg transition-shadow duration-300 cursor-pointer"
      onClick={() => navigate(`/quiz/${stats.questionSetId}`)}
    >
      <h2 className="text-lg font-semibold mb-3 text-blue-700 truncate">{stats.title}</h2>
      <div className="space-y-3">
        <div className="flex justify-between items-center">
          <span className="text-sm text-gray-600">已答题目:</span>
          <span className="font-medium">{stats.completedQuestions}</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-sm text-gray-600">正确答案:</span>
          <span className="font-medium">{stats.correctAnswers}</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-sm text-gray-600">正确率:</span>
          <span className="font-medium">{stats.accuracy.toFixed(1)}%</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-sm text-gray-600">平均答题时间:</span>
          <span className="font-medium">{formatTime(stats.averageTimeSpent)}</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-sm text-gray-600">总学习时间:</span>
          <span className="font-medium">{formatTime(stats.totalTimeSpent)}</span>
        </div>
        <div className="mt-4 pt-3 border-t border-gray-100">
          <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
            <div 
              className="h-full bg-green-500 rounded-full" 
              style={{ width: `${stats.accuracy}%` }}
            ></div>
          </div>
          <p className="text-xs text-gray-500 mt-1 text-right">正确率</p>
        </div>
      </div>
    </div>
  );
};

// 购买记录卡片组件
interface PurchaseCardProps {
  purchase: Purchase;
}

const PurchaseCard: React.FC<PurchaseCardProps> = ({ purchase }) => {
  const navigate = useNavigate();
  const expiryDate = new Date(purchase.expiryDate);
  const now = new Date();
  const isExpired = expiryDate < now;
  
  // 计算剩余天数
  const remainingDays = Math.ceil((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  
  // 获取题库标题
  const title = purchase.purchaseQuestionSet?.title || '未知题库';
  
  return (
    <div className="bg-white p-5 rounded-lg shadow-md hover:shadow-lg transition-shadow duration-300">
      <div className="flex justify-between items-start mb-4">
        <h2 className="text-lg font-semibold text-blue-700 truncate">{title}</h2>
        {isExpired ? (
          <span className="px-2 py-1 text-xs font-medium bg-red-100 text-red-800 rounded-full">已过期</span>
        ) : (
          <span className="px-2 py-1 text-xs font-medium bg-green-100 text-green-800 rounded-full">有效</span>
        )}
      </div>
      
      <div className="space-y-2">
        <div className="flex justify-between items-center">
          <span className="text-sm text-gray-600">购买日期:</span>
          <span className="text-sm font-medium">{formatDate(purchase.purchaseDate)}</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-sm text-gray-600">到期日期:</span>
          <span className="text-sm font-medium">{formatDate(purchase.expiryDate)}</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-sm text-gray-600">支付金额:</span>
          <span className="text-sm font-medium">¥{purchase.amount.toFixed(2)}</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-sm text-gray-600">支付方式:</span>
          <span className="text-sm font-medium">{purchase.paymentMethod || '未知'}</span>
        </div>
        
        {!isExpired && (
          <div className="flex justify-between items-center mt-2">
            <span className="text-sm text-gray-600">剩余天数:</span>
            <span className="text-sm font-medium text-green-600">{remainingDays} 天</span>
          </div>
        )}
      </div>
      
      <div className="mt-4 pt-4 border-t border-gray-100">
        <button
          onClick={() => navigate(`/quiz/${purchase.questionSetId}`)}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-md transition-colors"
        >
          开始学习
        </button>
      </div>
    </div>
  );
};

// 兑换记录卡片组件
interface RedeemCardProps {
  redeem: RedeemRecord;
}

const RedeemCard: React.FC<RedeemCardProps> = ({ redeem }) => {
  const navigate = useNavigate();
  const expiryDate = new Date(redeem.expiryDate);
  const now = new Date();
  const isExpired = expiryDate < now;
  
  // 计算剩余天数
  const remainingDays = Math.ceil((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  
  // 获取题库标题
  const title = redeem.redeemQuestionSet?.title || '未知题库';
  
  return (
    <div className="bg-white p-5 rounded-lg shadow-md hover:shadow-lg transition-shadow duration-300">
      <div className="flex justify-between items-start mb-4">
        <h2 className="text-lg font-semibold text-blue-700 truncate">{title}</h2>
        {isExpired ? (
          <span className="px-2 py-1 text-xs font-medium bg-red-100 text-red-800 rounded-full">已过期</span>
        ) : (
          <span className="px-2 py-1 text-xs font-medium bg-green-100 text-green-800 rounded-full">有效</span>
        )}
      </div>
      
      <div className="space-y-2">
        <div className="flex justify-between items-center">
          <span className="text-sm text-gray-600">兑换日期:</span>
          <span className="text-sm font-medium">{formatDate(redeem.usedAt)}</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-sm text-gray-600">到期日期:</span>
          <span className="text-sm font-medium">{formatDate(redeem.expiryDate)}</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-sm text-gray-600">兑换码:</span>
          <span className="text-sm font-medium">{redeem.code.substring(0, 4)}****</span>
        </div>
        
        {!isExpired && (
          <div className="flex justify-between items-center mt-2">
            <span className="text-sm text-gray-600">剩余天数:</span>
            <span className="text-sm font-medium text-green-600">{remainingDays} 天</span>
          </div>
        )}
      </div>
      
      <div className="mt-4 pt-4 border-t border-gray-100">
        <button
          onClick={() => navigate(`/quiz/${redeem.questionSetId}`)}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-md transition-colors"
        >
          开始学习
        </button>
      </div>
    </div>
  );
};

const ProfilePage: React.FC = () => {
  const { user } = useUser();
  const { socket } = useSocket();
  const [progressStats, setProgressStats] = useState<ProgressStats[]>([]);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [redeemCodes, setRedeemCodes] = useState<RedeemRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [purchasesLoading, setPurchasesLoading] = useState(true);
  const [redeemCodesLoading, setRedeemCodesLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'progress' | 'purchases' | 'redeemed'>('progress');
  const navigate = useNavigate();

  // 在前端计算进度统计
  const calculateProgressStats = useCallback((records: ProgressRecord[], questionSets: Map<string, QuestionSet>) => {
    // 按题库ID分组
    const progressMap = new Map<string, Map<string, ProgressRecord>>();
    
    // 处理每条记录，按题库和题目分组，保留最后一次作答
    records.forEach(record => {
      const qsId = record.questionSetId;
      const qId = record.questionId;
      
      if (!progressMap.has(qsId)) {
        progressMap.set(qsId, new Map<string, ProgressRecord>());
      }
      
      const questionMap = progressMap.get(qsId)!;
      
      // 如果题目不存在或当前记录更新，则更新记录
      if (!questionMap.has(qId) || 
          (record.createdAt && questionMap.get(qId)!.createdAt && 
           new Date(record.createdAt) > new Date(questionMap.get(qId)!.createdAt!))) {
        questionMap.set(qId, record);
      }
    });
    
    // 生成最终统计结果
    const stats: ProgressStats[] = [];
    
    progressMap.forEach((questionMap, questionSetId) => {
      // 只处理有作答记录的题库
      if (questionMap.size > 0) {
        // 获取该题库的所有最终记录
        const finalRecords = Array.from(questionMap.values());
        
        // 统计数据
        const completedQuestions = finalRecords.length;
        const correctAnswers = finalRecords.filter(r => r.isCorrect).length;
        const totalTimeSpent = finalRecords.reduce((sum, r) => sum + r.timeSpent, 0);
        const averageTimeSpent = completedQuestions > 0 ? totalTimeSpent / completedQuestions : 0;
        const accuracy = Math.min(100, (correctAnswers / completedQuestions) * 100);
        
        // 获取题库标题
        const title = questionSets.get(questionSetId)?.title || 
                     finalRecords[0]?.progressQuestionSet?.title || 
                     'Unknown Set';
        
        stats.push({
          questionSetId,
          title,
          completedQuestions,
          correctAnswers,
          totalTimeSpent,
          averageTimeSpent,
          accuracy
        });
      }
    });
    
    return stats;
  }, []);

  // 处理实时进度更新
  const handleProgressUpdate = useCallback(async () => {
    try {
      setIsLoading(true);
      
      const questionSetsResponse = await questionSetService.getAllQuestionSets();
      const questionSetsMap = new Map<string, QuestionSet>();
      
      if (questionSetsResponse.success && questionSetsResponse.data) {
        questionSetsResponse.data.forEach(qs => {
          questionSetsMap.set(qs.id, { id: qs.id, title: qs.title });
        });
      }
      
      const progressResponse = await userProgressService.getUserProgressRecords();
      
      if (progressResponse.success && progressResponse.data) {
        const stats = calculateProgressStats(progressResponse.data, questionSetsMap);
        setProgressStats(stats);
      } else {
        throw new Error(progressResponse.message || 'Failed to fetch progress');
      }
    } catch (error) {
      toast.error('获取学习进度失败');
      console.error('[ProfilePage] Error fetching progress:', error);
    } finally {
      setIsLoading(false);
    }
  }, [calculateProgressStats]);

  // 获取用户购买数据
  const fetchPurchases = useCallback(async () => {
    if (!user) return;
    
    try {
      setPurchasesLoading(true);
      const response = await purchaseService.getUserPurchases();
      
      if (response.success && response.data) {
        // 确保返回的数据格式正确
        const validPurchases = response.data
          .filter((p: any) => p && p.questionSetId) // 过滤掉无效记录
          .map((p: any) => {
            // 确保必需字段
            const purchase: Purchase = {
              id: p.id || '', // 确保id为字符串
              questionSetId: p.questionSetId,
              purchaseDate: p.purchaseDate,
              expiryDate: p.expiryDate,
              amount: typeof p.amount === 'string' ? parseFloat(p.amount) : (p.amount || 0), // 确保amount是数字
              status: p.status,
              paymentMethod: p.paymentMethod,
              transactionId: p.transactionId,
              // 处理关联数据兼容性问题
              purchaseQuestionSet: p.purchaseQuestionSet || 
                (p.questionSet ? { 
                  id: p.questionSet.id, 
                  title: p.questionSet.title,
                  description: p.questionSet.description
                } : undefined)
            };
            return purchase;
          });
        
        setPurchases(validPurchases);
      } else {
        throw new Error(response.message || '获取购买记录失败');
      }
    } catch (error) {
      toast.error('获取购买记录失败');
      console.error('[ProfilePage] Error fetching purchases:', error);
    } finally {
      setPurchasesLoading(false);
    }
  }, [user]);

  // 获取兑换码数据
  const fetchRedeemCodes = useCallback(async () => {
    if (!user) return;
    
    try {
      setRedeemCodesLoading(true);
      const response = await purchaseService.getUserRedeemCodes();
      
      if (response.success && response.data) {
        const validRedeemCodes = response.data
          .filter((r: any) => r && r.questionSetId)
          .map((r: any) => {
            const redeemRecord: RedeemRecord = {
              id: r.id || '',
              code: r.code,
              questionSetId: r.questionSetId,
              usedAt: r.usedAt || r.createdAt,
              expiryDate: r.expiryDate,
              redeemQuestionSet: r.redeemQuestionSet || 
                (r.questionSet ? { 
                  id: r.questionSet.id, 
                  title: r.questionSet.title,
                  description: r.questionSet.description
                } : undefined)
            };
            return redeemRecord;
          });
        
        setRedeemCodes(validRedeemCodes);
      } else {
        throw new Error(response.message || '获取兑换记录失败');
      }
    } catch (error) {
      toast.error('获取兑换记录失败');
      console.error('[ProfilePage] Error fetching redeem codes:', error);
    } finally {
      setRedeemCodesLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (!socket || !user) return;

    // 初始加载数据
    handleProgressUpdate();
    fetchPurchases();
    fetchRedeemCodes();

    // 监听实时更新
    socket.on('progress:update', handleProgressUpdate);
    socket.on('purchase:success', fetchPurchases);
    socket.on('redeem:success', fetchRedeemCodes);

    return () => {
      socket.off('progress:update', handleProgressUpdate);
      socket.off('purchase:success', fetchPurchases);
      socket.off('redeem:success', fetchRedeemCodes);
    };
  }, [socket, user, handleProgressUpdate, fetchPurchases, fetchRedeemCodes]);

  // 切换标签页
  const handleTabChange = (tab: 'progress' | 'purchases' | 'redeemed') => {
    setActiveTab(tab);
  };

  // 渲染标签页
  const renderTabs = () => {
    return (
      <div className="mb-6 border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => handleTabChange('progress')}
            className={`
              py-4 px-1 border-b-2 font-medium text-sm
              ${activeTab === 'progress'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}
            `}
          >
            学习进度
          </button>
          <button
            onClick={() => handleTabChange('purchases')}
            className={`
              py-4 px-1 border-b-2 font-medium text-sm
              ${activeTab === 'purchases'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}
            `}
          >
            我的购买
          </button>
          <button
            onClick={() => handleTabChange('redeemed')}
            className={`
              py-4 px-1 border-b-2 font-medium text-sm
              ${activeTab === 'redeemed'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}
            `}
          >
            已兑换的
          </button>
        </nav>
      </div>
    );
  };

  // 渲染进度内容
  const renderProgressContent = () => {
    if (isLoading) {
      return (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
        </div>
      );
    }

    if (progressStats.length === 0) {
      return (
        <div className="bg-white p-6 rounded-lg shadow text-center">
          <p className="text-gray-600 mb-4">🎯 你还没有开始答题，点击这里开始练习！</p>
          <button
            onClick={() => navigate('/')}
            className="bg-blue-500 hover:bg-blue-600 text-white font-medium py-2 px-4 rounded-lg transition-colors duration-200"
          >
            开始练习
          </button>
        </div>
      );
    }

    return (
      <div className="grid gap-6 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
        {progressStats.map((stats) => (
          <ProgressCard key={stats.questionSetId} stats={stats} />
        ))}
      </div>
    );
  };

  // 渲染购买内容
  const renderPurchasesContent = () => {
    if (purchasesLoading) {
      return (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
        </div>
      );
    }

    if (purchases.length === 0) {
      return (
        <div className="bg-white p-6 rounded-lg shadow text-center">
          <p className="text-gray-600 mb-4">🛍️ 您还没有购买任何题库</p>
          <button
            onClick={() => navigate('/')}
            className="bg-blue-500 hover:bg-blue-600 text-white font-medium py-2 px-4 rounded-lg transition-colors duration-200"
          >
            浏览题库
          </button>
        </div>
      );
    }

    return (
      <div>
        <h2 className="text-xl font-semibold mb-4">已购买的题库</h2>
        <div className="grid gap-6 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
          {purchases.map((purchase) => (
            <PurchaseCard key={purchase.id} purchase={purchase} />
          ))}
        </div>
      </div>
    );
  };

  // 渲染兑换码内容
  const renderRedeemedContent = () => {
    if (redeemCodesLoading) {
      return (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
        </div>
      );
    }

    if (redeemCodes.length === 0) {
      return (
        <div className="bg-white p-6 rounded-lg shadow text-center">
          <p className="text-gray-600 mb-4">🎟️ 您还没有兑换任何题库</p>
          <button
            onClick={() => navigate('/')}
            className="bg-blue-500 hover:bg-blue-600 text-white font-medium py-2 px-4 rounded-lg transition-colors duration-200"
          >
            浏览题库
          </button>
        </div>
      );
    }

    return (
      <div>
        <h2 className="text-xl font-semibold mb-4">已兑换的题库</h2>
        <div className="grid gap-6 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
          {redeemCodes.map((redeemCode) => (
            <RedeemCard key={redeemCode.id} redeem={redeemCode} />
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-6">个人中心</h1>
      
      {renderTabs()}
      
      {activeTab === 'progress' ? renderProgressContent() : 
       activeTab === 'purchases' ? renderPurchasesContent() : 
       renderRedeemedContent()}
    </div>
  );
};

export default ProfilePage;