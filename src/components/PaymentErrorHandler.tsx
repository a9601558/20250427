import React from 'react';

// 错误类型枚举
export enum PaymentErrorType {
  CARD_ERROR = 'card_error',
  NETWORK_ERROR = 'network_error',
  AUTHENTICATION_ERROR = 'authentication_error',
  VALIDATION_ERROR = 'validation_error',
  SERVER_ERROR = 'server_error',
  UNKNOWN_ERROR = 'unknown_error'
}

// 错误信息接口
export interface PaymentError {
  type: PaymentErrorType;
  code?: string;
  message: string;
  suggestion?: string;
  canRetry: boolean;
  retryAfter?: number; // 秒数
}

// 错误处理工具类
export class PaymentErrorHandler {
  // 解析 Stripe 错误
  static parseStripeError(stripeError: any): PaymentError {
    const errorType = stripeError.type || 'unknown_error';
    const errorCode = stripeError.code;
    
    switch (errorType) {
      case 'card_error':
        return this.handleCardError(errorCode, stripeError.message);
      case 'api_connection_error':
      case 'api_error':
        return {
          type: PaymentErrorType.NETWORK_ERROR,
          code: errorCode,
          message: '网络连接问题，支付状态未知',
          suggestion: '请检查网络连接，或联系客服确认支付状态',
          canRetry: true,
          retryAfter: 5
        };
      case 'authentication_required':
        return {
          type: PaymentErrorType.AUTHENTICATION_ERROR,
          code: errorCode,
          message: '需要额外的身份验证',
          suggestion: '请检查您的手机短信或银行应用进行验证',
          canRetry: true
        };
      case 'processing_error':
        return {
          type: PaymentErrorType.SERVER_ERROR,
          code: errorCode,
          message: '支付处理出错',
          suggestion: '请稍后重试，如果问题持续存在请联系客服',
          canRetry: true,
          retryAfter: 10
        };
      default:
        return {
          type: PaymentErrorType.UNKNOWN_ERROR,
          code: errorCode,
          message: stripeError.message || '支付过程中发生未知错误',
          suggestion: '请重试或联系客服获取帮助',
          canRetry: true
        };
    }
  }

  // 处理银行卡错误
  private static handleCardError(code: string, message: string): PaymentError {
    switch (code) {
      case 'card_declined':
        return {
          type: PaymentErrorType.CARD_ERROR,
          code,
          message: '您的银行卡被拒绝',
          suggestion: '请检查卡片信息是否正确，或联系您的银行',
          canRetry: true
        };
      case 'insufficient_funds':
        return {
          type: PaymentErrorType.CARD_ERROR,
          code,
          message: '卡片余额不足',
          suggestion: '请使用其他支付方式或向账户充值',
          canRetry: false
        };
      case 'expired_card':
        return {
          type: PaymentErrorType.CARD_ERROR,
          code,
          message: '卡片已过期',
          suggestion: '请检查卡片有效期或使用其他卡片',
          canRetry: false
        };
      case 'incorrect_cvc':
        return {
          type: PaymentErrorType.CARD_ERROR,
          code,
          message: 'CVV验证码错误',
          suggestion: '请检查卡片背面的3位数字',
          canRetry: true
        };
      case 'incorrect_number':
        return {
          type: PaymentErrorType.CARD_ERROR,
          code,
          message: '卡号错误',
          suggestion: '请检查并重新输入正确的卡号',
          canRetry: true
        };
      case 'invalid_expiry_month':
      case 'invalid_expiry_year':
        return {
          type: PaymentErrorType.CARD_ERROR,
          code,
          message: '卡片有效期格式错误',
          suggestion: '请输入正确的有效期（MM/YY）',
          canRetry: true
        };
      default:
        return {
          type: PaymentErrorType.CARD_ERROR,
          code,
          message: message || '卡片信息有误',
          suggestion: '请检查所有卡片信息并重试',
          canRetry: true
        };
    }
  }

  // 解析 API 错误
  static parseApiError(error: any): PaymentError {
    if (error.response) {
      const status = error.response.status;
      const data = error.response.data;

      switch (status) {
        case 401:
        case 403:
          return {
            type: PaymentErrorType.AUTHENTICATION_ERROR,
            message: '身份验证失败',
            suggestion: '请重新登录后再试',
            canRetry: false
          };
        case 400:
          return {
            type: PaymentErrorType.VALIDATION_ERROR,
            message: data?.message || '请求参数错误',
            suggestion: '请检查输入信息并重试',
            canRetry: true
          };
        case 429:
          return {
            type: PaymentErrorType.SERVER_ERROR,
            message: '请求过于频繁',
            suggestion: '请稍后再试',
            canRetry: true,
            retryAfter: 30
          };
        case 500:
        case 502:
        case 503:
          return {
            type: PaymentErrorType.SERVER_ERROR,
            message: '服务器暂时不可用',
            suggestion: '请稍后重试',
            canRetry: true,
            retryAfter: 10
          };
        default:
          return {
            type: PaymentErrorType.SERVER_ERROR,
            message: data?.message || '服务器错误',
            suggestion: '请稍后重试或联系客服',
            canRetry: true
          };
      }
    } else if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
      return {
        type: PaymentErrorType.NETWORK_ERROR,
        message: '网络连接超时',
        suggestion: '请检查网络连接后重试',
        canRetry: true,
        retryAfter: 5
      };
    } else {
      return {
        type: PaymentErrorType.UNKNOWN_ERROR,
        message: error.message || '未知错误',
        suggestion: '请重试或联系客服',
        canRetry: true
      };
    }
  }
}

// 错误显示组件属性
interface PaymentErrorDisplayProps {
  error: PaymentError;
  onRetry?: () => void;
  onCancel?: () => void;
  showRetryButton?: boolean;
  className?: string;
}

// 错误显示组件
export const PaymentErrorDisplay: React.FC<PaymentErrorDisplayProps> = ({
  error,
  onRetry,
  onCancel,
  showRetryButton = true,
  className = ''
}) => {
  const getErrorIcon = () => {
    switch (error.type) {
      case PaymentErrorType.CARD_ERROR:
        return '💳';
      case PaymentErrorType.NETWORK_ERROR:
        return '🌐';
      case PaymentErrorType.AUTHENTICATION_ERROR:
        return '🔐';
      case PaymentErrorType.VALIDATION_ERROR:
        return '⚠️';
      case PaymentErrorType.SERVER_ERROR:
        return '🚫';
      default:
        return '❌';
    }
  };

  const getErrorColor = () => {
    switch (error.type) {
      case PaymentErrorType.NETWORK_ERROR:
        return 'border-yellow-500 bg-yellow-900 bg-opacity-20 text-yellow-200';
      case PaymentErrorType.AUTHENTICATION_ERROR:
        return 'border-blue-500 bg-blue-900 bg-opacity-20 text-blue-200';
      case PaymentErrorType.VALIDATION_ERROR:
        return 'border-orange-500 bg-orange-900 bg-opacity-20 text-orange-200';
      default:
        return 'border-red-500 bg-red-900 bg-opacity-20 text-red-200';
    }
  };

  return (
    <div className={`p-4 rounded-xl border-2 ${getErrorColor()} ${className}`}>
      <div className="flex items-start space-x-3">
        <div className="text-2xl flex-shrink-0">
          {getErrorIcon()}
        </div>
        <div className="flex-1">
          <h4 className="font-bold text-lg mb-2">
            {error.message}
          </h4>
          {error.suggestion && (
            <p className="text-sm opacity-90 mb-3">
              {error.suggestion}
            </p>
          )}
          {error.retryAfter && (
            <p className="text-xs opacity-75 mb-3">
              建议 {error.retryAfter} 秒后重试
            </p>
          )}
          
          {/* 操作按钮 */}
          <div className="flex space-x-3">
            {showRetryButton && error.canRetry && onRetry && (
              <button
                onClick={onRetry}
                className="px-4 py-2 bg-white bg-opacity-20 hover:bg-opacity-30 rounded-lg text-sm font-medium transition-all"
              >
                重试
              </button>
            )}
            {onCancel && (
              <button
                onClick={onCancel}
                className="px-4 py-2 bg-gray-600 hover:bg-gray-700 rounded-lg text-sm font-medium transition-all"
              >
                取消
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// 错误边界组件
interface PaymentErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: (error: PaymentError) => React.ReactNode;
}

interface PaymentErrorBoundaryState {
  hasError: boolean;
  error: PaymentError | null;
}

export class PaymentErrorBoundary extends React.Component<
  PaymentErrorBoundaryProps,
  PaymentErrorBoundaryState
> {
  constructor(props: PaymentErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): PaymentErrorBoundaryState {
    return {
      hasError: true,
      error: {
        type: PaymentErrorType.UNKNOWN_ERROR,
        message: '支付组件发生错误',
        suggestion: '请刷新页面后重试',
        canRetry: true
      }
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Payment Error Boundary caught an error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError && this.state.error) {
      if (this.props.fallback) {
        return this.props.fallback(this.state.error);
      }
      
      return (
        <PaymentErrorDisplay
          error={this.state.error}
          onRetry={() => {
            this.setState({ hasError: false, error: null });
            window.location.reload();
          }}
        />
      );
    }

    return this.props.children;
  }
}