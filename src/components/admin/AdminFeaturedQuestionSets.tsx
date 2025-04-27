import React, { useState, useEffect } from 'react';
import { useUser } from '../../contexts/UserContext';
import { fetchWithAuth } from '../../utils/api';
import { QuestionSet } from '../../types';

interface FeaturedQuestionSet extends QuestionSet {
  isFeatured: boolean;
  featuredCategory?: string;
}

const AdminFeaturedQuestionSets: React.FC = () => {
  const { isAdmin } = useUser();
  const [questionSets, setQuestionSets] = useState<FeaturedQuestionSet[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const [featuredCategories, setFeaturedCategories] = useState<string[]>([]);

  // 加载题库和精选分类
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        // 获取所有题库
        const qsResponse = await fetchWithAuth<QuestionSet[]>('/question-sets');
        
        // 获取精选分类
        const fcResponse = await fetchWithAuth<string[]>('/homepage/featured-categories');
        
        if (qsResponse.success && qsResponse.data) {
          setQuestionSets(qsResponse.data as FeaturedQuestionSet[]);
        } else {
          setError(qsResponse.error || '加载题库失败');
        }
        
        if (fcResponse.success && fcResponse.data) {
          setFeaturedCategories(fcResponse.data);
        }
      } catch (err) {
        setError('加载数据时发生错误');
      } finally {
        setLoading(false);
      }
    };

    if (isAdmin()) {
      loadData();
    }
  }, [isAdmin]);

  // 更新题库的精选状态
  const handleFeaturedStatusChange = async (id: string, isFeatured: boolean) => {
    try {
      const response = await fetchWithAuth(`/homepage/featured-question-sets/${id}`, {
        method: 'PUT',
        body: JSON.stringify({ isFeatured })
      });

      if (response.success) {
        // 更新本地状态
        setQuestionSets(prev => 
          prev.map(qs => 
            qs.id === id ? { ...qs, isFeatured } : qs
          )
        );
        
        setMessage({ 
          type: 'success', 
          text: `题库已${isFeatured ? '添加到' : '从'}首页${isFeatured ? '' : '移除'}` 
        });
      } else {
        setMessage({ type: 'error', text: response.error || '更新失败' });
      }
    } catch (err) {
      setMessage({ type: 'error', text: '更新过程中发生错误' });
    }
    
    // 3秒后清除消息
    setTimeout(() => setMessage(null), 3000);
  };

  // 更新题库的精选分类
  const handleFeaturedCategoryChange = async (id: string, featuredCategory: string) => {
    try {
      const response = await fetchWithAuth(`/homepage/featured-question-sets/${id}`, {
        method: 'PUT',
        body: JSON.stringify({ featuredCategory })
      });

      if (response.success) {
        // 更新本地状态
        setQuestionSets(prev => 
          prev.map(qs => 
            qs.id === id ? { ...qs, featuredCategory } : qs
          )
        );
        
        setMessage({ type: 'success', text: '精选分类已更新' });
      } else {
        setMessage({ type: 'error', text: response.error || '更新失败' });
      }
    } catch (err) {
      setMessage({ type: 'error', text: '更新过程中发生错误' });
    }
    
    // 3秒后清除消息
    setTimeout(() => setMessage(null), 3000);
  };

  if (loading) {
    return <div className="p-4">正在加载...</div>;
  }

  if (error) {
    return <div className="p-4 text-red-500">{error}</div>;
  }

  return (
    <div className="bg-white shadow-md rounded-lg p-6 max-w-4xl mx-auto my-8">
      <h2 className="text-2xl font-semibold mb-6 pb-2 border-b">题库精选管理</h2>
      
      {message && (
        <div className={`p-4 mb-4 rounded ${message.type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
          {message.text}
        </div>
      )}

      <p className="mb-4 text-gray-600">
        选择要在首页展示的题库，并为它们分配精选分类。精选分类决定了题库在首页上的分组方式。
      </p>

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                题库名称
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                分类
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                显示在首页
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                精选分类
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {questionSets.map((qs) => (
              <tr key={qs.id}>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center">
                    <div className="text-2xl mr-3">{qs.icon}</div>
                    <div>
                      <div className="text-sm font-medium text-gray-900">{qs.title}</div>
                      <div className="text-sm text-gray-500">{qs.questions?.length || 0} 个问题</div>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800">
                    {qs.category}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <label className="inline-flex items-center">
                    <input 
                      type="checkbox" 
                      checked={qs.isFeatured || false}
                      onChange={() => handleFeaturedStatusChange(qs.id, !qs.isFeatured)}
                      className="form-checkbox h-5 w-5 text-blue-600"
                    />
                  </label>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <select
                    disabled={!qs.isFeatured}
                    value={qs.featuredCategory || ''}
                    onChange={(e) => handleFeaturedCategoryChange(qs.id, e.target.value)}
                    className={`block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none sm:text-sm ${!qs.isFeatured ? 'opacity-50 cursor-not-allowed' : 'focus:ring-blue-500 focus:border-blue-500'}`}
                  >
                    <option value="">--选择精选分类--</option>
                    {featuredCategories.map((category) => (
                      <option key={category} value={category}>
                        {category}
                      </option>
                    ))}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default AdminFeaturedQuestionSets; 