import React, { useState, useEffect } from 'react';
import { useUser } from '../contexts/UserContext';
import { getSavedAccounts } from '../utils/authUtils';
import { toast } from 'react-toastify';
import { cognitoAuthService } from '../services/CognitoAuthService';

enum AuthMode {
  LOGIN = 'login',
  REGISTER = 'register',
  FORGOT_PASSWORD = 'forgot_password',
  RESET_PASSWORD = 'reset_password',
  SMS_LOGIN = 'sms_login',
  VERIFY_SMS = 'verify_sms',
  EMAIL_LOGIN = 'email_login',
  VERIFY_EMAIL = 'verify_email'
}

interface LoginModalProps {
  isOpen?: boolean;
  onClose: () => void;
}

const LoginModal: React.FC<LoginModalProps> = ({ isOpen = true, onClose }) => {
  const { login, register, loading, error: contextError, switchAccount, smsLogin, sendSmsCode, emailLogin, sendEmailCode } = useUser();
  const [mode, setMode] = useState<AuthMode>(AuthMode.LOGIN);
  const [formData, setFormData] = useState({
    usernameOrEmail: '',
    username: '',
    password: '',
    email: '',
    phoneNumber: '',
    confirmPassword: '',
    verificationCode: '',
    newPassword: '',
    confirmNewPassword: ''
  });
  const [formError, setFormError] = useState<string | null>(null);
  const [savedAccounts, setSavedAccounts] = useState<Array<{
    userId: string;
    username: string;
    lastLogin: string;
    autoLogin: boolean;
  }>>([]);
  
  // 加载已保存的账号列表
  useEffect(() => {
    if (mode === AuthMode.LOGIN) {
      const accounts = getSavedAccounts();
      // 按最后登录时间排序，最近的在前面
      const sorted = [...accounts].sort((a, b) => 
        new Date(b.lastLogin).getTime() - new Date(a.lastLogin).getTime()
      );
      setSavedAccounts(sorted);
    }
  }, [mode]);

  // 监听UserContext中的错误状态变化
  useEffect(() => {
    if (contextError && !formError) {
      setFormError(contextError);
    }
  }, [contextError, formError]);
  
  const toggleMode = () => {
    if (mode === AuthMode.LOGIN) {
      setMode(AuthMode.REGISTER);
    } else if (mode === AuthMode.REGISTER) {
      setMode(AuthMode.LOGIN);
    } else {
      // 从忘记密码或重置密码模式返回登录
      setMode(AuthMode.LOGIN);
    }
    
    setFormError('');
    // 重置表单
    setFormData({
      usernameOrEmail: '',
      username: '',
      password: '',
      email: '',
      phoneNumber: '',
      confirmPassword: '',
      verificationCode: '',
      newPassword: '',
      confirmNewPassword: ''
    });
  };
  
  // 重新发送验证码
  const handleResendCode = async () => {
    if (!formData.usernameOrEmail.trim()) {
      toast.error('ユーザー名またはメールアドレスを入力してください');
      return;
    }

    try {
      // 根据当前模式选择不同的重发方式
      let result;
      if (mode === AuthMode.RESET_PASSWORD) {
        // 重新发送密码重置验证码
        result = await cognitoAuthService.resendPasswordResetCode(formData.usernameOrEmail);
      } else {
        // 重新发送注册验证码
        result = await cognitoAuthService.resendVerificationCode(formData.usernameOrEmail);
      }
      
      if (result.success) {
        toast.success(`認証コードを ${result.destination} に再送信しました`);
      } else {
        toast.error(result.message || '認証コードの再送信に失敗しました');
      }
    } catch (error) {
      console.error('重新发送验证码错误:', error);
      toast.error('認証コードの再送信中にエラーが発生しました');
    }
  };

  // 验证用户输入格式
  const validateUserInput = (input: string) => {
    const validation = cognitoAuthService.validateUserInput(input);
    
    if (!validation.isValid) {
      if (validation.type === 'username') {
        setFormError('有効なユーザー名（4-20文字の英数字とアンダースコア）、メールアドレス、または電話番号を入力してください');
      }
      return false;
    }
    
    return true;
  };
  
  const validateForm = (): boolean => {
    setFormError('');
    
    if (mode === AuthMode.LOGIN) {
      // 登录模式验证
      if (!formData.usernameOrEmail.trim()) {
        setFormError('ユーザー名またはメールアドレスは必須です');
        return false;
      }
    } else {
      // 注册模式验证
      if (!formData.username.trim()) {
        setFormError('ユーザー名は必須です');
        return false;
      }
      
      if (!formData.email.trim()) {
        setFormError('メールアドレスは必須です');
        return false;
      }
      
      // 简单的邮箱格式验证
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(formData.email)) {
        setFormError('有効なメールアドレスを入力してください');
        return false;
      }
      
      if (formData.password !== formData.confirmPassword) {
        setFormError('パスワードが一致しません');
        return false;
      }
    }
    
    if (!formData.password) {
      setFormError('パスワードは必須です');
      return false;
    }
    
    if (mode === AuthMode.REGISTER && formData.password.length < 6) {
      setFormError('パスワードは6文字以上である必要があります');
      return false;
    }
    
    return true;
  };
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) return;
    
    // 清除之前的错误消息
    setFormError('');
    
    try {
      let success = false;
      
      if (mode === AuthMode.LOGIN) {
        success = await login(formData.usernameOrEmail, formData.password);
        if (!success) {
          // 等待一下让contextError更新，然后使用最新的错误信息
          setTimeout(() => {
            const errorMessage = contextError || 'ユーザー名/メールアドレスまたはパスワードが間違っています';
            setFormError(errorMessage);
            toast.error(errorMessage);
          }, 100);
        }
      } else {
        // 创建用户数据对象
        const userData = {
          username: formData.username,
          email: formData.email,
          password: formData.password
        };
        
        success = await register(userData);
        if (!success) {
          // 等待一下让contextError更新，然后使用最新的错误信息
          setTimeout(() => {
            const errorMessage = contextError || 'このユーザー名またはメールアドレスはすでに登録されています';
            setFormError(errorMessage);
            toast.error(errorMessage);
          }, 100);
        }
      }
      
      if (success) {
        // 成功时显示成功消息并关闭弹窗
        const successMessage = mode === AuthMode.LOGIN ? 'ログインに成功しました' : '登録に成功しました';
        toast.success(successMessage);
        onClose();
      }
    } catch (error) {
      const errorMessage = 'ログイン/登録中にエラーが発生しました';
      setFormError(errorMessage);
      toast.error(errorMessage);
      console.error(error);
    }
  };

  // 处理忘记密码
  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.usernameOrEmail.trim()) {
      setFormError('ユーザー名またはメールアドレスを入力してください');
      return;
    }

    // 验证输入格式
    if (!validateUserInput(formData.usernameOrEmail)) {
      return;
    }

    try {
      const result = await cognitoAuthService.forgotPassword(formData.usernameOrEmail);
      
      if (result.success) {
        toast.success(`認証コードを ${result.destination} に送信しました`);
        setMode(AuthMode.RESET_PASSWORD);
        setFormError('');
      } else {
        setFormError(result.message || '認証コードの送信に失敗しました');
        toast.error(result.message || '認証コードの送信に失敗しました');
      }
    } catch (error) {
      console.error('忘记密码错误:', error);
      setFormError('認証コードの送信中にエラーが発生しました');
      toast.error('認証コードの送信中にエラーが発生しました');
    }
  };

  // 处理密码重置
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.verificationCode.trim()) {
      setFormError('認証コードを入力してください');
      return;
    }
    
    if (!formData.newPassword.trim()) {
      setFormError('新しいパスワードを入力してください');
      return;
    }
    
    if (formData.newPassword !== formData.confirmNewPassword) {
      setFormError('新しいパスワードと確認パスワードが一致しません');
      return;
    }
    
    if (formData.newPassword.length < 8) {
      setFormError('パスワードは8文字以上である必要があります');
      return;
    }

    try {
      const result = await cognitoAuthService.confirmForgotPassword(
        formData.usernameOrEmail,
        formData.verificationCode,
        formData.newPassword
      );
      
      if (result.success) {
        toast.success(result.message || 'パスワードのリセットに成功しました');
        setMode(AuthMode.LOGIN);
        setFormError('');
        // 清空表单数据
        setFormData({
          ...formData,
          verificationCode: '',
          newPassword: '',
          confirmNewPassword: ''
        });
      } else {
        setFormError(result.message || 'パスワードのリセットに失敗しました');
        toast.error(result.message || 'パスワードのリセットに失敗しました');
      }
    } catch (error) {
      console.error('密码重置错误:', error);
      setFormError('パスワードのリセット中にエラーが発生しました');
      toast.error('パスワードのリセット中にエラーが発生しました');
    }
  };

  // 处理短信登录 - 发送验证码
  const handleSendSmsCode = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.phoneNumber.trim()) {
      setFormError('電話番号を入力してください');
      return;
    }

    // 验证手机号格式
    const phoneValidation = cognitoAuthService.validateUserInput(formData.phoneNumber);
    if (phoneValidation.type !== 'phone' || !phoneValidation.isValid) {
      setFormError('有効な電話番号を入力してください（例：080-1234-5678）');
      return;
    }

    try {
      const result = await sendSmsCode(formData.phoneNumber);
      
      if (result.success) {
        toast.success(`認証コードを ${result.destination || formData.phoneNumber} に送信しました`);
        setMode(AuthMode.VERIFY_SMS);
        setFormError('');
      } else {
        setFormError(result.message || '認証コードの送信に失敗しました');
        toast.error(result.message || '認証コードの送信に失敗しました');
      }
    } catch (error) {
      console.error('发送短信验证码错误:', error);
      setFormError('認証コードの送信に失敗しました。しばらく後に再試行してください');
      toast.error('認証コードの送信に失敗しました。しばらく後に再試行してください');
    }
  };

  // 处理短信验证码登录
  const handleSmsLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.verificationCode.trim()) {
      setFormError('認証コードを入力してください');
      return;
    }

    if (formData.verificationCode.length !== 6) {
      setFormError('認証コードは6桁の数字である必要があります');
      return;
    }

    try {
      const success = await smsLogin(formData.phoneNumber, formData.verificationCode);
      
      if (success) {
        toast.success('SMS認証ログインに成功しました！');
        onClose();
        setFormError('');
      } else {
        // 错误信息已由UserContext设置，这里显示通用错误信息
        toast.error(contextError || '認証コードが間違っているか期限切れです');
      }
    } catch (error) {
      console.error('短信验证登录错误:', error);
      setFormError('認証コードが間違っているか期限切れです');
      toast.error('認証コードが間違っているか期限切れです');
    }
  };

  // 处理邮箱验证码登录 - 发送验证码
  const handleSendEmailCode = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.email.trim()) {
      setFormError('メールアドレスを入力してください');
      return;
    }

    // 验证邮箱格式
    const emailValidation = cognitoAuthService.validateUserInput(formData.email);
    if (emailValidation.type !== 'email' || !emailValidation.isValid) {
      setFormError('有効なメールアドレスを入力してください');
      return;
    }

    try {
      const result = await sendEmailCode(formData.email);
      
      if (result.success) {
        toast.success(`認証コードを ${result.destination || formData.email} に送信しました`);
        setMode(AuthMode.VERIFY_EMAIL);
        setFormError('');
      } else {
        setFormError(result.message || '認証コードの送信に失敗しました');
        toast.error(result.message || '認証コードの送信に失敗しました');
      }
    } catch (error) {
      console.error('发送邮箱验证码错误:', error);
      setFormError('認証コードの送信に失敗しました。しばらく後に再試行してください');
      toast.error('認証コードの送信に失敗しました。しばらく後に再試行してください');
    }
  };

  // 处理邮箱验证码登录
  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.verificationCode.trim()) {
      setFormError('認証コードを入力してください');
      return;
    }

    if (formData.verificationCode.length !== 6) {
      setFormError('認証コードは6桁の数字である必要があります');
      return;
    }

    try {
      const success = await emailLogin(formData.email, formData.verificationCode);
      
      if (success) {
        toast.success('メール認証ログインに成功しました！');
        onClose();
        setFormError('');
      } else {
        // 错误信息已由UserContext设置，这里显示通用错误信息
        toast.error(contextError || '認証コードが間違っているか期限切れです');
      }
    } catch (error) {
      console.error('邮箱验证登录错误:', error);
      setFormError('認証コードが間違っているか期限切れです');
      toast.error('認証コードが間違っているか期限切れです');
    }
  };
  
  // 添加通过已保存账号登录的函数
  const handleQuickLogin = async (userId: string) => {
    try {
      const success = await switchAccount(userId);
      
      if (success) {
        onClose();
        toast.success('アカウントの切り替えに成功しました');
      } else {
        toast.error('アカウントの切り替えに失敗しました。ユーザー名とパスワードでログインしてください');
      }
    } catch (error) {
      console.error('[LoginModal] 快速登录出错:', error);
      toast.error('クイックログインに失敗しました');
    }
  };
  
  if (!isOpen) return null;
  
  return (
    <div className={`fixed inset-0 z-50 flex items-center justify-center ${isOpen ? 'block' : 'hidden'}`}>
      <div className="fixed inset-0 bg-black opacity-50" onClick={onClose}></div>
      <div className="bg-white rounded-lg p-8 max-w-md w-full relative z-10">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-xl font-semibold text-gray-900">
            {mode === AuthMode.LOGIN && 'アカウントにログイン'}
            {mode === AuthMode.REGISTER && '新しいアカウントを作成'}
            {mode === AuthMode.FORGOT_PASSWORD && 'パスワードをリセット'}
            {mode === AuthMode.RESET_PASSWORD && '新しいパスワードを設定'}
            {mode === AuthMode.SMS_LOGIN && 'SMS認証ログイン'}
            {mode === AuthMode.VERIFY_SMS && '認証コードを入力'}
            {mode === AuthMode.EMAIL_LOGIN && 'メール認証ログイン'}
            {mode === AuthMode.VERIFY_EMAIL && '認証コードを入力'}
          </h3>
          <button 
            onClick={onClose}
            className="text-gray-400 hover:text-gray-500"
          >
            <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        {formError && (
          <div className="mb-4 bg-red-50 border-l-4 border-red-500 p-4">
            <div className="text-sm text-red-700">{formError}</div>
          </div>
        )}

        {/* 忘记密码表单 */}
        {mode === AuthMode.FORGOT_PASSWORD && (
          <form className="space-y-4" onSubmit={handleForgotPassword}>
            <div>
              <label htmlFor="usernameOrEmail" className="block text-sm font-medium text-gray-700">
                ユーザー名またはメールアドレス
              </label>
              <div className="mt-1">
                <input
                  id="usernameOrEmail"
                  name="usernameOrEmail"
                  type="text"
                  autoComplete="username email"
                  value={formData.usernameOrEmail}
                  onChange={(e) => setFormData({ ...formData, usernameOrEmail: e.target.value })}
                  required
                  className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  placeholder="ユーザー名またはメールアドレスを入力してください"
                />
              </div>
            </div>

            <div>
              <button
                type="submit"
                disabled={loading}
                className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
              >
                {loading ? '送信中...' : '認証コードを送信'}
              </button>
            </div>
          </form>
        )}

        {/* 重置密码表单 */}
        {mode === AuthMode.RESET_PASSWORD && (
          <form className="space-y-4" onSubmit={handleResetPassword}>
            <div className="text-center text-sm text-gray-600 mb-4">
              認証コードを {formData.usernameOrEmail} に送信しました
            </div>

            <div>
              <label htmlFor="verificationCode" className="block text-sm font-medium text-gray-700">
                認証コード
              </label>
              <div className="mt-1">
                <input
                  id="verificationCode"
                  name="verificationCode"
                  type="text"
                  maxLength={6}
                  value={formData.verificationCode}
                  onChange={(e) => setFormData({ ...formData, verificationCode: e.target.value })}
                  required
                  className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  placeholder="認証コードを入力してください"
                />
              </div>
            </div>

            <div>
              <label htmlFor="newPassword" className="block text-sm font-medium text-gray-700">
                新しいパスワード
              </label>
              <div className="mt-1">
                <input
                  id="newPassword"
                  name="newPassword"
                  type="password"
                  autoComplete="new-password"
                  value={formData.newPassword}
                  onChange={(e) => setFormData({ ...formData, newPassword: e.target.value })}
                  required
                  className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  placeholder="新しいパスワードを入力してください"
                />
              </div>
            </div>

            <div>
              <label htmlFor="confirmNewPassword" className="block text-sm font-medium text-gray-700">
                パスワード確認
              </label>
              <div className="mt-1">
                <input
                  id="confirmNewPassword"
                  name="confirmNewPassword"
                  type="password"
                  autoComplete="new-password"
                  value={formData.confirmNewPassword}
                  onChange={(e) => setFormData({ ...formData, confirmNewPassword: e.target.value })}
                  required
                  className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  placeholder="パスワードを再入力してください"
                />
              </div>
            </div>

            <div>
              <button
                type="submit"
                disabled={loading}
                className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
              >
                {loading ? 'リセット中...' : 'パスワードをリセット'}
              </button>
            </div>
          </form>
        )}

        {/* 短信登录表单 */}
        {mode === AuthMode.SMS_LOGIN && (
          <form className="space-y-4" onSubmit={handleSendSmsCode}>
            <div>
              <label htmlFor="phoneNumber" className="block text-sm font-medium text-gray-700">
                電話番号
              </label>
              <div className="mt-1">
                <input
                  id="phoneNumber"
                  name="phoneNumber"
                  type="tel"
                  autoComplete="tel"
                  value={formData.phoneNumber}
                  onChange={(e) => setFormData({ ...formData, phoneNumber: e.target.value })}
                  required
                  className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  placeholder="電話番号を入力してください（例：080-1234-5678）"
                />
              </div>
            </div>

            <div>
              <button
                type="submit"
                disabled={loading}
                className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
              >
                {loading ? '送信中...' : '認証コードを送信'}
              </button>
            </div>

            <div className="flex justify-center">
              <button
                type="button"
                onClick={() => setMode(AuthMode.LOGIN)}
                className="text-sm text-gray-600 hover:text-gray-500"
              >
                パスワードログインに戻る
              </button>
            </div>
          </form>
        )}

        {/* 短信验证码验证表单 */}
        {mode === AuthMode.VERIFY_SMS && (
          <form className="space-y-4" onSubmit={handleSmsLogin}>
            <div className="text-center text-sm text-gray-600 mb-4">
              認証コードを {formData.phoneNumber} に送信しました
            </div>

            <div>
              <label htmlFor="verificationCode" className="block text-sm font-medium text-gray-700">
                認証コード
              </label>
              <div className="mt-1">
                <input
                  id="verificationCode"
                  name="verificationCode"
                  type="text"
                  maxLength={6}
                  value={formData.verificationCode}
                  onChange={(e) => setFormData({ ...formData, verificationCode: e.target.value.replace(/\D/g, '') })}
                  required
                  className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm text-center text-lg tracking-widest"
                  placeholder="6桁の認証コードを入力"
                />
              </div>
            </div>

            <div>
              <button
                type="submit"
                disabled={loading}
                className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
              >
                {loading ? '認証中...' : '認証してログイン'}
              </button>
            </div>

            <div className="flex justify-between">
              <button
                type="button"
                onClick={() => setMode(AuthMode.SMS_LOGIN)}
                className="text-sm text-gray-600 hover:text-gray-500"
              >
                電話番号を再入力
              </button>
              <button
                type="button"
                onClick={handleSendSmsCode}
                className="text-sm text-gray-600 hover:text-gray-500"
              >
                認証コードを再送信
              </button>
            </div>
          </form>
        )}

        {/* 邮箱验证码登录表单 */}
        {mode === AuthMode.EMAIL_LOGIN && (
          <form className="space-y-4" onSubmit={handleSendEmailCode}>
            <div>
              <label htmlFor="emailLogin" className="block text-sm font-medium text-gray-700">
                メールアドレス
              </label>
              <div className="mt-1">
                <input
                  id="emailLogin"
                  name="email"
                  type="email"
                  autoComplete="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  required
                  className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  placeholder="メールアドレスを入力してください"
                />
              </div>
            </div>

            <div>
              <button
                type="submit"
                disabled={loading}
                className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
              >
                {loading ? '送信中...' : '認証コードを送信'}
              </button>
            </div>

            <div className="flex justify-center">
              <button
                type="button"
                onClick={() => setMode(AuthMode.LOGIN)}
                className="text-sm text-gray-600 hover:text-gray-500"
              >
                パスワードログインに戻る
              </button>
            </div>
          </form>
        )}

        {/* 邮箱验证码验证表单 */}
        {mode === AuthMode.VERIFY_EMAIL && (
          <form className="space-y-4" onSubmit={handleEmailLogin}>
            <div className="text-center text-sm text-gray-600 mb-4">
              認証コードを {formData.email} に送信しました
            </div>

            <div>
              <label htmlFor="emailVerificationCode" className="block text-sm font-medium text-gray-700">
                認証コード
              </label>
              <div className="mt-1">
                <input
                  id="emailVerificationCode"
                  name="verificationCode"
                  type="text"
                  maxLength={6}
                  value={formData.verificationCode}
                  onChange={(e) => setFormData({ ...formData, verificationCode: e.target.value.replace(/\D/g, '') })}
                  required
                  className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm text-center text-lg tracking-widest"
                  placeholder="6桁の認証コードを入力"
                />
              </div>
            </div>

            <div>
              <button
                type="submit"
                disabled={loading}
                className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
              >
                {loading ? '認証中...' : '認証してログイン'}
              </button>
            </div>

            <div className="flex justify-between">
              <button
                type="button"
                onClick={() => setMode(AuthMode.EMAIL_LOGIN)}
                className="text-sm text-gray-600 hover:text-gray-500"
              >
                メールアドレスを再入力
              </button>
              <button
                type="button"
                onClick={handleSendEmailCode}
                className="text-sm text-gray-600 hover:text-gray-500"
              >
                認証コードを再送信
              </button>
            </div>
          </form>
        )}

        {/* 登录和注册表单 */}
        {(mode === AuthMode.LOGIN || mode === AuthMode.REGISTER) && (
          <form className="space-y-4" onSubmit={handleSubmit}>
          {mode === AuthMode.LOGIN ? (
            // 登录模式显示用户名/邮箱输入框
            <div>
              <label htmlFor="usernameOrEmail" className="block text-sm font-medium text-gray-700">
                ユーザー名またはメールアドレス
              </label>
              <div className="mt-1">
                <input
                  id="usernameOrEmail"
                  name="usernameOrEmail"
                  type="text"
                  autoComplete="username email"
                  value={formData.usernameOrEmail}
                  onChange={(e) => setFormData({ ...formData, usernameOrEmail: e.target.value })}
                  required
                  className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  placeholder="ユーザー名またはメールアドレスを入力"
                />
              </div>
            </div>
          ) : (
            // 注册模式显示用户名和邮箱输入框
            <>
            <div>
              <label htmlFor="username" className="block text-sm font-medium text-gray-700">
                ユーザー名
              </label>
              <div className="mt-1">
                <input
                  id="username"
                  name="username"
                  type="text"
                  autoComplete="username"
                  value={formData.username}
                  onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                  required
                  className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  placeholder="ユーザー名を入力してください"
                />
              </div>
            </div>

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                メールアドレス
              </label>
              <div className="mt-1">
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  required
                  className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  placeholder="メールアドレスを入力してください"
                />
              </div>
            </div>
            </>
          )}

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700">
              パスワード
            </label>
            <div className="mt-1">
              <input
                id="password"
                name="password"
                type="password"
                autoComplete={mode === AuthMode.LOGIN ? 'current-password' : 'new-password'}
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                required
                className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                placeholder="パスワードを入力してください"
              />
            </div>
          </div>

          {mode === AuthMode.REGISTER && (
            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700">
                パスワード確認
              </label>
              <div className="mt-1">
                <input
                  id="confirmPassword"
                  name="confirmPassword"
                  type="password"
                  autoComplete="new-password"
                  value={formData.confirmPassword}
                  onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                  required
                  className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  placeholder="パスワードを再入力してください"
                />
              </div>
            </div>
          )}

          <div>
            <button
              type="submit"
              disabled={loading}
              className={`w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 ${loading ? 'opacity-70 cursor-not-allowed' : ''}`}
            >
              {loading ? (
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              ) : null}
              {mode === AuthMode.LOGIN ? 'ログイン' : '登録'}
            </button>
          </div>
        </form>
        )}

        <div className="mt-4 space-y-2">
          {/* 主要切换按钮 */}
          <div className="flex justify-center">
            <button
              onClick={toggleMode}
              className="text-sm text-blue-600 hover:text-blue-500"
            >
              {mode === AuthMode.LOGIN && 'アカウントをお持ちでない方はこちら'}
              {mode === AuthMode.REGISTER && 'すでにアカウントをお持ちの方はこちら'}
              {mode === AuthMode.FORGOT_PASSWORD && 'ログインに戻る'}
              {mode === AuthMode.RESET_PASSWORD && 'ログインに戻る'}
            </button>
          </div>
          
          {/* 忘记密码和短信登录链接 */}
          {mode === AuthMode.LOGIN && (
            <div className="flex justify-center space-x-4">
              <button
                onClick={() => setMode(AuthMode.FORGOT_PASSWORD)}
                className="text-sm text-gray-600 hover:text-gray-500"
              >
                パスワードをお忘れですか？
              </button>
              <span className="text-gray-300">|</span>
              <button
                onClick={() => setMode(AuthMode.SMS_LOGIN)}
                className="text-sm text-blue-600 hover:text-blue-500"
              >
                SMS認証ログイン
              </button>
              <span className="text-gray-300">|</span>
              <button
                onClick={() => setMode(AuthMode.EMAIL_LOGIN)}
                className="text-sm text-blue-600 hover:text-blue-500"
              >
                メール認証ログイン
              </button>
            </div>
          )}
          
          {/* 重新发送验证码 */}
          {mode === AuthMode.RESET_PASSWORD && (
            <div className="flex justify-center">
              <button
                onClick={() => handleResendCode()}
                className="text-sm text-gray-600 hover:text-gray-500"
              >
                認証コードを再送信
              </button>
            </div>
          )}
        </div>

        {mode === AuthMode.LOGIN && savedAccounts.length > 0 && (
          <div className="mb-6">
            <h3 className="text-sm font-medium text-gray-700 mb-2">クイックログイン</h3>
            <div className="space-y-2 max-h-40 overflow-y-auto">
              {savedAccounts.map(account => (
                <div
                  key={account.userId}
                  className="border border-gray-200 rounded p-2 flex justify-between items-center hover:bg-gray-50 cursor-pointer"
                  onClick={() => handleQuickLogin(account.userId)}
                >
                  <div>
                    <div className="font-medium">{account.username}</div>
                    <div className="text-xs text-gray-500">
                      最終ログイン: {new Date(account.lastLogin).toLocaleString('ja-JP', {
                        month: 'short',
                        day: 'numeric',
                        hour: 'numeric',
                        minute: 'numeric'
                      })}
                    </div>
                  </div>
                  <button className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded">
                    選択
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default LoginModal;