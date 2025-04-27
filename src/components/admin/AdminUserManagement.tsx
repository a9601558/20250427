import React, { useState, useEffect } from 'react';
import { useUser } from '../../contexts/UserContext';
import { User } from '../../types';

const AdminUserManagement: React.FC = () => {
  const { getAllUsers, deleteUser, updateUser, adminRegister } = useUser();
  const [users, setUsers] = useState<User[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [statusMessage, setStatusMessage] = useState({ type: '', message: '' });
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newUser, setNewUser] = useState({
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
    isAdmin: false
  });
  const [formErrors, setFormErrors] = useState<{[key: string]: string}>({});

  // 加载用户列表
  useEffect(() => {
    const fetchUsers = async () => {
      setIsLoading(true);
      try {
        const usersList = await getAllUsers();
        setUsers(usersList);
      } catch (error) {
        console.error("加载用户失败:", error);
        setStatusMessage({ type: 'error', message: '加载用户列表失败' });
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchUsers();
  }, [getAllUsers]);

  // 搜索过滤用户
  const filteredUsers = users.filter(user => 
    user.username.toLowerCase().includes(searchTerm.toLowerCase()) || 
    user.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // 删除用户处理
  const handleDeleteUser = async (userId: string) => {
    if (window.confirm('确定要删除此用户吗？此操作不可逆。')) {
      try {
        const result = await deleteUser(userId);
        if (result.success) {
          setUsers(users.filter(user => user.id !== userId));
          setStatusMessage({ type: 'success', message: '用户删除成功' });
        } else {
          setStatusMessage({ type: 'error', message: result.message || '删除用户失败' });
        }
      } catch (error) {
        setStatusMessage({ type: 'error', message: '删除用户失败' });
      }
      
      // 3秒后清除消息
      setTimeout(() => setStatusMessage({ type: '', message: '' }), 3000);
    }
  };

  // 编辑用户处理
  const handleUpdateUser = async (userId: string, updates: Partial<User>) => {
    try {
      await updateUser(updates); // 更新只需要传入包含id的userData
      
      // 更新本地用户列表
      setUsers(users.map(user => 
        user.id === userId ? { ...user, ...updates } : user
      ));
      setStatusMessage({ type: 'success', message: '用户信息更新成功' });
    } catch (error) {
      setStatusMessage({ type: 'error', message: '更新用户信息失败' });
    }
    
    // 3秒后清除消息
    setTimeout(() => setStatusMessage({ type: '', message: '' }), 3000);
  };

  // 处理新用户表单字段变化
  const handleNewUserChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    setNewUser({
      ...newUser,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value
    });
    
    // 清除对应的错误消息
    if (formErrors[name]) {
      setFormErrors({
        ...formErrors,
        [name]: ''
      });
    }
  };

  // 验证新用户表单
  const validateForm = () => {
    const errors: {[key: string]: string} = {};
    
    if (!newUser.username.trim()) {
      errors.username = '请输入用户名';
    }
    
    if (!newUser.email.trim()) {
      errors.email = '请输入邮箱';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newUser.email)) {
      errors.email = '请输入有效的邮箱地址';
    }
    
    if (!newUser.password) {
      errors.password = '请输入密码';
    } else if (newUser.password.length < 6) {
      errors.password = '密码长度至少为6个字符';
    }
    
    if (newUser.password !== newUser.confirmPassword) {
      errors.confirmPassword = '两次输入的密码不一致';
    }
    
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // 创建新用户
  const handleCreateUser = async () => {
    if (!validateForm()) return;
    
    setIsLoading(true);
    try {
      // 创建用户数据对象
      const userData = {
        username: newUser.username,
        email: newUser.email,
        password: newUser.password,
        isAdmin: newUser.isAdmin
      };
      
      const result = await adminRegister(userData);
      
      if (result.success) {
        // 重新加载用户列表
        const updatedUsersList = await getAllUsers();
        setUsers(updatedUsersList);
        
        setStatusMessage({ type: 'success', message: '用户创建成功' });
        setShowCreateForm(false);
        // 重置表单
        setNewUser({
          username: '',
          email: '',
          password: '',
          confirmPassword: '',
          isAdmin: false
        });
      } else {
        setStatusMessage({ type: 'error', message: result.message || '创建失败，邮箱可能已被注册' });
      }
    } catch (error) {
      setStatusMessage({ type: 'error', message: '创建用户时发生错误' });
    } finally {
      setIsLoading(false);
      
      // 3秒后清除消息
      setTimeout(() => setStatusMessage({ type: '', message: '' }), 3000);
    }
  };

  return (
    <div className="px-4 py-5 sm:p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-lg leading-6 font-medium text-gray-900">用户管理</h2>
        <div className="flex space-x-4">
          <div className="relative">
            <input
              type="text"
              placeholder="搜索用户..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="shadow-sm focus:ring-blue-500 focus:border-blue-500 block w-full sm:text-sm border-gray-300 rounded-md"
            />
          </div>
          <button
            onClick={() => setShowCreateForm(true)}
            className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            <svg className="-ml-1 mr-2 h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 3a1 1 0 00-1 1v5H4a1 1 0 100 2h5v5a1 1 0 102 0v-5h5a1 1 0 100-2h-5V4a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            创建用户
          </button>
        </div>
      </div>
      
      {/* 创建用户表单 */}
      {showCreateForm && (
        <div className="mb-8 bg-gray-50 p-6 rounded-lg border border-gray-200">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-medium text-gray-900">创建新用户</h3>
            <button
              onClick={() => setShowCreateForm(false)}
              className="text-gray-500 hover:text-gray-700"
            >
              <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          
          <div className="grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-6">
            <div className="sm:col-span-3">
              <label htmlFor="username" className="block text-sm font-medium text-gray-700">
                用户名
              </label>
              <div className="mt-1">
                <input
                  type="text"
                  name="username"
                  id="username"
                  value={newUser.username}
                  onChange={handleNewUserChange}
                  className={`shadow-sm focus:ring-blue-500 focus:border-blue-500 block w-full sm:text-sm border-gray-300 rounded-md ${formErrors.username ? 'border-red-300' : ''}`}
                />
                {formErrors.username && (
                  <p className="mt-1 text-sm text-red-600">{formErrors.username}</p>
                )}
              </div>
            </div>

            <div className="sm:col-span-3">
              <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                电子邮箱
              </label>
              <div className="mt-1">
                <input
                  type="email"
                  name="email"
                  id="email"
                  value={newUser.email}
                  onChange={handleNewUserChange}
                  className={`shadow-sm focus:ring-blue-500 focus:border-blue-500 block w-full sm:text-sm border-gray-300 rounded-md ${formErrors.email ? 'border-red-300' : ''}`}
                />
                {formErrors.email && (
                  <p className="mt-1 text-sm text-red-600">{formErrors.email}</p>
                )}
              </div>
            </div>

            <div className="sm:col-span-3">
              <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                密码
              </label>
              <div className="mt-1">
                <input
                  type="password"
                  name="password"
                  id="password"
                  value={newUser.password}
                  onChange={handleNewUserChange}
                  className={`shadow-sm focus:ring-blue-500 focus:border-blue-500 block w-full sm:text-sm border-gray-300 rounded-md ${formErrors.password ? 'border-red-300' : ''}`}
                />
                {formErrors.password && (
                  <p className="mt-1 text-sm text-red-600">{formErrors.password}</p>
                )}
              </div>
            </div>

            <div className="sm:col-span-3">
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700">
                确认密码
              </label>
              <div className="mt-1">
                <input
                  type="password"
                  name="confirmPassword"
                  id="confirmPassword"
                  value={newUser.confirmPassword}
                  onChange={handleNewUserChange}
                  className={`shadow-sm focus:ring-blue-500 focus:border-blue-500 block w-full sm:text-sm border-gray-300 rounded-md ${formErrors.confirmPassword ? 'border-red-300' : ''}`}
                />
                {formErrors.confirmPassword && (
                  <p className="mt-1 text-sm text-red-600">{formErrors.confirmPassword}</p>
                )}
              </div>
            </div>

            <div className="sm:col-span-6">
              <div className="flex items-center">
                <input
                  id="isAdmin"
                  name="isAdmin"
                  type="checkbox"
                  checked={newUser.isAdmin}
                  onChange={handleNewUserChange}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label htmlFor="isAdmin" className="ml-2 block text-sm text-gray-700">
                  设为管理员
                </label>
              </div>
            </div>
          </div>

          <div className="mt-6 flex justify-end">
            <button
              type="button"
              onClick={() => setShowCreateForm(false)}
              className="mr-3 bg-white py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              取消
            </button>
            <button
              type="button"
              onClick={handleCreateUser}
              className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              创建
            </button>
          </div>
        </div>
      )}
      
      {statusMessage.message && (
        <div 
          className={`mb-4 p-4 rounded-md ${
            statusMessage.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
          }`}
        >
          {statusMessage.message}
        </div>
      )}
      
      {isLoading ? (
        <div className="text-center py-6">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
          <p className="mt-2 text-sm text-gray-500">加载中...</p>
        </div>
      ) : (
        <div className="overflow-hidden shadow ring-1 ring-black ring-opacity-5 sm:rounded-lg">
          <table className="min-w-full divide-y divide-gray-300">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900">用户名</th>
                <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">电子邮箱</th>
                <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">角色</th>
                <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">购买记录</th>
                <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">答题记录</th>
                <th scope="col" className="relative py-3.5 pl-3 pr-4">
                  <span className="sr-only">操作</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-4 text-center text-sm text-gray-500">
                    没有找到匹配的用户
                  </td>
                </tr>
              ) : (
                filteredUsers.map(user => (
                  <tr key={user.id}>
                    <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-gray-900">
                      {user.username}
                    </td>
                    <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">{user.email}</td>
                    <td className="whitespace-nowrap px-3 py-4 text-sm">
                      {user.isAdmin ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-sm font-medium bg-purple-100 text-purple-800">
                          管理员
                        </span>
                      ) : (
                        <span className="text-gray-500">普通用户</span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                      {user.purchases?.length || 0}
                    </td>
                    <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                      {Object.keys(user.progress || {}).length}
                    </td>
                    <td className="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium">
                      <button
                        className="text-blue-600 hover:text-blue-900 mr-3"
                        onClick={() => {
                          // 这里可以实现编辑功能，例如打开一个模态框
                          const isAdminChange = window.confirm(
                            user.isAdmin
                              ? '确定要将此用户降级为普通用户吗？'
                              : '确定要将此用户提升为管理员吗？'
                          );
                          
                          if (isAdminChange) {
                            handleUpdateUser(user.id, { isAdmin: !user.isAdmin });
                          }
                        }}
                      >
                        {user.isAdmin ? '降级为普通用户' : '提升为管理员'}
                      </button>
                      <button
                        className="text-red-600 hover:text-red-900"
                        onClick={() => handleDeleteUser(user.id)}
                      >
                        删除
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
      
      <div className="mt-4 text-sm text-gray-500">
        共 {filteredUsers.length} 个用户
      </div>
    </div>
  );
};

export default AdminUserManagement; 