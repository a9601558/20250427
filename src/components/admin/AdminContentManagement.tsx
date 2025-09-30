import React, { useState, useEffect } from 'react';
import { useUser } from '../../contexts/UserContext';
import { useNavigate } from 'react-router-dom';
import { homepageService, questionSetService } from '../../services/api';
import { QuestionSet } from '../../types';
import { toast } from 'react-toastify';

// 类型定义
interface HomeContentData {
  title: string;
  subtitle: string;
  welcomeTitle: string;
  welcomeDescription: string;
  featuredCategories: string[];
  bannerImageUrl?: string;
  footerText: string;
}

interface FeaturedQuestionSet extends QuestionSet {
  isFeatured: boolean;
  featuredCategory?: string;
}

interface ContentStats {
  totalQuestionSets: number;
  featuredQuestionSets: number;
  totalCategories: number;
  activeCategories: number;
}

const AdminContentManagement: React.FC = () => {
  const { isAdmin } = useUser();
  const navigate = useNavigate();
  
  // 核心状态
  const [loading, setLoading] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'homepage' | 'categories' | 'featured'>('overview');
  const [saving, setSaving] = useState<boolean>(false);
  
  // 数据状态
  const [homeContent, setHomeContent] = useState<HomeContentData>({
    title: 'MonTopi オンライン問題集',
    subtitle: '質の高い問題集で効率的な学習を',
    welcomeTitle: 'MonTopiへようこそ',
    welcomeDescription: '豊富な問題集で知識を深めましょう',
    featuredCategories: [],
    bannerImageUrl: '',
    footerText: '© 2025 MonTopi. All rights reserved.'
  });
  
  const [questionSets, setQuestionSets] = useState<FeaturedQuestionSet[]>([]);
  const [stats, setStats] = useState<ContentStats>({
    totalQuestionSets: 0,
    featuredQuestionSets: 0,
    totalCategories: 0,
    activeCategories: 0
  });
  
  // 分类管理状态
  const [newCategory, setNewCategory] = useState<string>('');
  const [editingCategory, setEditingCategory] = useState<{index: number, value: string} | null>(null);
  
  // 权限检查
  useEffect(() => {
    if (!isAdmin()) {
      navigate('/');
      toast.error('管理者権限が必要です');
    }
  }, [isAdmin, navigate]);

  // 数据加载
  useEffect(() => {
    if (isAdmin()) {
      loadAllData();
    }
  }, [isAdmin]);

  const loadAllData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        loadHomeContent(),
        loadQuestionSets(),
        loadStats()
      ]);
    } catch (error) {
      console.error('データ読み込みエラー:', error);
      toast.error('データの読み込みに失敗しました');
    } finally {
      setLoading(false);
    }
  };

  const loadHomeContent = async () => {
    try {
      const response = await homepageService.getHomeContent();
      if (response.success && response.data) {
        // 转换后端数据结构为前端期望的格式
        const backendData = response.data;
        const frontendData: HomeContentData = {
          title: backendData.title || 'MonTopi オンライン問題集',
          subtitle: backendData.subtitle || '質の高い問題集で効率的な学習を',
          welcomeTitle: backendData.welcomeTitle || 'MonTopiへようこそ',
          welcomeDescription: backendData.welcomeDescription || '豊富な問題集で知識を深めましょう',
          featuredCategories: backendData.featuredCategories || [],
          bannerImageUrl: backendData.bannerImageUrl || backendData.bannerImage || '',
          footerText: backendData.footerText || '© 2025 MonTopi. All rights reserved.'
        };
        setHomeContent(frontendData);
      }
    } catch (error) {
      console.error('首页内容加载失败:', error);
    }
  };

  const loadQuestionSets = async () => {
    try {
      const response = await questionSetService.getAllQuestionSets();
      if (response.success && response.data) {
        const setsWithFeatured = response.data.map((set: QuestionSet) => ({
          ...set,
          isFeatured: set.isFeatured || false,
          featuredCategory: set.featuredCategory || ''
        }));
        setQuestionSets(setsWithFeatured);
      }
    } catch (error) {
      console.error('問題集データ読み込みエラー:', error);
    }
  };

  const loadStats = async () => {
    try {
      const total = questionSets.length;
      const featured = questionSets.filter(set => set.isFeatured).length;
      const allCategories = new Set(questionSets.map(set => set.category));
      const activeCategories = new Set(questionSets.filter(set => set.isFeatured).map(set => set.featuredCategory));
      
      setStats({
        totalQuestionSets: total,
        featuredQuestionSets: featured,
        totalCategories: allCategories.size,
        activeCategories: activeCategories.size
      });
    } catch (error) {
      console.error('統計データ読み込みエラー:', error);
    }
  };

  // 首页内容保存
  const saveHomeContent = async () => {
    setSaving(true);
    try {
      // 转换前端数据格式为后端期望的格式
      const backendData = {
        title: homeContent.title,
        subtitle: homeContent.subtitle,
        welcomeTitle: homeContent.welcomeTitle,
        welcomeDescription: homeContent.welcomeDescription,
        featuredCategories: homeContent.featuredCategories,
        bannerImage: homeContent.bannerImageUrl,
        bannerImageUrl: homeContent.bannerImageUrl,
        footerText: homeContent.footerText,
        announcements: '', // 默认值
        theme: 'light' // 默认值
      };
      
      const response = await homepageService.updateHomeContent(backendData);
      if (response.success) {
        toast.success('首页内容保存成功');
        // 触发前端刷新
        window.dispatchEvent(new CustomEvent('homeContentUpdated', { detail: homeContent }));
      } else {
        throw new Error(response.message || '保存失败');
      }
    } catch (error: any) {
      console.error('首页内容保存失败:', error);
      toast.error('首页内容保存失败: ' + (error.message || '未知错误'));
    } finally {
      setSaving(false);
    }
  };

  // 分类管理
  const addCategory = () => {
    if (!newCategory.trim()) return;
    
    const updatedCategories = [...homeContent.featuredCategories, newCategory.trim()];
    setHomeContent(prev => ({
      ...prev,
      featuredCategories: updatedCategories
    }));
    setNewCategory('');
    toast.success('カテゴリを追加しました');
  };

  const deleteCategory = (index: number) => {
    if (window.confirm('このカテゴリを削除しますか？')) {
      const updatedCategories = homeContent.featuredCategories.filter((_, i) => i !== index);
      setHomeContent(prev => ({
        ...prev,
        featuredCategories: updatedCategories
      }));
      toast.success('カテゴリを削除しました');
    }
  };

  const startEditCategory = (index: number) => {
    setEditingCategory({
      index,
      value: homeContent.featuredCategories[index]
    });
  };

  const saveEditCategory = () => {
    if (!editingCategory || !editingCategory.value.trim()) return;
    
    const updatedCategories = [...homeContent.featuredCategories];
    updatedCategories[editingCategory.index] = editingCategory.value.trim();
    
    setHomeContent(prev => ({
      ...prev,
      featuredCategories: updatedCategories
    }));
    setEditingCategory(null);
    toast.success('カテゴリを更新しました');
  };

  // 精选题库管理
  const toggleFeatured = async (questionSetId: string, isFeatured: boolean, category?: string) => {
    try {
      const response = await questionSetService.updateQuestionSet(questionSetId, {
        isFeatured,
        featuredCategory: isFeatured ? category : ''
      });
      
      if (response.success) {
        setQuestionSets(prev => 
          prev.map(set => 
            set.id === questionSetId 
              ? { ...set, isFeatured, featuredCategory: isFeatured ? category : '' }
              : set
          )
        );
        toast.success(isFeatured ? 'おすすめに設定しました' : 'おすすめを解除しました');
        loadStats();
      }
    } catch (error) {
      console.error('おすすめ設定エラー:', error);
      toast.error('操作に失敗しました');
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center p-8">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
        <span className="ml-3 text-lg">データを読み込み中...</span>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow">
      {/* 标题栏 */}
      <div className="border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">コンテンツ管理</h1>
            <p className="text-gray-600 mt-1">ホームページとおすすめコンテンツの管理</p>
          </div>
          <button
            onClick={loadAllData}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
          >
            <svg className="w-4 h-4 mr-2 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>
            </svg>
            データ更新
          </button>
        </div>
      </div>

      {/* 标签页 */}
      <div className="border-b border-gray-200">
        <nav className="flex space-x-8 px-6">
          {[
            { key: 'overview', label: '概要', icon: '📊' },
            { key: 'homepage', label: 'ホームページ', icon: '🏠' },
            { key: 'categories', label: 'カテゴリ', icon: '📁' },
            { key: 'featured', label: 'おすすめ問題集', icon: '⭐' }
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as any)}
              className={`py-4 px-1 inline-flex items-center border-b-2 font-medium text-sm transition-colors ${
                activeTab === tab.key
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <span className="mr-2">{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* 内容区域 */}
      <div className="p-6">
        {/* 概要标签页 */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="bg-blue-50 p-6 rounded-lg">
                <div className="flex items-center">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"></path>
                    </svg>
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-blue-600">総問題集数</p>
                    <p className="text-2xl font-bold text-blue-900">{stats.totalQuestionSets}</p>
                  </div>
                </div>
              </div>

              <div className="bg-green-50 p-6 rounded-lg">
                <div className="flex items-center">
                  <div className="p-2 bg-green-100 rounded-lg">
                    <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"></path>
                    </svg>
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-green-600">おすすめ問題集</p>
                    <p className="text-2xl font-bold text-green-900">{stats.featuredQuestionSets}</p>
                  </div>
                </div>
              </div>

              <div className="bg-yellow-50 p-6 rounded-lg">
                <div className="flex items-center">
                  <div className="p-2 bg-yellow-100 rounded-lg">
                    <svg className="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"></path>
                    </svg>
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-yellow-600">総カテゴリ数</p>
                    <p className="text-2xl font-bold text-yellow-900">{stats.totalCategories}</p>
                  </div>
                </div>
              </div>

              <div className="bg-purple-50 p-6 rounded-lg">
                <div className="flex items-center">
                  <div className="p-2 bg-purple-100 rounded-lg">
                    <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z"></path>
                    </svg>
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-purple-600">アクティブカテゴリ</p>
                    <p className="text-2xl font-bold text-purple-900">{stats.activeCategories}</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-gray-50 p-6 rounded-lg">
              <h3 className="text-lg font-medium mb-4">クイックアクション</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <button
                  onClick={() => setActiveTab('homepage')}
                  className="p-4 bg-white rounded-lg border border-gray-200 hover:border-blue-300 transition-colors text-left"
                >
                  <div className="flex items-center">
                    <span className="text-2xl mr-3">🏠</span>
                    <div>
                      <p className="font-medium">ホームページ編集</p>
                      <p className="text-sm text-gray-600">タイトルや説明文の編集</p>
                    </div>
                  </div>
                </button>

                <button
                  onClick={() => setActiveTab('categories')}
                  className="p-4 bg-white rounded-lg border border-gray-200 hover:border-blue-300 transition-colors text-left"
                >
                  <div className="flex items-center">
                    <span className="text-2xl mr-3">📁</span>
                    <div>
                      <p className="font-medium">カテゴリ管理</p>
                      <p className="text-sm text-gray-600">おすすめカテゴリの追加・編集</p>
                    </div>
                  </div>
                </button>

                <button
                  onClick={() => setActiveTab('featured')}
                  className="p-4 bg-white rounded-lg border border-gray-200 hover:border-blue-300 transition-colors text-left"
                >
                  <div className="flex items-center">
                    <span className="text-2xl mr-3">⭐</span>
                    <div>
                      <p className="font-medium">おすすめ設定</p>
                      <p className="text-sm text-gray-600">問題集のおすすめ表示設定</p>
                    </div>
                  </div>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ホームページ標签页 */}
        {activeTab === 'homepage' && (
          <div className="space-y-6">
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <h3 className="text-lg font-medium mb-4">基本設定</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    サイトタイトル
                  </label>
                  <input
                    type="text"
                    value={homeContent.title}
                    onChange={(e) => setHomeContent(prev => ({ ...prev, title: e.target.value }))}
                    className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="サイトのタイトルを入力"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    サブタイトル
                  </label>
                  <input
                    type="text"
                    value={homeContent.subtitle}
                    onChange={(e) => setHomeContent(prev => ({ ...prev, subtitle: e.target.value }))}
                    className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="サブタイトルを入力"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    ウェルカムタイトル
                  </label>
                  <input
                    type="text"
                    value={homeContent.welcomeTitle}
                    onChange={(e) => setHomeContent(prev => ({ ...prev, welcomeTitle: e.target.value }))}
                    className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="ウェルカムメッセージのタイトル"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    バナー画像URL（オプション）
                  </label>
                  <input
                    type="url"
                    value={homeContent.bannerImageUrl || ''}
                    onChange={(e) => setHomeContent(prev => ({ ...prev, bannerImageUrl: e.target.value }))}
                    className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="https://example.com/banner.jpg"
                  />
                </div>
              </div>

              <div className="mt-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  ウェルカム説明文
                </label>
                <textarea
                  value={homeContent.welcomeDescription}
                  onChange={(e) => setHomeContent(prev => ({ ...prev, welcomeDescription: e.target.value }))}
                  rows={4}
                  className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="ウェルカムメッセージの詳細説明"
                />
              </div>

              <div className="mt-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  フッターテキスト
                </label>
                <input
                  type="text"
                  value={homeContent.footerText}
                  onChange={(e) => setHomeContent(prev => ({ ...prev, footerText: e.target.value }))}
                  className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="© 2025 MonTopi. All rights reserved."
                />
              </div>

              <div className="flex justify-end mt-6">
                <button
                  onClick={saveHomeContent}
                  disabled={saving}
                  className={`px-6 py-2 rounded-md font-medium transition-colors ${
                    saving
                      ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                      : 'bg-blue-600 text-white hover:bg-blue-700'
                  }`}
                >
                  {saving ? '保存中...' : 'ホームページ設定を保存'}
                </button>
              </div>
            </div>

            {/* プレビュー */}
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
              <h3 className="text-lg font-medium mb-4">プレビュー</h3>
              <div className="bg-white rounded-lg p-6 shadow-sm">
                <h1 className="text-3xl font-bold text-gray-900 mb-2">{homeContent.title}</h1>
                <p className="text-lg text-gray-600 mb-6">{homeContent.subtitle}</p>
                {homeContent.bannerImageUrl && (
                  <img 
                    src={homeContent.bannerImageUrl} 
                    alt="Banner" 
                    className="w-full h-48 object-cover rounded-lg mb-6"
                  />
                )}
                <div className="bg-blue-50 p-6 rounded-lg">
                  <h2 className="text-xl font-semibold text-blue-900 mb-2">{homeContent.welcomeTitle}</h2>
                  <p className="text-blue-800">{homeContent.welcomeDescription}</p>
                </div>
                <footer className="mt-6 pt-4 border-t border-gray-200 text-center text-sm text-gray-500">
                  {homeContent.footerText}
                </footer>
              </div>
            </div>
          </div>
        )}

        {/* カテゴリ標签页 */}
        {activeTab === 'categories' && (
          <div className="space-y-6">
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <h3 className="text-lg font-medium mb-4">おすすめカテゴリ管理</h3>
              
              {/* 添加分类 */}
              <div className="flex gap-3 mb-6">
                <input
                  type="text"
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && addCategory()}
                  className="flex-1 p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                  placeholder="新しいカテゴリ名を入力"
                />
                <button
                  onClick={addCategory}
                  disabled={!newCategory.trim()}
                  className="px-6 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
                >
                  追加
                </button>
              </div>

              {/* 分类列表 */}
              <div className="space-y-3">
                {homeContent.featuredCategories.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <p className="text-lg mb-2">📁</p>
                    <p>おすすめカテゴリがありません</p>
                    <p className="text-sm">上の入力欄から新しいカテゴリを追加してください</p>
                  </div>
                ) : (
                  homeContent.featuredCategories.map((category, index) => (
                    <div key={index} className="flex items-center justify-between bg-gray-50 p-4 rounded-lg">
                      {editingCategory?.index === index ? (
                        <div className="flex items-center flex-1 gap-3">
                          <input
                            type="text"
                            value={editingCategory.value}
                            onChange={(e) => setEditingCategory(prev => prev ? { ...prev, value: e.target.value } : null)}
                            onKeyPress={(e) => e.key === 'Enter' && saveEditCategory()}
                            className="flex-1 p-2 border border-gray-300 rounded"
                            autoFocus
                          />
                          <button
                            onClick={saveEditCategory}
                            className="px-3 py-2 bg-green-600 text-white text-sm rounded hover:bg-green-700"
                          >
                            保存
                          </button>
                          <button
                            onClick={() => setEditingCategory(null)}
                            className="px-3 py-2 bg-gray-600 text-white text-sm rounded hover:bg-gray-700"
                          >
                            キャンセル
                          </button>
                        </div>
                      ) : (
                        <>
                          <div className="flex items-center">
                            <span className="text-lg mr-3">📁</span>
                            <span className="font-medium">{category}</span>
                          </div>
                          <div className="flex items-center space-x-2">
                            <button
                              onClick={() => startEditCategory(index)}
                              className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
                            >
                              編集
                            </button>
                            <button
                              onClick={() => deleteCategory(index)}
                              className="px-3 py-1 bg-red-600 text-white text-sm rounded hover:bg-red-700"
                            >
                              削除
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  ))
                )}
              </div>

              {homeContent.featuredCategories.length > 0 && (
                <div className="flex justify-end mt-6">
                  <button
                    onClick={saveHomeContent}
                    disabled={saving}
                    className={`px-6 py-2 rounded-md font-medium transition-colors ${
                      saving
                        ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                        : 'bg-blue-600 text-white hover:bg-blue-700'
                    }`}
                  >
                    {saving ? '保存中...' : 'カテゴリ設定を保存'}
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* おすすめ問題集標签页 */}
        {activeTab === 'featured' && (
          <div className="space-y-6">
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <h3 className="text-lg font-medium mb-4">おすすめ問題集管理</h3>
              
              {questionSets.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <p className="text-lg mb-2">📚</p>
                  <p>問題集がありません</p>
                </div>
              ) : (
                <div className="grid gap-4">
                  {questionSets.map(set => (
                    <div key={set.id} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                      <div className="flex items-center">
                        <span className="text-2xl mr-4">{set.icon || '📚'}</span>
                        <div>
                          <h4 className="font-medium text-gray-900">{set.title}</h4>
                          <p className="text-sm text-gray-600">{set.description}</p>
                          <div className="flex items-center mt-1 text-xs text-gray-500">
                            <span className="mr-4">カテゴリ: {set.category}</span>
                            <span className="mr-4">問題数: {Array.isArray(set.questions) ? set.questions.length : (set.questionCount || 0)}</span>
                            {set.isPaid && <span className="text-yellow-600">有料: ¥{set.price}</span>}
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex items-center space-x-3">
                        {set.isFeatured ? (
                          <div className="flex items-center space-x-2">
                            <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full">
                              おすすめ: {set.featuredCategory}
                            </span>
                            <button
                              onClick={() => toggleFeatured(set.id, false)}
                              className="px-3 py-1 bg-red-600 text-white text-sm rounded hover:bg-red-700"
                            >
                              解除
                            </button>
                          </div>
                        ) : (
                          <select
                            onChange={(e) => {
                              if (e.target.value) {
                                toggleFeatured(set.id, true, e.target.value);
                              }
                            }}
                            className="px-3 py-1 border border-gray-300 rounded text-sm"
                            defaultValue=""
                          >
                            <option value="">おすすめに設定</option>
                            {homeContent.featuredCategories.map(category => (
                              <option key={category} value={category}>{category}</option>
                            ))}
                          </select>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* おすすめ問題集のプレビュー */}
            {questionSets.filter(set => set.isFeatured).length > 0 && (
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
                <h3 className="text-lg font-medium mb-4">おすすめ問題集プレビュー</h3>
                <div className="space-y-4">
                  {homeContent.featuredCategories.map(category => {
                    const categoryQuestionSets = questionSets.filter(set => set.isFeatured && set.featuredCategory === category);
                    if (categoryQuestionSets.length === 0) return null;

                    return (
                      <div key={category} className="bg-white p-4 rounded-lg">
                        <h4 className="font-medium text-gray-900 mb-3">{category}</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                          {categoryQuestionSets.map(set => (
                            <div key={set.id} className="p-3 border border-gray-200 rounded text-sm">
                              <div className="flex items-center mb-1">
                                <span className="mr-2">{set.icon || '📚'}</span>
                                <span className="font-medium">{set.title}</span>
                              </div>
                              <p className="text-gray-600 text-xs">{set.description}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminContentManagement;