import React, { useState, useEffect, useCallback } from 'react';
import { toast } from 'react-toastify';

// 支付状态枚举
export enum PaymentStatus {
  IDLE = 'idle',
  INITIALIZING = 'initializing',
  READY = 'ready',
  PROCESSING = 'processing',
  CONFIRMING = 'confirming',
  SUCCESS = 'success',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
  REQUIRES_ACTION = 'requires_action'
}

// 支付状态接口
export interface PaymentState {
  status: PaymentStatus;
  error: string | null;
  paymentIntentId: string | null;
  clientSecret: string | null;
  progress: number; // 0-100
  retryCount: number;
  canRetry: boolean;
  message: string | null;
}

// 支付状态管理器组件属性
interface PaymentStatusManagerProps {
  onStatusChange?: (status: PaymentState) => void;
  maxRetries?: number;
  children: (state: PaymentState, actions: PaymentActions) => React.ReactNode;
}

// 支付操作接口
export interface PaymentActions {
  initialize: () => void;
  setReady: (clientSecret: string, paymentIntentId: string) => void;
  startProcessing: () => void;
  startConfirming: () => void;
  setSuccess: (paymentIntentId: string) => void;
  setError: (error: string, canRetry?: boolean) => void;
  retry: () => void;
  cancel: () => void;
  reset: () => void;
}

// 支付状态管理器组件
export const PaymentStatusManager: React.FC<PaymentStatusManagerProps> = ({
  onStatusChange,
  maxRetries = 3,
  children
}) => {
  const [state, setState] = useState<PaymentState>({
    status: PaymentStatus.IDLE,
    error: null,
    paymentIntentId: null,
    clientSecret: null,
    progress: 0,
    retryCount: 0,
    canRetry: false,
    message: null
  });

  // 状态更新函数
  const updateState = useCallback((updates: Partial<PaymentState>) => {
    setState(prevState => {
      const newState = { ...prevState, ...updates };
      onStatusChange?.(newState);
      return newState;
    });
  }, [onStatusChange]);

  // 支付操作
  const actions: PaymentActions = {
    initialize: () => {
      updateState({
        status: PaymentStatus.INITIALIZING,
        error: null,
        progress: 10,
        message: '正在初始化支付...'
      });
    },

    setReady: (clientSecret: string, paymentIntentId: string) => {
      updateState({
        status: PaymentStatus.READY,
        clientSecret,
        paymentIntentId,
        progress: 30,
        error: null,
        message: '支付系统已就绪'
      });
    },

    startProcessing: () => {
      updateState({
        status: PaymentStatus.PROCESSING,
        progress: 50,
        message: '正在处理支付请求...'
      });
    },

    startConfirming: () => {
      updateState({
        status: PaymentStatus.CONFIRMING,
        progress: 80,
        message: '正在确认支付...'
      });
    },

    setSuccess: (paymentIntentId: string) => {
      updateState({
        status: PaymentStatus.SUCCESS,
        paymentIntentId,
        progress: 100,
        error: null,
        message: '支付成功！'
      });

      // 显示成功提示
      toast.success('支付成功！', {
        position: 'top-center',
        autoClose: 3000
      });
    },

    setError: (error: string, canRetry = true) => {
      const newRetryCount = canRetry ? state.retryCount + 1 : maxRetries;
      const canStillRetry = canRetry && newRetryCount < maxRetries;

      updateState({
        status: PaymentStatus.FAILED,
        error,
        canRetry: canStillRetry,
        retryCount: newRetryCount,
        progress: 0,
        message: error
      });

      // 显示错误提示
      if (canStillRetry) {
        toast.error(
          <div>
            <div>{error}</div>
            <div className="text-sm mt-1">
              还可以重试 {maxRetries - newRetryCount} 次
            </div>
          </div>,
          {
            position: 'top-center',
            autoClose: 5000
          }
        );
      } else {
        toast.error(error, {
          position: 'top-center',
          autoClose: 5000
        });
      }
    },

    retry: () => {
      if (state.canRetry) {
        actions.initialize();
      }
    },

    cancel: () => {
      updateState({
        status: PaymentStatus.CANCELLED,
        progress: 0,
        message: '支付已取消'
      });
    },

    reset: () => {
      setState({
        status: PaymentStatus.IDLE,
        error: null,
        paymentIntentId: null,
        clientSecret: null,
        progress: 0,
        retryCount: 0,
        canRetry: false,
        message: null
      });
    }
  };

  return <>{children(state, actions)}</>;
};

// 支付进度条组件
export const PaymentProgressBar: React.FC<{ progress: number; status: PaymentStatus }> = ({
  progress,
  status
}) => {
  const getProgressColor = () => {
    switch (status) {
      case PaymentStatus.SUCCESS:
        return 'bg-green-500';
      case PaymentStatus.FAILED:
        return 'bg-red-500';
      case PaymentStatus.PROCESSING:
      case PaymentStatus.CONFIRMING:
        return 'bg-blue-500';
      default:
        return 'bg-gray-500';
    }
  };

  return (
    <div className="w-full bg-gray-700 rounded-full h-2 mb-4">
      <div
        className={`h-2 rounded-full transition-all duration-500 ${getProgressColor()}`}
        style={{ width: `${progress}%` }}
      />
    </div>
  );
};

// 支付状态指示器组件
export const PaymentStatusIndicator: React.FC<{ 
  status: PaymentStatus; 
  message?: string | null;
  showIcon?: boolean;
}> = ({ status, message, showIcon = true }) => {
  const getStatusConfig = () => {
    switch (status) {
      case PaymentStatus.IDLE:
        return {
          color: 'text-gray-400',
          bgColor: 'bg-gray-600',
          icon: '⏸',
          label: '待开始'
        };
      case PaymentStatus.INITIALIZING:
        return {
          color: 'text-blue-400',
          bgColor: 'bg-blue-600',
          icon: '⚡',
          label: '初始化中'
        };
      case PaymentStatus.READY:
        return {
          color: 'text-green-400',
          bgColor: 'bg-green-600',
          icon: '✓',
          label: '准备就绪'
        };
      case PaymentStatus.PROCESSING:
        return {
          color: 'text-blue-400',
          bgColor: 'bg-blue-600',
          icon: '⚙',
          label: '处理中'
        };
      case PaymentStatus.CONFIRMING:
        return {
          color: 'text-orange-400',
          bgColor: 'bg-orange-600',
          icon: '🔄',
          label: '确认中'
        };
      case PaymentStatus.SUCCESS:
        return {
          color: 'text-green-400',
          bgColor: 'bg-green-600',
          icon: '✅',
          label: '成功'
        };
      case PaymentStatus.FAILED:
        return {
          color: 'text-red-400',
          bgColor: 'bg-red-600',
          icon: '❌',
          label: '失败'
        };
      case PaymentStatus.CANCELLED:
        return {
          color: 'text-gray-400',
          bgColor: 'bg-gray-600',
          icon: '⏹',
          label: '已取消'
        };
      default:
        return {
          color: 'text-gray-400',
          bgColor: 'bg-gray-600',
          icon: '?',
          label: '未知'
        };
    }
  };

  const config = getStatusConfig();

  return (
    <div className="flex items-center space-x-2">
      {showIcon && (
        <div className={`w-6 h-6 rounded-full ${config.bgColor} flex items-center justify-center text-xs`}>
          {config.icon}
        </div>
      )}
      <div className="flex flex-col">
        <span className={`text-sm font-medium ${config.color}`}>
          {config.label}
        </span>
        {message && (
          <span className="text-xs text-gray-400">
            {message}
          </span>
        )}
      </div>
    </div>
  );
};

// 导出类型和工具函数
export const PaymentStatusUtils = {
  isProcessing: (status: PaymentStatus) => 
    [PaymentStatus.INITIALIZING, PaymentStatus.PROCESSING, PaymentStatus.CONFIRMING].includes(status),
  
  isCompleted: (status: PaymentStatus) =>
    [PaymentStatus.SUCCESS, PaymentStatus.FAILED, PaymentStatus.CANCELLED].includes(status),
  
  canInteract: (status: PaymentStatus) =>
    [PaymentStatus.IDLE, PaymentStatus.READY, PaymentStatus.FAILED].includes(status),
  
  getStatusText: (status: PaymentStatus) => {
    const config = {
      [PaymentStatus.IDLE]: '等待开始',
      [PaymentStatus.INITIALIZING]: '初始化支付系统',
      [PaymentStatus.READY]: '支付系统已就绪',
      [PaymentStatus.PROCESSING]: '正在处理支付',
      [PaymentStatus.CONFIRMING]: '正在确认支付',
      [PaymentStatus.SUCCESS]: '支付成功完成',
      [PaymentStatus.FAILED]: '支付处理失败',
      [PaymentStatus.CANCELLED]: '支付已被取消',
      [PaymentStatus.REQUIRES_ACTION]: '需要额外验证'
    };
    return config[status] || '未知状态';
  }
};