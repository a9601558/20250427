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
  
  // 加载保存済み的账号列表
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
  
  // 添加通过保存済み账号登录的函数
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
  
  // 添加内联样式以确保模态框正确显示
  const modalOverlayStyle: React.CSSProperties = {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 9999,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '20px',
    minHeight: '100vh',
    minWidth: '100vw',
    overflow: 'auto'
  };

  const modalContentStyle: React.CSSProperties = {
    width: 'clamp(600px, 85vw, 1200px)',
    minHeight: 'clamp(500px, 70vh, 900px)',
    maxHeight: '95vh',
    padding: '2rem',
    backgroundColor: 'white',
    borderRadius: '1rem',
    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
    border: '1px solid #f3f4f6',
    position: 'relative',
    zIndex: 10,
    overflow: 'auto',
    boxSizing: 'border-box',
    fontFamily: "'Noto Sans JP', 'Hiragino Kaku Gothic ProN', 'Hiragino Sans', 'Yu Gothic Medium', 'Meiryo', system-ui, sans-serif",
    color: '#374151',
    lineHeight: '1.5'
  };
  
  return (
    <div style={modalOverlayStyle}>
      <div 
        className="fixed inset-0 bg-black/60 backdrop-blur-sm" 
        onClick={onClose}
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.6)',
          backdropFilter: 'blur(4px)',
          zIndex: 1
        }}
      ></div>
      <div style={modalContentStyle}>
        {/* 模态框头部 */}
        <div className="flex justify-between items-start mb-8" style={{ minHeight: '100px' }}>
          <div className="flex-1 pr-4">
            <h2 className="text-4xl font-bold text-gray-900 mb-4 leading-tight">
              {mode === AuthMode.LOGIN && 'アカウントにログイン'}
              {mode === AuthMode.REGISTER && '新しいアカウントを作成'}
              {mode === AuthMode.FORGOT_PASSWORD && 'パスワードをリセット'}
              {mode === AuthMode.RESET_PASSWORD && '新しいパスワードを設定'}
              {mode === AuthMode.SMS_LOGIN && 'SMS認証ログイン'}
              {mode === AuthMode.VERIFY_SMS && '認証コードを入力'}
              {mode === AuthMode.EMAIL_LOGIN && 'メール認証ログイン'}
              {mode === AuthMode.VERIFY_EMAIL && '認証コードを入力'}
            </h2>
            <p className="text-gray-600 text-base leading-relaxed">
              {mode === AuthMode.LOGIN && 'アカウントにログインして学習を続けましょう'}
              {mode === AuthMode.REGISTER && '新しいアカウントを作成して学習を始めましょう'}
              {mode === AuthMode.FORGOT_PASSWORD && 'メールアドレスまたはユーザー名を入力してください'}
              {mode === AuthMode.RESET_PASSWORD && '受信した認証コードと新しいパスワードを入力してください'}
              {mode === AuthMode.SMS_LOGIN && '電話番号を使用してログインします'}
              {mode === AuthMode.VERIFY_SMS && 'お使いの電話番号に送信された認証コードを入力してください'}
              {mode === AuthMode.EMAIL_LOGIN && 'メールアドレスを使用してログインします'}
              {mode === AuthMode.VERIFY_EMAIL && 'お使いのメールアドレスに送信された認証コードを入力してください'}
            </p>
          </div>
          <button 
            onClick={onClose}
            className="flex-shrink-0 w-12 h-12 flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-all duration-200"
            style={{ minWidth: '48px', minHeight: '48px' }}
          >
            <svg className="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        {formError && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-xl p-4 flex items-start space-x-3">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <div className="text-sm font-medium text-red-800">{formError}</div>
          </div>
        )}

        {/* 忘记密码表单 */}
        {mode === AuthMode.FORGOT_PASSWORD && (
          <div className="bg-gray-50 rounded-xl p-6 mb-6">
            <form className="space-y-6" onSubmit={handleForgotPassword}>
              <div className="space-y-2">
                <label htmlFor="usernameOrEmail" className="block text-sm font-semibold text-gray-700 mb-2">
                  ユーザー名またはメールアドレス
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207" />
                    </svg>
                  </div>
                  <input
                    id="usernameOrEmail"
                    name="usernameOrEmail"
                    type="text"
                    autoComplete="username email"
                    value={formData.usernameOrEmail}
                    onChange={(e) => setFormData({ ...formData, usernameOrEmail: e.target.value })}
                    required
                    className="w-full pl-12 pr-4 py-3 border border-gray-200 rounded-lg bg-white shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-base transition-all duration-200"
                    placeholder="ユーザー名またはメールアドレスを入力"
                  />
                </div>
              </div>

              <div className="pt-4">
                <button
                  type="submit"
                  disabled={loading}
                  className={`w-full flex justify-center items-center py-4 px-6 border border-transparent rounded-xl shadow-lg text-base font-semibold text-white bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 focus:outline-none focus:ring-4 focus:ring-blue-500 focus:ring-opacity-50 transform transition-all duration-200 hover:scale-[1.02] ${loading ? 'opacity-70 cursor-not-allowed hover:scale-100' : ''}`}
                >
                  {loading ? (
                    <>
                      <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      送信中...
                    </>
                  ) : (
                    <>
                      <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                      </svg>
                      認証コードを送信
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
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
          <div className="bg-gray-50 rounded-xl mb-8" style={{ padding: '2rem', minHeight: '400px' }}>
            <form className="space-y-8" onSubmit={handleSubmit}>
              {mode === AuthMode.LOGIN ? (
                // 登录模式显示用户名/邮箱输入框
                <div className="space-y-2">
                  <label htmlFor="usernameOrEmail" className="block text-sm font-semibold text-gray-700 mb-2">
                    ユーザー名またはメールアドレス
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                      <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                    </div>
                    <input
                      id="usernameOrEmail"
                      name="usernameOrEmail"
                      type="text"
                      autoComplete="username email"
                      value={formData.usernameOrEmail}
                      onChange={(e) => setFormData({ ...formData, usernameOrEmail: e.target.value })}
                      required
                      className="w-full pl-14 pr-4 py-4 border border-gray-200 rounded-lg bg-white shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-lg transition-all duration-200"
                      style={{ minHeight: '56px', fontSize: '16px' }}
                      placeholder="ユーザー名またはメールアドレスを入力"
                    />
                  </div>
                </div>
              ) : (
                // 注册模式显示用户名和邮箱输入框
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label htmlFor="username" className="block text-sm font-semibold text-gray-700 mb-2">
                      ユーザー名
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                        <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                      </div>
                      <input
                        id="username"
                        name="username"
                        type="text"
                        autoComplete="username"
                        value={formData.username}
                        onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                        required
                        className="w-full pl-12 pr-4 py-3 border border-gray-200 rounded-lg bg-white shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-base transition-all duration-200"
                        placeholder="ユーザー名を入力"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label htmlFor="email" className="block text-sm font-semibold text-gray-700 mb-2">
                      メールアドレス
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                        <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207" />
                        </svg>
                      </div>
                      <input
                        id="email"
                        name="email"
                        type="email"
                        autoComplete="email"
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        required
                        className="w-full pl-12 pr-4 py-3 border border-gray-200 rounded-lg bg-white shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-base transition-all duration-200"
                        placeholder="メールアドレスを入力"
                      />
                    </div>
                  </div>
                </div>
              )}

              <div className={mode === AuthMode.REGISTER ? "grid grid-cols-1 md:grid-cols-2 gap-6" : "space-y-2"}>
                <div className="space-y-2">
                  <label htmlFor="password" className="block text-sm font-semibold text-gray-700 mb-2">
                    パスワード
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                      <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                      </svg>
                    </div>
                    <input
                      id="password"
                      name="password"
                      type="password"
                      autoComplete={mode === AuthMode.LOGIN ? 'current-password' : 'new-password'}
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      required
                      className="w-full pl-12 pr-4 py-3 border border-gray-200 rounded-lg bg-white shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-base transition-all duration-200"
                      placeholder="パスワードを入力"
                    />
                  </div>
                </div>

                {mode === AuthMode.REGISTER && (
                  <div className="space-y-2">
                    <label htmlFor="confirmPassword" className="block text-sm font-semibold text-gray-700 mb-2">
                      パスワード確認
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                        <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </div>
                      <input
                        id="confirmPassword"
                        name="confirmPassword"
                        type="password"
                        autoComplete="new-password"
                        value={formData.confirmPassword}
                        onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                        required
                        className="w-full pl-12 pr-4 py-3 border border-gray-200 rounded-lg bg-white shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-base transition-all duration-200"
                        placeholder="パスワードを再入力"
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="pt-6">
                <button
                  type="submit"
                  disabled={loading}
                  className={`w-full flex justify-center items-center border border-transparent rounded-xl shadow-lg text-lg font-semibold text-white bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 focus:outline-none focus:ring-4 focus:ring-blue-500 focus:ring-opacity-50 transform transition-all duration-200 hover:scale-[1.02] ${loading ? 'opacity-70 cursor-not-allowed hover:scale-100' : ''}`}
                  style={{ minHeight: '60px', fontSize: '18px', padding: '16px 24px' }}
                >
                  {loading ? (
                    <>
                      <svg className="animate-spin -ml-1 mr-3 h-6 w-6 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      {mode === AuthMode.LOGIN ? 'ログイン中...' : '登録中...'}
                    </>
                  ) : (
                    <>
                      <svg className="w-6 h-6 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d={mode === AuthMode.LOGIN ? "M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" : "M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z"} />
                      </svg>
                      {mode === AuthMode.LOGIN ? 'ログイン' : 'アカウントを作成'}
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* 导航链接区域 */}
        <div className="border-t border-gray-200 space-y-6" style={{ paddingTop: '2rem', marginTop: '2rem' }}>
          {/* 主要切换按钮 */}
          <div className="text-center">
            <button
              onClick={toggleMode}
              className="inline-flex items-center px-4 py-2 text-sm font-medium text-blue-600 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 hover:border-blue-300 transition-all duration-200"
            >
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
              </svg>
              {mode === AuthMode.LOGIN && 'アカウントをお持ちでない方はこちら'}
              {mode === AuthMode.REGISTER && 'すでにアカウントをお持ちの方はこちら'}
              {mode === AuthMode.FORGOT_PASSWORD && 'ログインに戻る'}
              {mode === AuthMode.RESET_PASSWORD && 'ログインに戻る'}
            </button>
          </div>
          
          {/* 登录模式的额外选项 */}
          {mode === AuthMode.LOGIN && (
            <div className="flex flex-wrap justify-center gap-3">
              <button
                onClick={() => setMode(AuthMode.FORGOT_PASSWORD)}
                className="inline-flex items-center px-3 py-2 text-xs font-medium text-gray-600 bg-gray-50 border border-gray-200 rounded-lg hover:bg-gray-100 hover:text-gray-700 transition-all duration-200"
              >
                <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                パスワードをお忘れですか？
              </button>
              <button
                onClick={() => setMode(AuthMode.SMS_LOGIN)}
                className="inline-flex items-center px-3 py-2 text-xs font-medium text-blue-600 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 hover:border-blue-300 transition-all duration-200"
              >
                <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
                </svg>
                SMS認証ログイン
              </button>
              <button
                onClick={() => setMode(AuthMode.EMAIL_LOGIN)}
                className="inline-flex items-center px-3 py-2 text-xs font-medium text-blue-600 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 hover:border-blue-300 transition-all duration-200"
              >
                <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207" />
                </svg>
                メール認証ログイン
              </button>
            </div>
          )}
          
          {/* 重置密码模式的重新发送选项 */}
          {mode === AuthMode.RESET_PASSWORD && (
            <div className="text-center">
              <button
                onClick={() => handleResendCode()}
                className="inline-flex items-center px-3 py-2 text-xs font-medium text-gray-600 bg-gray-50 border border-gray-200 rounded-lg hover:bg-gray-100 hover:text-gray-700 transition-all duration-200"
              >
                <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
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