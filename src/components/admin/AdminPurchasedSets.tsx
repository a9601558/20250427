import React, { useState, useEffect } from 'react';
import { collection, getDocs, query, where, orderBy, Timestamp, DocumentData, QueryDocumentSnapshot } from 'firebase/firestore';
import { format } from 'date-fns';
import { db } from '../../config/firebase'; // 导入已初始化的Firestore实例

interface PurchaseRecord {
  id: string;
  userId: string;
  username: string;
  email: string;
  questionSetId: string;
  questionSetTitle: string;
  purchaseDate: Timestamp;
  expiryDate: Timestamp;
  purchaseAmount: number;
  paymentMethod: string;
}

const AdminPurchasedSets: React.FC = () => {
  const [purchaseRecords, setPurchaseRecords] = useState<PurchaseRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterBy, setFilterBy] = useState<'all' | 'active' | 'expired'>('all');
  const [sortBy, setSortBy] = useState<'date' | 'title' | 'price'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Statistics
  const [totalPurchases, setTotalPurchases] = useState(0);
  const [totalRevenue, setTotalRevenue] = useState(0);
  const [activePurchases, setActivePurchases] = useState(0);
  const [expiredPurchases, setExpiredPurchases] = useState(0);

  useEffect(() => {
    fetchPurchaseRecords();
  }, []);

  const fetchPurchaseRecords = async () => {
    try {
      setLoading(true);
      const purchasesRef = collection(db, 'purchases');
      const q = query(purchasesRef, orderBy('purchaseDate', 'desc'));
      const querySnapshot = await getDocs(q);
      
      const records: PurchaseRecord[] = [];
      querySnapshot.forEach((doc: QueryDocumentSnapshot<DocumentData>) => {
        const data = doc.data() as Omit<PurchaseRecord, 'id'>;
        records.push({
          id: doc.id,
          ...data
        });
      });
      
      setPurchaseRecords(records);
      
      // Calculate statistics
      const now = Timestamp.now();
      const active = records.filter(record => record.expiryDate.toMillis() > now.toMillis()).length;
      const expired = records.length - active;
      const revenue = records.reduce((sum, record) => sum + record.purchaseAmount, 0);
      
      setTotalPurchases(records.length);
      setTotalRevenue(revenue);
      setActivePurchases(active);
      setExpiredPurchases(expired);
      
    } catch (err) {
      setError('获取购买记录失败');
      console.error('Error fetching purchase records:', err);
    } finally {
      setLoading(false);
    }
  };

  const getFilteredRecords = () => {
    const now = Timestamp.now();
    
    let filtered = [...purchaseRecords];
    
    // Apply status filter
    if (filterBy === 'active') {
      filtered = filtered.filter(record => record.expiryDate.toMillis() > now.toMillis());
    } else if (filterBy === 'expired') {
      filtered = filtered.filter(record => record.expiryDate.toMillis() <= now.toMillis());
    }
    
    // Apply search filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(record => 
        record.username?.toLowerCase().includes(term) ||
        record.email?.toLowerCase().includes(term) ||
        record.questionSetTitle?.toLowerCase().includes(term)
      );
    }
    
    // Apply sorting
    filtered.sort((a, b) => {
      if (sortBy === 'date') {
        return sortOrder === 'asc' 
          ? a.purchaseDate.toMillis() - b.purchaseDate.toMillis()
          : b.purchaseDate.toMillis() - a.purchaseDate.toMillis();
      } else if (sortBy === 'title') {
        return sortOrder === 'asc'
          ? a.questionSetTitle.localeCompare(b.questionSetTitle)
          : b.questionSetTitle.localeCompare(a.questionSetTitle);
      } else if (sortBy === 'price') {
        return sortOrder === 'asc'
          ? a.purchaseAmount - b.purchaseAmount
          : b.purchaseAmount - a.purchaseAmount;
      }
      return 0;
    });
    
    return filtered;
  };

  const toggleSortOrder = () => {
    setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
  };

  const formatDate = (timestamp: Timestamp) => {
    return format(timestamp.toDate(), 'yyyy-MM-dd HH:mm');
  };

  const getStatusBadge = (record: PurchaseRecord) => {
    const now = Timestamp.now();
    const isActive = record.expiryDate.toMillis() > now.toMillis();
    
    if (isActive) {
      return (
        <span className="px-2 py-1 text-xs rounded-full bg-green-100 text-green-800 dark:bg-green-700 dark:text-green-100">
          有效
        </span>
      );
    } else {
      return (
        <span className="px-2 py-1 text-xs rounded-full bg-red-100 text-red-800 dark:bg-red-700 dark:text-red-100">
          已过期
        </span>
      );
    }
  };

  const refreshData = () => {
    fetchPurchaseRecords();
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-900">已购题库管理</h2>
        <button
          onClick={refreshData}
          className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        >
          <svg className="mr-2 -ml-1 h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          刷新数据
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-white p-4 rounded-lg shadow border border-gray-200 overflow-hidden">
          <div className="flex items-center">
            <div className="p-3 rounded-full bg-blue-500 bg-opacity-10">
              <svg className="h-8 w-8 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"></path>
              </svg>
            </div>
            <div className="ml-4">
              <h3 className="text-lg font-medium text-gray-900">总购买数</h3>
              <p className="text-2xl font-bold text-gray-700">{totalPurchases}</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-lg shadow border border-gray-200 overflow-hidden">
          <div className="flex items-center">
            <div className="p-3 rounded-full bg-green-500 bg-opacity-10">
              <svg className="h-8 w-8 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
              </svg>
            </div>
            <div className="ml-4">
              <h3 className="text-lg font-medium text-gray-900">总收入</h3>
              <p className="text-2xl font-bold text-gray-700">¥{totalRevenue.toFixed(2)}</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-lg shadow border border-gray-200 overflow-hidden">
          <div className="flex items-center">
            <div className="p-3 rounded-full bg-indigo-500 bg-opacity-10">
              <svg className="h-8 w-8 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
              </svg>
            </div>
            <div className="ml-4">
              <h3 className="text-lg font-medium text-gray-900">有效购买</h3>
              <p className="text-2xl font-bold text-gray-700">{activePurchases}</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-lg shadow border border-gray-200 overflow-hidden">
          <div className="flex items-center">
            <div className="p-3 rounded-full bg-red-500 bg-opacity-10">
              <svg className="h-8 w-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
              </svg>
            </div>
            <div className="ml-4">
              <h3 className="text-lg font-medium text-gray-900">已过期</h3>
              <p className="text-2xl font-bold text-gray-700">{expiredPurchases}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Search and Filter Controls */}
      <div className="bg-white p-4 rounded-lg shadow mb-6 border border-gray-200">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label htmlFor="search" className="block text-sm font-medium text-gray-700">搜索</label>
            <input
              type="text"
              id="search"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="用户名/邮箱/题库名称"
              className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
            />
          </div>
          
          <div>
            <label htmlFor="filterBy" className="block text-sm font-medium text-gray-700">状态筛选</label>
            <select
              id="filterBy"
              value={filterBy}
              onChange={(e) => setFilterBy(e.target.value as 'all' | 'active' | 'expired')}
              className="mt-1 block w-full bg-white border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
            >
              <option value="all">全部</option>
              <option value="active">有效</option>
              <option value="expired">已过期</option>
            </select>
          </div>
          
          <div>
            <label htmlFor="sortBy" className="block text-sm font-medium text-gray-700">排序方式</label>
            <div className="mt-1 flex rounded-md shadow-sm">
              <select
                id="sortBy"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as 'date' | 'title' | 'price')}
                className="flex-grow block w-full bg-white border border-gray-300 rounded-l-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              >
                <option value="date">购买日期</option>
                <option value="title">题库名称</option>
                <option value="price">购买金额</option>
              </select>
              <button
                type="button"
                onClick={toggleSortOrder}
                className="inline-flex items-center px-3 rounded-r-md border border-l-0 border-gray-300 bg-gray-50 text-gray-500 sm:text-sm"
              >
                {sortOrder === 'asc' ? (
                  <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                    <path fillRule="evenodd" d="M14.707 12.707a1 1 0 01-1.414 0L10 9.414l-3.293 3.293a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 010 1.414z" clipRule="evenodd" />
                  </svg>
                ) : (
                  <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                    <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Purchase Records Table */}
      <div className="bg-white shadow overflow-hidden border-b border-gray-200 rounded-lg">
        {loading ? (
          <div className="p-10 text-center">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500 mx-auto"></div>
            <p className="mt-2 text-gray-600">加载中...</p>
          </div>
        ) : error ? (
          <div className="p-6 text-center text-red-500">
            <svg className="mx-auto h-12 w-12 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="mt-2">{error}</p>
          </div>
        ) : getFilteredRecords().length === 0 ? (
          <div className="p-6 text-center text-gray-500">
            <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            <p className="mt-2">没有找到匹配的记录</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">用户信息</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">题库信息</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">购买日期</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">到期日期</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">金额</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">状态</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {getFilteredRecords().map((record) => (
                    <tr key={record.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="flex-shrink-0 h-10 w-10 bg-blue-100 rounded-full flex items-center justify-center">
                            <span className="text-blue-600 font-bold">{record.username?.[0] || record.email?.[0] || '?'}</span>
                          </div>
                          <div className="ml-4">
                            <div className="text-sm font-medium text-gray-900">{record.username || '未知用户'}</div>
                            <div className="text-sm text-gray-500">{record.email}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{record.questionSetTitle}</div>
                        <div className="text-xs text-gray-500">ID: {record.questionSetId}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {formatDate(record.purchaseDate)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {formatDate(record.expiryDate)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        ¥{record.purchaseAmount.toFixed(2)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {getStatusBadge(record)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="bg-gray-50 py-3 px-6 border-t border-gray-200 text-sm text-gray-500">
              显示 {getFilteredRecords().length} 条购买记录
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default AdminPurchasedSets; 