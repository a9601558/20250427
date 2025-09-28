import React, { useState, useEffect } from 'react';

// 支付成功庆祝动画组件
interface PaymentSuccessAnimationProps {
  isVisible: boolean;
  onComplete?: () => void;
  title?: string;
  subtitle?: string;
  duration?: number; // 动画持续时间（毫秒）
}

export const PaymentSuccessAnimation: React.FC<PaymentSuccessAnimationProps> = ({
  isVisible,
  onComplete,
  title = 'お支払い完了！',
  subtitle = '購入が完了しました',
  duration = 3000
}) => {
  const [animationStep, setAnimationStep] = useState<'hidden' | 'showing' | 'complete'>('hidden');
  const [particles, setParticles] = useState<Array<{
    id: number;
    x: number;
    y: number;
    color: string;
    size: number;
    velocity: { x: number; y: number };
  }>>([]);

  useEffect(() => {
    if (isVisible) {
      setAnimationStep('showing');
      
      // 生成粒子效果
      const newParticles = Array.from({ length: 50 }, (_, i) => ({
        id: i,
        x: Math.random() * 100,
        y: Math.random() * 100,
        color: ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6'][Math.floor(Math.random() * 5)],
        size: Math.random() * 8 + 4,
        velocity: {
          x: (Math.random() - 0.5) * 4,
          y: Math.random() * -8 - 2
        }
      }));
      setParticles(newParticles);

      // 自动完成动画
      const timer = setTimeout(() => {
        setAnimationStep('complete');
        onComplete?.();
      }, duration);

      return () => clearTimeout(timer);
    } else {
      setAnimationStep('hidden');
      setParticles([]);
    }
  }, [isVisible, duration, onComplete]);

  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
      {/* 背景遮罩 */}
      <div className="absolute inset-0 bg-black bg-opacity-50 backdrop-blur-sm animate-fade-in" />
      
      {/* 粒子效果 */}
      <div className="absolute inset-0 overflow-hidden">
        {particles.map((particle) => (
          <div
            key={particle.id}
            className="absolute rounded-full animate-bounce-float"
            style={{
              left: `${particle.x}%`,
              top: `${particle.y}%`,
              backgroundColor: particle.color,
              width: `${particle.size}px`,
              height: `${particle.size}px`,
              animation: `bounce-float ${Math.random() * 2 + 3}s linear infinite`,
              animationDelay: `${Math.random() * 2}s`
            }}
          />
        ))}
      </div>

      {/* 主内容 */}
      <div className={`
        relative bg-gradient-to-br from-green-500 to-emerald-600 
        rounded-2xl p-8 text-white text-center shadow-2xl
        transform transition-all duration-500 ease-out
        ${animationStep === 'showing' ? 'scale-100 opacity-100' : 'scale-0 opacity-0'}
      `}>
        {/* 成功图标 */}
        <div className="relative mb-6">
          <div className="w-24 h-24 mx-auto bg-white bg-opacity-20 rounded-full flex items-center justify-center mb-4">
            <svg 
              className="w-12 h-12 text-white animate-check-draw" 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                strokeWidth={3} 
                d="M5 13l4 4L19 7"
                strokeDasharray="24"
                strokeDashoffset="24"
                style={{
                  animation: 'draw-check 0.8s ease-out 0.5s forwards'
                }}
              />
            </svg>
          </div>
          
          {/* 圆圈扩散效果 */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-24 h-24 border-4 border-white border-opacity-30 rounded-full animate-ping" />
            <div className="absolute w-32 h-32 border-2 border-white border-opacity-20 rounded-full animate-ping animation-delay-200" />
          </div>
        </div>

        {/* 文本内容 */}
        <div className="space-y-2">
          <h2 className="text-3xl font-bold animate-slide-up">{title}</h2>
          <p className="text-green-100 text-lg animate-slide-up animation-delay-200">{subtitle}</p>
        </div>

        {/* 装饰性星星 */}
        <div className="absolute -top-4 -left-4 text-yellow-300 animate-twinkle">✨</div>
        <div className="absolute -top-2 -right-6 text-yellow-300 animate-twinkle animation-delay-300">✨</div>
        <div className="absolute -bottom-4 -left-6 text-yellow-300 animate-twinkle animation-delay-600">✨</div>
        <div className="absolute -bottom-2 -right-4 text-yellow-300 animate-twinkle animation-delay-900">✨</div>
      </div>
    </div>
  );
};

// 支付确认卡片组件
interface PaymentConfirmationCardProps {
  questionSetTitle: string;
  amount: number;
  currency?: string;
  purchaseId?: string;
  purchaseDate?: Date;
  remainingDays?: number;
  onContinue?: () => void;
  onViewReceipt?: () => void;
}

export const PaymentConfirmationCard: React.FC<PaymentConfirmationCardProps> = ({
  questionSetTitle,
  amount,
  currency = 'JPY',
  purchaseId,
  purchaseDate = new Date(),
  remainingDays,
  onContinue,
  onViewReceipt
}) => {
  return (
    <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md mx-auto">
      {/* 头部状态 */}
      <div className="text-center mb-6">
        <div className="w-16 h-16 mx-auto bg-green-100 rounded-full flex items-center justify-center mb-4">
          <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h3 className="text-2xl font-bold text-gray-900 mb-2">購入完了</h3>
        <p className="text-gray-600">問題集へのアクセス権を正常に購入しました</p>
      </div>

      {/* 购买详情 */}
      <div className="bg-gray-50 rounded-xl p-6 mb-6">
        <h4 className="font-bold text-gray-900 mb-3">購入詳細</h4>
        
        <div className="space-y-3">
          <div className="flex justify-between">
            <span className="text-gray-600">問題集名</span>
            <span className="font-medium text-gray-900 text-right max-w-48 truncate" title={questionSetTitle}>
              {questionSetTitle}
            </span>
          </div>
          
          <div className="flex justify-between">
            <span className="text-gray-600">支払金額</span>
            <span className="font-bold text-green-600">
              {currency === 'JPY' ? '¥' : currency} {amount.toFixed(0)}
            </span>
          </div>
          
          {purchaseId && (
            <div className="flex justify-between">
              <span className="text-gray-600">订单号</span>
              <span className="font-mono text-sm text-gray-900">
                {purchaseId.substring(0, 16)}...
              </span>
            </div>
          )}
          
          <div className="flex justify-between">
            <span className="text-gray-600">购买时间</span>
            <span className="text-gray-900">
              {purchaseDate.toLocaleDateString('zh-CN', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit'
              })}
            </span>
          </div>
          
          {remainingDays !== undefined && (
            <div className="flex justify-between">
              <span className="text-gray-600">有效期</span>
              <span className="font-medium text-blue-600">
                {remainingDays > 0 ? `${remainingDays} 天` : '已过期'}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* 操作按钮 */}
      <div className="space-y-3">
        {onContinue && (
          <button
            onClick={onContinue}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-6 rounded-xl transition-colors"
          >
            开始学习
          </button>
        )}
        
        {onViewReceipt && (
          <button
            onClick={onViewReceipt}
            className="w-full bg-gray-200 hover:bg-gray-300 text-gray-800 font-medium py-3 px-6 rounded-xl transition-colors"
          >
            查看收据
          </button>
        )}
      </div>

      {/* 底部提示 */}
      <div className="mt-6 p-4 bg-blue-50 rounded-xl">
        <div className="flex items-start space-x-3">
          <svg className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div className="text-sm text-blue-800">
            <p className="font-medium mb-1">购买说明</p>
            <p>您现在可以无限制访问该题库的所有内容。购买记录已保存到您的账户中。</p>
          </div>
        </div>
      </div>
    </div>
  );
};

// 支付处理状态组件
interface PaymentProcessingIndicatorProps {
  step: 'initializing' | 'processing' | 'confirming' | 'completing';
  message?: string;
}

export const PaymentProcessingIndicator: React.FC<PaymentProcessingIndicatorProps> = ({
  step,
  message
}) => {
  const steps = [
    { key: 'initializing', label: '初始化支付', icon: '🔄' },
    { key: 'processing', label: '处理支付', icon: '💳' },
    { key: 'confirming', label: '确认支付', icon: '✅' },
    { key: 'completing', label: '完成购买', icon: '🎉' }
  ];

  const currentStepIndex = steps.findIndex(s => s.key === step);

  return (
    <div className="bg-white rounded-2xl shadow-lg p-6 max-w-md mx-auto">
      <div className="text-center mb-6">
        <div className="w-16 h-16 mx-auto bg-blue-100 rounded-full flex items-center justify-center mb-4">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
        </div>
        <h3 className="text-xl font-bold text-gray-900 mb-2">正在处理支付</h3>
        {message && <p className="text-gray-600">{message}</p>}
      </div>

      {/* 步骤指示器 */}
      <div className="space-y-4">
        {steps.map((stepItem, index) => {
          const isActive = index === currentStepIndex;
          const isCompleted = index < currentStepIndex;
          
          return (
            <div key={stepItem.key} className={`flex items-center space-x-4 ${
              isActive ? 'text-blue-600' : isCompleted ? 'text-green-600' : 'text-gray-400'
            }`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm ${
                isActive ? 'bg-blue-100 animate-pulse' : 
                isCompleted ? 'bg-green-100' : 'bg-gray-100'
              }`}>
                {isCompleted ? '✓' : isActive ? '●' : stepItem.icon}
              </div>
              <span className={`font-medium ${isActive ? 'animate-pulse' : ''}`}>
                {stepItem.label}
              </span>
            </div>
          );
        })}
      </div>

      {/* 底部提示 */}
      <div className="mt-6 p-4 bg-yellow-50 rounded-xl">
        <div className="flex items-center space-x-2 text-yellow-800">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.934-.833-2.5 0L4.232 15.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
          <p className="text-sm font-medium">请勿关闭页面或刷新浏览器</p>
        </div>
      </div>
    </div>
  );
};

// CSS 动画样式（应该添加到全局样式中）
export const paymentAnimationStyles = `
  @keyframes fade-in {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  @keyframes slide-up {
    from { 
      opacity: 0; 
      transform: translateY(20px); 
    }
    to { 
      opacity: 1; 
      transform: translateY(0); 
    }
  }

  @keyframes bounce-float {
    0%, 100% { 
      transform: translateY(0px) rotate(0deg); 
      opacity: 1; 
    }
    25% { 
      transform: translateY(-20px) rotate(90deg); 
      opacity: 0.8; 
    }
    50% { 
      transform: translateY(-40px) rotate(180deg); 
      opacity: 0.6; 
    }
    75% { 
      transform: translateY(-20px) rotate(270deg); 
      opacity: 0.8; 
    }
  }

  @keyframes draw-check {
    from { stroke-dashoffset: 24; }
    to { stroke-dashoffset: 0; }
  }

  @keyframes twinkle {
    0%, 100% { 
      opacity: 0.5; 
      transform: scale(1); 
    }
    50% { 
      opacity: 1; 
      transform: scale(1.2); 
    }
  }

  .animate-fade-in {
    animation: fade-in 0.5s ease-out;
  }

  .animate-slide-up {
    animation: slide-up 0.6s ease-out;
  }

  .animate-bounce-float {
    animation: bounce-float 4s ease-in-out infinite;
  }

  .animate-check-draw {
    animation: draw-check 0.8s ease-out 0.5s forwards;
  }

  .animate-twinkle {
    animation: twinkle 2s ease-in-out infinite;
  }

  .animation-delay-200 {
    animation-delay: 0.2s;
  }

  .animation-delay-300 {
    animation-delay: 0.3s;
  }

  .animation-delay-600 {
    animation-delay: 0.6s;
  }

  .animation-delay-900 {
    animation-delay: 0.9s;
  }
`;